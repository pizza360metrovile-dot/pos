/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const { app, BrowserWindow, session, ipcMain, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

// Register custom scheme as secure so your built assets are allowed to load correctly
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      corsEnabled: true
    }
  }
]);

// Create backups directory if not exists
app.whenReady().then(() => {
  try {
    const backupDir = path.join(app.getPath('userData'), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
  } catch (err) {
    console.error('Failed to initialize backup directory on startup:', err);
  }
});

// IPC handlers for main process
ipcMain.on('restart-app', () => {
  app.relaunch();
  app.quit();
});

// Safe sync FS handlers
ipcMain.on('fs:writeFileSync', (event, filePath, data, options) => {
  try {
    fs.writeFileSync(filePath, data, options);
    event.returnValue = true;
  } catch (err) {
    event.returnValue = { error: err.message };
  }
});

ipcMain.on('fs:readFileSync', (event, filePath, options) => {
  try {
    fs.readFileSync(filePath, options);
    event.returnValue = data;
  } catch (err) {
    event.returnValue = { error: err.message };
  }
});

ipcMain.on('fs:existsSync', (event, filePath) => {
  try {
    event.returnValue = fs.existsSync(filePath);
  } catch (err) {
    event.returnValue = false;
  }
});

ipcMain.on('fs:mkdirSync', (event, filePath, options) => {
  try {
    fs.mkdirSync(filePath, options);
    event.returnValue = true;
  } catch (err) {
    event.returnValue = { error: err.message };
  }
});

ipcMain.on('fs:readdirSync', (event, filePath) => {
  try {
    event.returnValue = fs.readdirSync(filePath);
  } catch (err) {
    event.returnValue = [];
  }
});

ipcMain.on('fs:unlinkSync', (event, filePath) => {
  try {
    fs.unlinkSync(filePath);
    event.returnValue = true;
  } catch (err) {
    event.returnValue = { error: err.message };
  }
});

ipcMain.on('fs:statSync', (event, filePath) => {
  try {
    const stats = fs.statSync(filePath);
    event.returnValue = {
      mtimeMs: stats.mtimeMs,
      birthtimeMs: stats.birthtimeMs,
    };
  } catch (err) {
    event.returnValue = { mtimeMs: 0, birthtimeMs: 0 };
  }
});

ipcMain.on('path:join', (event, ...args) => {
  event.returnValue = path.join(...args);
});

ipcMain.on('app:getPath', (event, name) => {
  try {
    event.returnValue = app.getPath(name);
  } catch (err) {
    event.returnValue = '';
  }
});

// Async Dialog handlers
ipcMain.handle('dialog:showSaveDialog', async (event, options) => {
  const win = BrowserWindow.getFocusedWindow();
  return await dialog.showSaveDialog(win, options);
});

ipcMain.handle('dialog:showOpenDialog', async (event, options) => {
  const win = BrowserWindow.getFocusedWindow();
  return await dialog.showOpenDialog(win, options);
});

ipcMain.handle('dialog:showMessageBox', async (event, options) => {
  const win = BrowserWindow.getFocusedWindow();
  return await dialog.showMessageBox(win, options);
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    }
  });

  // Intercept headers and inject standard CSP that allows connections to Firebase domains
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "font-src 'self' https://fonts.gstatic.com; " +
          "connect-src 'self' https://firestore.googleapis.com https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://dns.google https://1.1.1.1 ws://localhost:* wss://localhost:*; " +
          "img-src 'self' data: https:; " +
          "media-src 'self'; " +
          "frame-src 'self';"
        ]
      }
    });
  });

  // Use app.isPackaged to reliably load local assets in production
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    mainWindow.loadURL('http://localhost:3000');
  }

  // Set up auto-updater events once the window is initialized
  setupAutoUpdater(mainWindow);
}

function setupAutoUpdater(mainWindow) {
  // Guard against running auto-updater in local development mode
  if (!app.isPackaged) return;

  // Configure update checks
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Check on app launch
  autoUpdater.checkForUpdatesAndNotify();

  // Check for updates periodically (every 10 minutes)
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 10 * 60 * 1000);

  // When update is ready, ask user to restart
  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'A new version has been downloaded. Restart the app to apply the update?',
      buttons: ['Restart Now', 'Later']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  // Optional: Log errors if updates fail
  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
  });
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