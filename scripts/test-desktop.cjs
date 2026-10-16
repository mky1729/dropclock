const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const kind = process.argv[2];
assert(['electron', 'tauri'].includes(kind), 'Usage: node scripts/test-desktop.cjs electron|tauri');
const qaDir = path.join(root, 'dist', 'qa');
fs.mkdirSync(qaDir, { recursive: true });
const profile = fs.mkdtempSync(path.join(qaDir, `${kind}-profile-`));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const defaults = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

async function launch() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  const executable = kind === 'electron'
    ? path.join(root, 'dist', 'win-unpacked', 'Drop Clock.exe')
    : path.join(root, 'src-tauri', 'target', 'release', 'drop-clock-tauri.exe');
  const args = kind === 'electron' ? [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`] : [];
  const proc = spawn(executable, args, {
    windowsHide: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      WEBVIEW2_USER_DATA_FOLDER: profile,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`
    }
  });
  let socket;
  let requestClose;
  const close = async () => {
    if (proc.pid) {
      try {
        if (requestClose) requestClose();
        else execFileSync('powershell.exe', ['-NoProfile', '-Command', `(Get-Process -Id ${proc.pid} -ErrorAction Stop).CloseMainWindow()`], { windowsHide: true, stdio: 'ignore' });
        for (let i = 0; i < 30 && proc.exitCode === null; i++) await delay(100);
      } catch {}
      if (proc.exitCode === null) {
        try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch {}
      }
    }
    socket?.close();
  };
  try {
    let target;
    for (let i = 0; i < 60; i++) {
      try {
        const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        target = pages.find(page => page.type === 'page' && /index\.html|tauri\.localhost/.test(page.url));
        if (target) break;
      } catch {}
      await delay(500);
    }
    assert(target, 'Application WebView must start');
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let sequence = 0;
    if (kind === 'electron') requestClose = () => socket.send(JSON.stringify({ id: ++sequence, method: 'Browser.close' }));
    const pending = new Map();
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (!pending.has(message.id)) return;
      const { resolve, reject, timeout } = pending.get(message.id);
      clearTimeout(timeout);
      pending.delete(message.id);
      message.error ? reject(Error(JSON.stringify(message.error))) : resolve(message.result);
    };
    const call = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timeout = setTimeout(() => reject(Error(`CDP timeout: ${method}`)), 15000);
      pending.set(id, { resolve, reject, timeout });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (expression, userGesture = false) => {
      const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture });
      assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const ready = async (desktop = true) => {
      for (let i = 0; i < 40; i++) {
        if (await evaluate(`typeof isStarted !== 'undefined' && isStarted === ${desktop} && getComputedStyle(document.querySelector('#start-overlay')).display === '${desktop ? 'none' : 'flex'}'`)) break;
        await delay(250);
      }
      assert.equal(await evaluate('isStarted'), desktop);
    };
    await ready();
    return { call, evaluate, close, ready };
  } catch (error) {
    await close();
    throw error;
  }
}

async function test() {
  let app = await launch();
  try {
    const { evaluate: run, call } = app;
    await delay(1500);
    assert.equal(await run('audioCtx.state'), 'running', 'Audio must run without a user gesture');
    assert.deepEqual(await run('schedules'), defaults);
    await call('Emulation.setDeviceMetricsOverride', { width: 520, height: 780, deviceScaleFactor: 1, mobile: false });
    await delay(1500);
    const capture = async name => {
      const result = await call('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(qaDir, `${kind}-${name}.png`), Buffer.from(result.data, 'base64'));
    };
    await capture('clock');
    await run(`document.querySelector('#settings-btn').click()`);
    assert.equal(await run('settingsDialog.open'), true);
    await capture('settings');
    await call('Emulation.setDeviceMetricsOverride', { width: 320, height: 620, deviceScaleFactor: 1, mobile: false });
    await delay(500);
    assert(await run(`(() => { const r=settingsDialog.getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight && settingsDialog.scrollWidth<=settingsDialog.clientWidth; })()`), 'Settings must fit a narrow viewport');
    await capture('settings-narrow');
    await run(`settingsTimes.querySelector('input').value='08:15'; document.querySelector('#settings-cancel').click();`);
    assert.deepEqual(await run('schedules'), defaults, 'Cancel must discard edits');
    await run(`openSettings(); settingsTimes.querySelector('input').value='11:00'; document.querySelector('#settings-form').requestSubmit();`);
    assert.equal(await run('settingsDialog.open && settingsError.textContent.includes("重複")'), true);
    await run(`fillSettings(['']); document.querySelector('#settings-form').requestSubmit();`);
    assert.equal(await run('settingsDialog.open && settingsError.textContent.includes("入力")'), true);
    await run(`fillSettings(['17:45','08:15']); document.querySelector('#settings-form').requestSubmit();`);
    assert.deepEqual(await run('schedules'), ['08:15', '17:45']);
    assert.equal(await run('settingsDialog.open'), false);
    // A real alarm invocation must create audio output without any user activation.
    const alarm = await run(`(async () => {
      const original = audioCtx.createOscillator.bind(audioCtx);
      let oscillators=0;
      audioCtx.createOscillator=()=>{oscillators++;return original();};
      const RealDate=Date;
      const before=[...schedules];
      const minuteBefore=lastNotifiedMinute;
      let fake=new RealDate(2026,9,16,8,15,0);
      window.Date=class extends RealDate { constructor(...args){super(...(args.length?args:[fake]));} };
      schedules=['08:15'];lastNotifiedMinute=null;
      checkTime();await new Promise(r=>setTimeout(r,100));
      const once=oscillators;
      checkTime();await new Promise(r=>setTimeout(r,100));
      const twice=oscillators;
      fake=new RealDate(2026,9,17,8,15,0);
      checkTime();await new Promise(r=>setTimeout(r,100));
      const nextDay=oscillators;
      window.Date=RealDate;schedules=before;lastNotifiedMinute=minuteBefore;
      audioCtx.createOscillator=original;
      return {once,twice,nextDay,audio:audioCtx.state};
    })()`);
    assert.deepEqual(alarm, { once: 12, twice: 12, nextDay: 24, audio: 'running' });
    console.log(`${kind}: automatic start, audio, settings editing, validation, responsive layout and alarm deduplication passed`);
  } finally {
    await app.close();
  }
  await delay(1000);
  app = await launch();
  try {
    const { evaluate: run, call } = app;
    assert.deepEqual(await run('schedules'), ['08:15', '17:45'], 'Settings must survive app restart');
    await run(`openSettings();fillSettings([]);document.querySelector('#settings-form').requestSubmit();`);
    await call('Page.reload');
    await delay(1500);
    await app.ready();
    assert.deepEqual(await run('schedules'), [], 'An empty schedule must survive reload');
    await run(`openSettings();document.querySelector('#settings-reset').click();document.querySelector('#settings-cancel').click();`);
    assert.deepEqual(await run('schedules'), [], 'Reset must remain a draft until Save');
    await run(`openSettings();document.querySelector('#settings-reset').click();document.querySelector('#settings-form').requestSubmit();`);
    assert.deepEqual(await run('schedules'), defaults);
    await run(`localStorage.setItem(SETTINGS_KEY,'invalid JSON');`);
    await call('Page.reload');
    await delay(1500);
    await app.ready();
    assert.deepEqual(await run('schedules'), defaults, 'Corrupt settings must fall back safely');
    if (kind === 'electron') {
      await call('Page.navigate', { url: pathToFileURL(path.join(root, 'index.html')).href });
      await delay(2500);
      await app.ready(false);
      assert.equal(await run(`getComputedStyle(startOverlay).display`), 'flex');
      await run(`startBtn.click()`, true);
      await delay(500);
      assert.equal(await run('isStarted'), true);
    }
    console.log(`${kind}: restart persistence, empty schedules, reset, corrupt-settings recovery${kind === 'electron' ? ' and web start flow' : ''} passed`);
  } finally {
    await app.close();
  }
}

const keepAlive = setInterval(() => {}, 1000);
test().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => clearInterval(keepAlive));
