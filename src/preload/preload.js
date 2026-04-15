const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bluetalk', {
  // Window controls
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },

  // Store
  store: {
    get: (key, defaultVal) => ipcRenderer.invoke('store:get', key, defaultVal),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value),
    delete: (key) => ipcRenderer.invoke('store:delete', key),
  },

  // Peer networking
  peer: {
    getInfo: () => ipcRenderer.invoke('peer:getInfo'),
    connect: (address) => ipcRenderer.invoke('peer:connect', address),
    disconnect: (peerId) => ipcRenderer.invoke('peer:disconnect', peerId),
    send: (peerId, data) => ipcRenderer.invoke('peer:send', peerId, data),
    broadcast: (data) => ipcRenderer.invoke('peer:broadcast', data),
    getPeers: () => ipcRenderer.invoke('peer:getPeers'),
  },

  // File operations
  file: {
    host: (fileMeta) => ipcRenderer.invoke('file:host', fileMeta),
    getHosted: () => ipcRenderer.invoke('file:getHosted'),
    request: (peerId, fileId) => ipcRenderer.invoke('file:request', peerId, fileId),
  },

  // Native notifications
  notify: {
    show: (payload) => ipcRenderer.invoke('notify:show', payload),
  },

  // Network diagnostics
  network: {
    testPorts: () => ipcRenderer.invoke('network:testPorts'),
  },

  // Events from main process
  on: (channel, callback) => {
    const validChannels = [
      'peer:connected',
      'peer:disconnected',
      'peer:message',
      'peer:file-offered',
      'peer:file-received',
      'peer:discovered',
    ];
    if (validChannels.includes(channel)) {
      const listener = (_, ...args) => callback(...args);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    }
  },
});
