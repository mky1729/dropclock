# Drop Clock

A gentle break reminder clock, available as a web app and Windows desktop app.

## Electron

```sh
npm ci
npm start
npm run dist
```

The installer is generated in `dist/`.

## Tauri (Windows)

Install the stable MSVC Rust toolchain, Visual Studio's **Desktop development
with C++** workload (including the Windows SDK), and the WebView2 Runtime.
Restart your terminal after installing Rust so that `cargo` is on PATH.

```sh
npm ci
npm run tauri:dev
npm run tauri:build
```

The installer is generated in `src-tauri/target/release/bundle/nsis/`.
The standalone application is `src-tauri/target/release/drop-clock-tauri.exe`.
WebView2 is required to run the app; the installer can download it if missing.

The Tauri edition has its own application ID and the name **Drop Clock Tauri**,
so it can be installed alongside the Electron edition.
Both editions use the root `index.html` and the same icons. Tauri copies only
the required web assets into `.tauri-web/` before starting or building.
Restart `tauri:dev` after editing these shared web assets to refresh the copy.

Desktop editions start the clock and enable alarm audio automatically.
The web edition still requires clicking the start overlay to enable audio.
Use the settings button to edit alarm times, preview the sound, or restore
the initial schedule. Save applies the changes and stores them locally;
Cancel discards edits. An empty schedule disables all alarms. Settings are
independent for the web, Electron, and Tauri editions.

Styles and fonts currently load from the internet.
Closing the window exits the application; alarms do not wake a sleeping PC.

## Desktop Verification

After building both editions, run these checks with Node.js 22 or later on Windows:

```sh
node scripts/test-desktop.cjs electron
node scripts/test-desktop.cjs tauri
```

These launch the built applications with isolated profiles, verify automatic
audio initialization, schedule editing and persistence across restarts, and
save desktop and narrow-viewport screenshots in `dist/qa/`.
