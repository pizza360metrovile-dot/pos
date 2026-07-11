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
    writeFileSync: async (filePath, data, options) => {
      const res = await ipcRenderer.invoke('fs:writeFileSync', filePath, data, options);
      if (res && res.error) throw new Error(res.error);
      return res;
    },
    readFileSync: async (filePath, options) => {
      const res = await ipcRenderer.invoke('fs:readFileSync', filePath, options);
      if (res && res.error) throw new Error(res.error);
      return res;
    },
    existsSync: async (filePath) => {
      return await ipcRenderer.invoke('fs:existsSync', filePath);
    },
    mkdirSync: async (filePath, options) => {
      const res = await ipcRenderer.invoke('fs:mkdirSync', filePath, options);
      if (res && res.error) throw new Error(res.error);
      return res;
    },
    readdirSync: async (filePath) => {
      return await ipcRenderer.invoke('fs:readdirSync', filePath);
    },
    unlinkSync: async (filePath) => {
      const res = await ipcRenderer.invoke('fs:unlinkSync', filePath);
      if (res && res.error) throw new Error(res.error);
      return res;
    },
    statSync: async (filePath) => {
      return await ipcRenderer.invoke('fs:statSync', filePath);
    },
  },
  path: {
    join: (...args) => ipcRenderer.sendSync('path:join', ...args), // Kept synchronous as it is an instantaneous string operation
  },
  app: {
    getPath: (name) => ipcRenderer.sendSync('app:getPath', name),   // Kept synchronous for instantaneous string bootstrapping
  }
});

window.addEventListener('DOMContentLoaded', () => {
  console.log('Saynz POS preload script loaded successfully.');
});