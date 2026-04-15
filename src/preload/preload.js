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

  messages: {
    getMeta: () => ipcRenderer.invoke('messages:getMeta'),
    getBatch: (peerId, options) => ipcRenderer.invoke('messages:getBatch', peerId, options),
    append: (peerId, message) => ipcRenderer.invoke('messages:append', peerId, message),
    deleteChat: (peerId) => ipcRenderer.invoke('messages:deleteChat', peerId),
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

  // Auto updater
  updater: {
    getState: () => ipcRenderer.invoke('updater:getState'),
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
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
      'updater:state',
    ];
    if (validChannels.includes(channel)) {
      const listener = (_, ...args) => callback(...args);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    }
  },
});
