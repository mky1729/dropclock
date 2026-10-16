const { app, BrowserWindow } = require('electron');
const path = require('path');

const APP_ID = 'com.dropclock.app';

app.setAppUserModelId(APP_ID);

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 520,
    height: 780,
    minWidth: 420,
    minHeight: 620,
    title: 'Drop Clock',
    icon: path.join(__dirname, '..', 'files', 'favicon.ico'),
    backgroundColor: '#e0c3fc',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
