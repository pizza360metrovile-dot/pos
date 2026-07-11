/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const { app, BrowserWindow, session, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

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

// IPC handlers for main process management
ipcMain.on('restart-app', () => {
  app.relaunch();
  app.quit();
});

// Asynchronous Non-blocking Filesystem Handlers
ipcMain.handle('fs:writeFileSync', async (event, filePath, data, options) => {
  try {
    fs.writeFileSync(filePath, data, options);
    return true;
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('fs:readFileSync', async (event, filePath, options) => {
  try {
    return fs.readFileSync(filePath, options);
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('fs:existsSync', async (event, filePath) => {
  try {
    return fs.existsSync(filePath);
  } catch (err) {
    return false;
  }
});

ipcMain.handle('fs:mkdirSync', async (event, filePath, options) => {
  try {
    fs.mkdirSync(filePath, options);
    return true;
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('fs:readdirSync', async (event, filePath) => {
  try {
    return fs.readdirSync(filePath);
  } catch (err) {
    return [];
  }
});

ipcMain.handle('fs:unlinkSync', async (event, filePath) => {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('fs:statSync', async (event, filePath) => {
  try {
    const stats = fs.statSync(filePath);
    return {
      mtimeMs: stats.mtimeMs,
      birthtimeMs: stats.birthtimeMs,
    };
  } catch (err) {
    return { mtimeMs: 0, birthtimeMs: 0 };
  }
});

// Low-overhead string utility channels (safe to keep synchronous)
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

// Async Window Dialog handlers
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
      preload: path.join(__dirname, 'preload.cjs'), // Securely matches the exact preload filename
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

  if (process.env.NODE_ENV === 'production') {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    mainWindow.loadURL('http://localhost:3000');
  }
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