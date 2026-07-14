/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(event, ...args)),
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  },
  dialog: {
    showSaveDialog: (options) => ipcRenderer.invoke('dialog:showSaveDialog', options),
    showOpenDialog: (options) => ipcRenderer.invoke('dialog:showOpenDialog', options),
    showMessageBox: (options) => ipcRenderer.invoke('dialog:showMessageBox', options),
  },
  fs: {
    writeFileSync: (filePath, data, options) => {
      const res = ipcRenderer.sendSync('fs:writeFileSync', filePath, data, options);
      if (res && res.error) throw new Error(res.error);
      return res;
    },
    readFileSync: (filePath, options) => {
      const res = ipcRenderer.sendSync('fs:readFileSync', filePath, options);
      if (res && res.error) throw new Error(res.error);
      return res;
    },
    existsSync: (filePath) => ipcRenderer.sendSync('fs:existsSync', filePath),
    mkdirSync: (filePath, options) => {
      const res = ipcRenderer.sendSync('fs:mkdirSync', filePath, options);
      if (res && res.error) throw new Error(res.error);
      return res;
    },
    readdirSync: (filePath) => ipcRenderer.sendSync('fs:readdirSync', filePath),
    unlinkSync: (filePath) => {
      const res = ipcRenderer.sendSync('fs:unlinkSync', filePath);
      if (res && res.error) throw new Error(res.error);
      return res;
    },
    statSync: (filePath) => ipcRenderer.sendSync('fs:statSync', filePath),
  },
  path: {
    join: (...args) => ipcRenderer.sendSync('path:join', ...args),
  },
  app: {
    getPath: (name) => ipcRenderer.sendSync('app:getPath', name),
  }
});

window.addEventListener('DOMContentLoaded', () => {
  console.log('Saynz POS preload script loaded successfully.');
});
