// Preload script - runs in renderer context before page loads
const { contextBridge } = require('electron');

// Expose safe APIs to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    isElectron: true
});

// Log when preload runs
console.log('UniversalPOS Electron preload script loaded');
