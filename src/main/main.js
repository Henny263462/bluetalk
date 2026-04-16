const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, Notification, dialog, session } = require('electron');
const fs = require('fs/promises');
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

app.setName('BlueTalk');
if (process.platform === 'win32') {
  app.setAppUserModelId(app.isPackaged ? 'com.bluetalk.app' : 'BlueTalk');
}

const NETWORK_TEST_HOST = 'portquiz.net';
const NETWORK_TEST_PORTS = [443, 8443, 8080, 3000, 5000, 9090, 8888, 4443, 80];
const PORT_TEST_TIMEOUT_MS = 1800;
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const APP_ICON_PATH = path.join(__dirname, '..', '..', 'assets', 'icon.png');
const CHAT_MESSAGE_BATCH_SIZE = 24;

/** GitHub release exists but `latest.yml` / blockmap not uploaded yet (electron-updater 404). */
const UPDATE_RELEASE_PENDING_MESSAGE =
  'The latest release does not include Windows update files yet—they may still be building or uploading. Try again in a few minutes.';

function isReleaseAssetsPendingError(error) {
  if (!error || typeof error !== 'object') return false;
  const code = error.code;
  if (code === 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND') return true;
  const status = error.statusCode ?? error.status;
  if (status === 404) return true;
  const msg = String(error.message || '').toLowerCase();
  if (msg.includes('status code 404')) return true;
  if (msg.includes('404')) {
    if (msg.includes('latest.yml') || msg.includes('releases/download') || msg.includes('not found')) {
      return true;
    }
  }
  return false;
}

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

function getStoredMessages() {
  return store?.get('messages', {}) || {};
}

function getStoredChatMessages(peerId) {
  const list = store?.get(`messages.${peerId}`, []);
  return Array.isArray(list) ? list : [];
}

function setStoredChatMessages(peerId, list) {
  if (!store || !peerId) return [];
  store.set(`messages.${peerId}`, list);
  return list;
}

function appendStoredChatMessage(peerId, message) {
  const current = getStoredChatMessages(peerId);
  const updated = [...current, message];
  setStoredChatMessages(peerId, updated);
  return updated;
}

function patchStoredChatMessage(peerId, messageId, patch) {
  if (!peerId || !messageId || !patch || typeof patch !== 'object') return false;
  const list = getStoredChatMessages(peerId);
  const idx = list.findIndex((m) => m && m.messageId === messageId);
  if (idx < 0) return false;
  list[idx] = { ...list[idx], ...patch };
  setStoredChatMessages(peerId, list);
  return true;
}

function deleteStoredChatMessage(peerId, messageId) {
  if (!peerId || !messageId) return false;
  const list = getStoredChatMessages(peerId);
  const idx = list.findIndex((m) => m && m.messageId === messageId);
  if (idx < 0) return false;
  list.splice(idx, 1);
  setStoredChatMessages(peerId, list);
  return true;
}

function getChatMessageMeta() {
  const storedMessages = getStoredMessages();
  const meta = {};

  for (const [peerId, rawMessages] of Object.entries(storedMessages)) {
    if (peerId === 'self') continue;
    const messages = Array.isArray(rawMessages) ? rawMessages : [];
    if (messages.length === 0) continue;

    meta[peerId] = {
      count: messages.length,
      lastMessage: messages[messages.length - 1] || null,
    };
  }

  return meta;
}

function getChatMessageBatch(peerId, options = {}) {
  const messages = getStoredChatMessages(peerId);
  const skip = Math.max(0, Number(options.skip) || 0);
  const limit = Math.max(1, Number(options.limit) || CHAT_MESSAGE_BATCH_SIZE);
  const total = messages.length;
  const end = Math.max(0, total - skip);
  const start = Math.max(0, end - limit);

  return {
    messages: messages.slice(start, end),
    total,
    remaining: start,
    hasMore: start > 0,
    batchSize: end - start,
  };
}

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
  // Assisted NSIS (oneClick: false) needs /D for silent updates or the wizard asks for a path.
  if (process.platform === 'win32' && app.isPackaged) {
    autoUpdater.installDirectory = path.dirname(process.execPath);
  }
  autoUpdater.disableWebInstaller = true;
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
    if (isReleaseAssetsPendingError(error)) {
      patchUpdateState({
        status: 'pending_build',
        message: UPDATE_RELEASE_PENDING_MESSAGE,
        errorMessage: '',
        availableVersion: '',
        downloadedVersion: '',
        releaseName: '',
        releaseDate: 0,
        lastCheckedAt: Date.now(),
      });
    } else {
      patchUpdateState({
        status: 'error',
        message: 'Update check failed.',
        errorMessage: error?.message || 'Unknown update error.',
        lastCheckedAt: Date.now(),
      });
    }
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
    if (isReleaseAssetsPendingError(error)) {
      patchUpdateState({
        status: 'pending_build',
        message: UPDATE_RELEASE_PENDING_MESSAGE,
        errorMessage: '',
        /* keep availableVersion / release info from update-available if present */
      });
    } else {
      patchUpdateState({
        status: 'error',
        message: 'Update download failed.',
        errorMessage: error?.message || 'Unknown download error.',
      });
    }
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
  // Silent NSIS (/S) + --force-run: no setup wizard; app restarts after install (Windows).
  autoUpdater.quitAndInstall(true, true);
  return true;
}

function installPendingUpdateOnQuit(_event, exitCode) {
  if (process.platform !== 'win32' || exitCode !== 0) return;
  const support = getUpdaterSupport();
  if (!support.supported) return;
  const prefs = getUpdaterPreferences();
  if (!prefs.autoUpdateEnabled) return;
  if (updateState.status !== 'downloaded') return;
  if (autoUpdater.quitAndInstallCalled) return;

  try {
    // Default electron-updater uses install(true, false) here — silent but no relaunch.
    autoUpdater.install(true, true);
  } catch (_err) {
    /* ignore */
  }
}

function setupAutoUpdater() {
  if (updaterReady) return;
  updaterReady = true;

  if (process.platform === 'win32') {
    autoUpdater.autoInstallOnAppQuit = false;
    app.on('quit', installPendingUpdateOnQuit);
  }

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
    if (isReleaseAssetsPendingError(error)) {
      patchUpdateState({
        status: 'pending_build',
        message: UPDATE_RELEASE_PENDING_MESSAGE,
        errorMessage: '',
        lastCheckedAt: Date.now(),
      });
    } else {
      patchUpdateState({
        status: 'error',
        message: 'Auto update error.',
        errorMessage: error?.message || 'Unknown update error.',
        lastCheckedAt: Date.now(),
      });
    }
  });

  configureAutoUpdater();
  scheduleAutoUpdateChecks();

  if (getUpdaterSupport().supported && getUpdaterPreferences().autoUpdateEnabled) {
    setTimeout(() => {
      void checkForAppUpdates('startup');
    }, 5000);
  }
}

function applyLaunchAtLoginSetting() {
  if (!store) return;
  const wantsLaunch = Boolean(store.get('settings.launchAtLogin', false) ?? false);
  const openAtLogin = app.isPackaged && wantsLaunch;
  try {
    app.setLoginItemSettings({
      openAtLogin,
      path: process.execPath,
    });
  } catch (err) {
    console.error('Launch at login:', err);
  }
}

function handleSettingsMutation() {
  configureAutoUpdater();
  scheduleAutoUpdateChecks();
  applyLaunchAtLoginSetting();
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
  if (store && store.get('settings.windowsNotifications', true) === false) {
    return false;
  }

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

const INCOMING_NOTIF_GROUP_MS = 2200;
let incomingNotifBatch = {
  senderLabel: '',
  previews: [],
  timer: null,
};

function flushIncomingNotificationBatch() {
  if (incomingNotifBatch.timer) {
    clearTimeout(incomingNotifBatch.timer);
    incomingNotifBatch.timer = null;
  }
  const { senderLabel, previews } = incomingNotifBatch;
  incomingNotifBatch.previews = [];
  incomingNotifBatch.senderLabel = '';
  if (!previews.length) return;

  if (previews.length === 1) {
    showWindowsNotification(senderLabel || 'BlueTalk', previews[0]);
    return;
  }

  showWindowsNotification(
    'BlueTalk',
    `You have ${previews.length} notifications from ${senderLabel || 'a contact'}`
  );
}

function queueIncomingChatNotification(data) {
  if (store && store.get('settings.windowsNotifications', true) === false) {
    return;
  }
  const senderLabel = data.sender || data.from || 'BlueTalk';
  const preview =
    data.kind === 'file'
      ? `File: ${data.fileName || data.content || 'Attachment'}`
      : (data.content || 'New message');

  if (incomingNotifBatch.senderLabel !== senderLabel) {
    flushIncomingNotificationBatch();
    incomingNotifBatch.senderLabel = senderLabel;
  }

  incomingNotifBatch.previews.push(preview);
  if (incomingNotifBatch.timer) {
    clearTimeout(incomingNotifBatch.timer);
  }
  incomingNotifBatch.timer = setTimeout(() => {
    flushIncomingNotificationBatch();
  }, INCOMING_NOTIF_GROUP_MS);
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

function broadcastWindowMaximized() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    mainWindow.webContents.send('window:maximized', mainWindow.isMaximized());
  } catch {
    /* webContents unavailable during teardown */
  }
}

/** Peers can connect before the renderer registers IPC listeners; push authoritative state after each load. */
function syncPeersToRenderer() {
  if (!mainWindow || mainWindow.isDestroyed() || !peerServer) return;
  try {
    mainWindow.webContents.send('peers:list-sync', peerServer.getPeers());
  } catch {
    /* webContents unavailable during teardown */
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
    broadcastWindowMaximized();
    syncPeersToRenderer();
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

  mainWindow.on('maximize', broadcastWindowMaximized);
  mainWindow.on('unmaximize', broadcastWindowMaximized);

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

async function clearRendererSessionCaches() {
  const targets = [session.defaultSession];
  if (mainWindow && !mainWindow.isDestroyed()) {
    const s = mainWindow.webContents.session;
    if (s && !targets.includes(s)) targets.push(s);
  }
  for (const s of targets) {
    try {
      await s.clearCache();
    } catch (e) {
      console.error('clearCache error:', e);
    }
    try {
      await s.clearStorageData();
    } catch (e) {
      console.error('clearStorageData error:', e);
    }
  }
}

async function wipeAllLocalAppData() {
  if (!store || !peerServer || !apiServer) {
    return { ok: false, error: 'not_ready' };
  }
  try {
    apiServer.stop();
    peerServer.stop();
    await store.clearAll();
    peerServer.reloadIdentityFromStore();
    await peerServer.start();
    apiServer.start(store.get('settings.apiPort', 19876));
    handleSettingsMutation();
    mainWindow?.webContents?.send('peers:list-sync', []);
    mainWindow?.webContents?.send('app:data-cleared', { kind: 'all' });
    return { ok: true };
  } catch (e) {
    console.error('wipeAllLocalAppData error:', e);
    return { ok: false, error: e?.message || 'wipe_failed' };
  }
}

async function clearStoredChatMessagesOnly() {
  if (!store) return { ok: false, error: 'not_ready' };
  try {
    store.delete('messages');
    mainWindow?.webContents?.send('app:data-cleared', { kind: 'messages' });
    return { ok: true };
  } catch (e) {
    console.error('clearStoredChatMessagesOnly error:', e);
    return { ok: false, error: e?.message || 'clear_messages_failed' };
  }
}

function setupIPC() {
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);
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

  ipcMain.handle('messages:getMeta', () => getChatMessageMeta());
  ipcMain.handle('messages:getBatch', (_, peerId, options = {}) => getChatMessageBatch(peerId, options));
  ipcMain.handle('messages:append', (_, peerId, message) => {
    appendStoredChatMessage(peerId, message);
    return getChatMessageMeta()[peerId] || { count: 0, lastMessage: null };
  });
  ipcMain.handle('messages:patch', (_, peerId, messageId, patch) =>
    patchStoredChatMessage(peerId, messageId, patch)
  );
  ipcMain.handle('messages:deleteMessage', (_, peerId, messageId) =>
    deleteStoredChatMessage(peerId, messageId)
  );
  ipcMain.handle('messages:deleteChat', (_, peerId) => {
    store.delete(`messages.${peerId}`);
    return true;
  });

  ipcMain.handle('peer:getInfo', () => peerServer.getInfo());
  ipcMain.handle('peer:connect', (_, address) => peerServer.connectTo(address));
  ipcMain.handle('peer:disconnect', (_, peerId) => peerServer.disconnectPeer(peerId));
  ipcMain.handle('peer:send', (_, peerId, data) => peerServer.sendTo(peerId, data));
  ipcMain.handle('peer:broadcast', (_, data) => peerServer.broadcast(data));
  ipcMain.handle('peer:getPeers', () => peerServer.getPeers());
  ipcMain.handle('peer:refreshDiscovery', () => {
    peerServer.refreshDiscovery();
  });

  ipcMain.handle('file:host', (_, fileMeta) => peerServer.hostFile(fileMeta));
  ipcMain.handle('file:getHosted', () => peerServer.getHostedFiles());
  ipcMain.handle('file:request', (_, peerId, fileId) => peerServer.requestFile(peerId, fileId));
  try {
    ipcMain.removeHandler('file:saveAs');
  } catch {
    /* ignore if not registered */
  }
  ipcMain.handle('file:saveAs', async (_, { defaultFilename, base64 } = {}) => {
    if (typeof base64 !== 'string' || !base64.length) {
      return { ok: false, error: 'invalid_payload' };
    }
    const name =
      typeof defaultFilename === 'string' && defaultFilename.trim() ? defaultFilename.trim() : 'download';
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: name,
      filters: [{ name: 'All Files', extensions: ['*'] }],
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    try {
      await fs.writeFile(filePath, Buffer.from(base64, 'base64'));
      return { ok: true, filePath };
    } catch (e) {
      return { ok: false, error: e?.message || 'write_failed' };
    }
  });

  ipcMain.handle('notify:show', (_, payload = {}) => {
    if (store && store.get('settings.windowsNotifications', true) === false) {
      return false;
    }
    return showWindowsNotification(payload.title || 'BlueTalk', payload.body || '');
  });

  ipcMain.handle('network:testPorts', async () => runPortDiagnostics());

  ipcMain.handle('updater:getState', () => patchUpdateState());
  ipcMain.handle('updater:check', async () => checkForAppUpdates('manual'));
  ipcMain.handle('updater:download', async () => downloadAppUpdate());
  ipcMain.handle('updater:install', () => installDownloadedUpdate());

  ipcMain.handle('app:clearCache', async () => {
    try {
      await clearRendererSessionCaches();
      return { ok: true };
    } catch (e) {
      console.error('app:clearCache error:', e);
      return { ok: false, error: e?.message || 'clear_cache_failed' };
    }
  });

  ipcMain.handle('app:clearMessages', () => clearStoredChatMessagesOnly());

  ipcMain.handle('app:wipeAllData', () => wipeAllLocalAppData());

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
      if (event === 'peer:message' && data?.from !== 'self' && data?.kind !== 'profile') {
        if (data.kind !== 'delivery-receipt' && data.kind !== 'read-receipt') {
          queueIncomingChatNotification(data);
        }
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
    applyLaunchAtLoginSetting();

    peerServer.start().then(() => {
      // Proactively reconnect to all known contacts on startup
      const contacts = store.get('contacts', []);
      if (Array.isArray(contacts)) {
        for (const contact of contacts) {
          if (!contact?.id || !contact.address) continue;
          peerServer.connectTo(contact.address).catch(() => {});
        }
      }
    });
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
