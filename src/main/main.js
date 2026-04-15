const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, Notification } = require('electron');
const net = require('net');
const path = require('path');
const { PeerServer } = require(path.join(__dirname, '..', 'shared', 'peer-server.js'));
const { APIServer } = require(path.join(__dirname, '..', 'shared', 'api-server.js'));
const Store = require(path.join(__dirname, '..', 'shared', 'store.js'));

let mainWindow = null;
let tray = null;
let peerServer = null;
let apiServer = null;
let store = null;
let isQuitting = false;

const isDev = !app.isPackaged;
const gotSingleInstanceLock = app.requestSingleInstanceLock();

const NETWORK_TEST_HOST = 'portquiz.net';
const NETWORK_TEST_PORTS = [443, 8443, 8080, 3000, 5000, 9090, 8888, 4443, 80];
const PORT_TEST_TIMEOUT_MS = 1800;

function createAppIcon() {
  return nativeImage.createFromBuffer(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAADlJREFUOI1jYBhowEgqg/8TaQYjMQb8J9IMRlIMIBcwMTAwMPxHE/tPjAHYXEVxGFDsBeSGAQMDAwMAjbMHxTXDa00AAAAASUVORK5CYII=',
      'base64'
    )
  );
}

function testSinglePort(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;

    const finish = (status, code = null) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve({ port, status, code });
    };

    socket.setTimeout(PORT_TEST_TIMEOUT_MS);
    socket.once('connect', () => finish('open'));
    socket.once('timeout', () => finish('blocked', 'TIMEOUT'));
    socket.once('error', (err) => {
      const blockedCodes = new Set(['ETIMEDOUT', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'EACCES']);
      finish(blockedCodes.has(err.code) ? 'blocked' : 'error', err.code || 'UNKNOWN');
    });

    socket.connect(port, host);
  });
}

async function runPortDiagnostics() {
  const checks = await Promise.all(NETWORK_TEST_PORTS.map((port) => testSinglePort(NETWORK_TEST_HOST, port)));
  const openPorts = checks.filter((item) => item.status === 'open').map((item) => item.port);

  return {
    host: NETWORK_TEST_HOST,
    testedAt: Date.now(),
    checks,
    recommendedPort: openPorts[0] || 0,
    summary: {
      openCount: openPorts.length,
      blockedCount: checks.length - openPorts.length,
    },
  };
}

function showWindowsNotification(title, body = '') {
  if (process.platform !== 'win32') return false;
  if (!Notification.isSupported()) return false;

  const notification = new Notification({
    title: title || 'BlueTalk',
    body,
    icon: createAppIcon(),
    silent: false,
  });

  notification.on('click', () => showMainWindow());
  notification.show();
  return true;
}


function showMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  if (app.isReady()) {
    createWindow();
  }
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 860,
    minHeight: 560,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0a0f',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', (e) => {
    const minimizeToTray = store?.get('settings.minimizeToTray', true);
    if (!isQuitting && minimizeToTray) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

function createTray() {
  tray = new Tray(createAppIcon());
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open BlueTalk', click: () => showMainWindow() },
    { type: 'separator' },
    { label: 'Status: Online', enabled: false },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setToolTip('BlueTalk - P2P Chat');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => showMainWindow());
}

function setupIPC() {
  // Window controls
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle('window:close', () => mainWindow?.close());

  // Store operations
  ipcMain.handle('store:get', (_, key, defaultVal) => store.get(key, defaultVal));
  ipcMain.handle('store:set', (_, key, value) => store.set(key, value));
  ipcMain.handle('store:delete', (_, key) => store.delete(key));

  // Peer operations
  ipcMain.handle('peer:getInfo', () => peerServer.getInfo());
  ipcMain.handle('peer:connect', (_, address) => peerServer.connectTo(address));
  ipcMain.handle('peer:disconnect', (_, peerId) => peerServer.disconnectPeer(peerId));
  ipcMain.handle('peer:send', (_, peerId, data) => peerServer.sendTo(peerId, data));
  ipcMain.handle('peer:broadcast', (_, data) => peerServer.broadcast(data));
  ipcMain.handle('peer:getPeers', () => peerServer.getPeers());

  // File operations
  ipcMain.handle('file:host', (_, fileMeta) => peerServer.hostFile(fileMeta));
  ipcMain.handle('file:getHosted', () => peerServer.getHostedFiles());
  ipcMain.handle('file:request', (_, peerId, fileId) => peerServer.requestFile(peerId, fileId));

  // Windows system notifications
  ipcMain.handle('notify:show', (_, payload = {}) => {
    return showWindowsNotification(payload.title || 'BlueTalk', payload.body || '');
  });

  // Port diagnostics for restricted networks
  ipcMain.handle('network:testPorts', async () => {
    return runPortDiagnostics();
  });

  // Forward peer events to renderer
  const forwardEvents = [
    'peer:connected', 'peer:disconnected', 'peer:message',
    'peer:file-offered', 'peer:file-received', 'peer:discovered',
  ];
  for (const event of forwardEvents) {
    peerServer.on(event, (data) => {
      if (event === 'peer:message' && data?.from !== 'self') {
        const preview = data.kind === 'file'
          ? `Datei: ${data.fileName || data.content || 'Anhang'}`
          : (data.content || 'Neue Nachricht');
        showWindowsNotification(data.sender || data.from || 'BlueTalk', preview);
      }
      mainWindow?.webContents.send(event, data);
    });
  }
}

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });

  app.whenReady().then(() => {
    store = new Store({ configName: 'bluetalk-config' });
    peerServer = new PeerServer(store);
    apiServer = new APIServer(peerServer, store);

    createWindow();
    createTray();
    setupIPC();

    peerServer.start();
    apiServer.start(store.get('settings.apiPort', 19876));
  });
}

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') return;

  const keepInTray = store?.get('settings.minimizeToTray', true) && !isQuitting;
  if (keepInTray) return;

  peerServer?.stop();
  apiServer?.stop();
  app.quit();
});

app.on('activate', () => {
  showMainWindow();
});
