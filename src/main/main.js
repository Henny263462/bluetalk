const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, Notification } = require('electron');
const { autoUpdater } = require('electron-updater');
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
let updateCheckTimer = null;
let updaterReady = false;

const isDev = !app.isPackaged;
const gotSingleInstanceLock = app.requestSingleInstanceLock();

const NETWORK_TEST_HOST = 'portquiz.net';
const NETWORK_TEST_PORTS = [443, 8443, 8080, 3000, 5000, 9090, 8888, 4443, 80];
const PORT_TEST_TIMEOUT_MS = 1800;
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const APP_ICON_PATH = path.join(__dirname, '..', '..', 'assets', 'icon.png');

let updateState = {
  supported: false,
  status: 'idle',
  message: '',
  errorMessage: '',
  currentVersion: app.getVersion(),
  availableVersion: '',
  downloadedVersion: '',
  releaseName: '',
  releaseDate: 0,
  autoUpdateEnabled: true,
  autoDownloadUpdates: true,
  percent: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  bytesPerSecond: 0,
  lastCheckedAt: 0,
};

let appIcon = null;

function createAppIcon(size) {
  if (!appIcon || appIcon.isEmpty()) {
    appIcon = nativeImage.createFromPath(APP_ICON_PATH);
  }

  if (!appIcon || appIcon.isEmpty()) {
    return nativeImage.createEmpty();
  }

  if (!size) {
    return appIcon;
  }

  return appIcon.resize({ width: size, height: size, quality: 'best' });
}

function getUpdaterSupport() {
  if (isDev) {
    return {
      supported: false,
      reason: 'Auto updates are only available in packaged builds.',
    };
  }

  if (process.platform === 'win32' && (process.env.PORTABLE_EXECUTABLE_FILE || process.env.PORTABLE_EXECUTABLE_DIR)) {
    return {
      supported: false,
      reason: 'Portable builds cannot self-update. Install the NSIS release to use auto updates.',
    };
  }

  return { supported: true, reason: '' };
}

function getUpdaterPreferences() {
  return {
    autoUpdateEnabled: store?.get('settings.autoUpdateEnabled', true) ?? true,
    autoDownloadUpdates: store?.get('settings.autoDownloadUpdates', true) ?? true,
  };
}

function serializeUpdateInfo(info = {}) {
  return {
    availableVersion: info.version || '',
    releaseName: info.releaseName || info.version || '',
    releaseDate: info.releaseDate ? new Date(info.releaseDate).getTime() : 0,
  };
}

function broadcastUpdateState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('updater:state', updateState);
}

function patchUpdateState(patch = {}) {
  const support = getUpdaterSupport();
  const prefs = getUpdaterPreferences();

  updateState = {
    ...updateState,
    currentVersion: app.getVersion(),
    supported: support.supported,
    autoUpdateEnabled: prefs.autoUpdateEnabled,
    autoDownloadUpdates: prefs.autoDownloadUpdates,
    ...patch,
  };

  if (!support.supported) {
    updateState = {
      ...updateState,
      status: 'unsupported',
      message: support.reason,
      errorMessage: '',
      availableVersion: '',
      downloadedVersion: '',
      releaseName: '',
      releaseDate: 0,
      percent: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      bytesPerSecond: 0,
    };
  }

  broadcastUpdateState();
  return updateState;
}

function configureAutoUpdater() {
  const support = getUpdaterSupport();
  if (!support.supported) {
    patchUpdateState();
    return false;
  }

  const prefs = getUpdaterPreferences();
  autoUpdater.autoDownload = prefs.autoDownloadUpdates;
  autoUpdater.autoInstallOnAppQuit = true;
  patchUpdateState();
  return true;
}

function scheduleAutoUpdateChecks() {
  if (updateCheckTimer) {
    clearInterval(updateCheckTimer);
    updateCheckTimer = null;
  }

  const support = getUpdaterSupport();
  const prefs = getUpdaterPreferences();
  if (!support.supported || !prefs.autoUpdateEnabled) {
    patchUpdateState();
    return;
  }

  updateCheckTimer = setInterval(() => {
    void checkForAppUpdates('background');
  }, UPDATE_CHECK_INTERVAL_MS);
}

async function checkForAppUpdates(source = 'manual') {
  const support = getUpdaterSupport();
  if (!support.supported) {
    return patchUpdateState();
  }

  const prefs = getUpdaterPreferences();
  if (source !== 'manual' && !prefs.autoUpdateEnabled) {
    return patchUpdateState();
  }

  configureAutoUpdater();

  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    patchUpdateState({
      status: 'error',
      message: 'Update check failed.',
      errorMessage: error?.message || 'Unknown update error.',
      lastCheckedAt: Date.now(),
    });
  }

  return updateState;
}

async function downloadAppUpdate() {
  const support = getUpdaterSupport();
  if (!support.supported) {
    return patchUpdateState();
  }

  if (updateState.status === 'downloaded' || updateState.status === 'downloading') {
    return updateState;
  }

  try {
    await autoUpdater.downloadUpdate();
  } catch (error) {
    patchUpdateState({
      status: 'error',
      message: 'Update download failed.',
      errorMessage: error?.message || 'Unknown download error.',
    });
  }

  return updateState;
}

function installDownloadedUpdate() {
  const support = getUpdaterSupport();
  if (!support.supported || updateState.status !== 'downloaded') {
    return false;
  }

  isQuitting = true;
  peerServer?.stop();
  apiServer?.stop();
  autoUpdater.quitAndInstall(false, true);
  return true;
}

function setupAutoUpdater() {
  if (updaterReady) return;
  updaterReady = true;

  autoUpdater.on('checking-for-update', () => {
    patchUpdateState({
      status: 'checking',
      message: 'Checking for updates...',
      errorMessage: '',
      percent: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      bytesPerSecond: 0,
    });
  });

  autoUpdater.on('update-available', (info) => {
    patchUpdateState({
      ...serializeUpdateInfo(info),
      status: 'available',
      message: autoUpdater.autoDownload
        ? 'Update found. Downloading now...'
        : 'Update found. Ready to download.',
      errorMessage: '',
      percent: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      bytesPerSecond: 0,
      lastCheckedAt: Date.now(),
    });
  });

  autoUpdater.on('update-not-available', () => {
    patchUpdateState({
      status: 'idle',
      message: 'BlueTalk is up to date.',
      errorMessage: '',
      availableVersion: '',
      downloadedVersion: '',
      releaseName: '',
      releaseDate: 0,
      percent: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      bytesPerSecond: 0,
      lastCheckedAt: Date.now(),
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    patchUpdateState({
      status: 'downloading',
      message: `Downloading update... ${Math.round(progress.percent || 0)}%`,
      percent: Number((progress.percent || 0).toFixed(1)),
      downloadedBytes: progress.transferred || 0,
      totalBytes: progress.total || 0,
      bytesPerSecond: progress.bytesPerSecond || 0,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    patchUpdateState({
      ...serializeUpdateInfo(info),
      status: 'downloaded',
      message: 'Update downloaded. Restart BlueTalk to install it.',
      downloadedVersion: info.version || updateState.availableVersion || '',
      percent: 100,
      downloadedBytes: updateState.totalBytes || updateState.downloadedBytes,
      lastCheckedAt: Date.now(),
    });
  });

  autoUpdater.on('error', (error) => {
    patchUpdateState({
      status: 'error',
      message: 'Auto update error.',
      errorMessage: error?.message || 'Unknown update error.',
      lastCheckedAt: Date.now(),
    });
  });

  configureAutoUpdater();
  scheduleAutoUpdateChecks();

  if (getUpdaterSupport().supported && getUpdaterPreferences().autoUpdateEnabled) {
    setTimeout(() => {
      void checkForAppUpdates('startup');
    }, 5000);
  }
}

function handleSettingsMutation() {
  configureAutoUpdater();
  scheduleAutoUpdateChecks();
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
    icon: createAppIcon(256),
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

  mainWindow.webContents.on('did-finish-load', () => {
    broadcastUpdateState();
  });

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
  tray = new Tray(createAppIcon(32));
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
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle('window:close', () => mainWindow?.close());

  ipcMain.handle('store:get', (_, key, defaultVal) => store.get(key, defaultVal));
  ipcMain.handle('store:set', (_, key, value) => {
    store.set(key, value);
    if (key === 'settings' || key.startsWith('settings.')) {
      handleSettingsMutation();
    }
    return true;
  });
  ipcMain.handle('store:delete', (_, key) => {
    store.delete(key);
    if (key === 'settings' || key.startsWith('settings.')) {
      handleSettingsMutation();
    }
    return true;
  });

  ipcMain.handle('peer:getInfo', () => peerServer.getInfo());
  ipcMain.handle('peer:connect', (_, address) => peerServer.connectTo(address));
  ipcMain.handle('peer:disconnect', (_, peerId) => peerServer.disconnectPeer(peerId));
  ipcMain.handle('peer:send', (_, peerId, data) => peerServer.sendTo(peerId, data));
  ipcMain.handle('peer:broadcast', (_, data) => peerServer.broadcast(data));
  ipcMain.handle('peer:getPeers', () => peerServer.getPeers());

  ipcMain.handle('file:host', (_, fileMeta) => peerServer.hostFile(fileMeta));
  ipcMain.handle('file:getHosted', () => peerServer.getHostedFiles());
  ipcMain.handle('file:request', (_, peerId, fileId) => peerServer.requestFile(peerId, fileId));

  ipcMain.handle('notify:show', (_, payload = {}) => {
    return showWindowsNotification(payload.title || 'BlueTalk', payload.body || '');
  });

  ipcMain.handle('network:testPorts', async () => runPortDiagnostics());

  ipcMain.handle('updater:getState', () => patchUpdateState());
  ipcMain.handle('updater:check', async () => checkForAppUpdates('manual'));
  ipcMain.handle('updater:download', async () => downloadAppUpdate());
  ipcMain.handle('updater:install', () => installDownloadedUpdate());

  const forwardEvents = [
    'peer:connected',
    'peer:disconnected',
    'peer:message',
    'peer:file-offered',
    'peer:file-received',
    'peer:discovered',
  ];

  for (const event of forwardEvents) {
    peerServer.on(event, (data) => {
      if (event === 'peer:message' && data?.from !== 'self') {
        const preview = data.kind === 'file'
          ? `File: ${data.fileName || data.content || 'Attachment'}`
          : (data.content || 'New message');
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
    setupAutoUpdater();

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
