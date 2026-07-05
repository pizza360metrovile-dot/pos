// preload.cjs
const { contextBridge } = require('electron');

// Expose protected APIs to renderer process
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  versions: process.versions,
  isElectron: true,
});