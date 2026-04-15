import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
import {
  ArrowUpCircle,
  Bell,
  Cable,
  Check,
  Copy,
  Download,
  Globe,
  Moon,
  Network,
  RefreshCw,
  RotateCw,
  Server,
  Settings2,
  Sun,
  TestTube2,
  User,
} from 'lucide-react';

function formatDateTime(timestamp) {
  if (!timestamp) return 'Never';
  return new Date(timestamp).toLocaleString();
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getUpdateStatusLabel(state) {
  switch (state?.status) {
    case 'unsupported':
      return 'Unavailable';
    case 'checking':
      return 'Checking';
    case 'available':
      return 'Update found';
    case 'downloading':
      return 'Downloading';
    case 'downloaded':
      return 'Ready to install';
    case 'error':
      return 'Error';
    default:
      return 'Idle';
  }
}

function getUpdateBadgeClass(state) {
  switch (state?.status) {
    case 'available':
    case 'downloading':
      return 'badge-blue';
    case 'downloaded':
      return 'badge-success';
    case 'error':
      return 'badge-danger';
    default:
      return 'badge-muted';
  }
}

export default function SettingsPage() {
  const { settings, updateSettings, peers, theme, toggleTheme } = useApp();
  const [peerInfo, setPeerInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  const [local, setLocal] = useState(settings);
  const [portDiagnostics, setPortDiagnostics] = useState(null);
  const [testingPorts, setTestingPorts] = useState(false);
  const [updaterState, setUpdaterState] = useState(null);
  const [updateAction, setUpdateAction] = useState('');

  useEffect(() => {
    setLocal(settings);
  }, [settings]);

  useEffect(() => {
    const fetchInfo = async () => {
      if (!window.bluetalk) return;
      const info = await window.bluetalk.peer.getInfo();
      setPeerInfo(info);
    };

    fetchInfo();
    const interval = setInterval(fetchInfo, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!window.bluetalk?.updater) return undefined;

    let mounted = true;
    let unsubscribe = null;

    const loadUpdater = async () => {
      const state = await window.bluetalk.updater.getState();
      if (mounted) {
        setUpdaterState(state);
      }

      unsubscribe = window.bluetalk.on('updater:state', (nextState) => {
        if (mounted) {
          setUpdaterState(nextState);
        }
      });
    };

    loadUpdater();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const change = (key, value) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
    updateSettings({ [key]: value });
  };

  const copyAddress = () => {
    const endpoint = peerInfo?.endpoints?.[0] || (
      peerInfo?.addresses?.[0] && peerInfo?.port
        ? `${peerInfo.addresses[0]}:${peerInfo.port}`
        : ''
    );

    if (!endpoint) return;

    navigator.clipboard?.writeText(endpoint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const testNetworkPorts = async () => {
    if (!window.bluetalk?.network?.testPorts || testingPorts) return;

    setTestingPorts(true);
    try {
      const diagnostics = await window.bluetalk.network.testPorts();
      setPortDiagnostics(diagnostics);

      const openPorts = diagnostics?.checks?.filter((item) => item.status === 'open') || [];
      const recommended = diagnostics?.recommendedPort || 0;
      if (openPorts.length > 0 && recommended && local.apiPort !== recommended) {
        change('apiPort', recommended);
      }

      if (window.bluetalk?.notify?.show) {
        const title = openPorts.length > 0
          ? 'BlueTalk network test complete'
          : 'BlueTalk network test finished';
        const body = openPorts.length > 0
          ? `Recommended port: ${recommended}`
          : 'No open standard ports detected.';
        window.bluetalk.notify.show({ title, body });
      }
    } catch {
      window.bluetalk?.notify?.show?.({
        title: 'BlueTalk network test failed',
        body: 'The port probe could not be completed.',
      });
    } finally {
      setTestingPorts(false);
    }
  };

  const runUpdaterAction = async (action, fn) => {
    if (!window.bluetalk?.updater || updateAction) return;

    setUpdateAction(action);
    try {
      const nextState = await fn();
      if (nextState && typeof nextState === 'object') {
        setUpdaterState(nextState);
      }
    } finally {
      setUpdateAction('');
    }
  };

  const checkForUpdates = () => runUpdaterAction('check', () => window.bluetalk.updater.check());
  const downloadUpdate = () => runUpdaterAction('download', () => window.bluetalk.updater.download());
  const installUpdate = () => runUpdaterAction('install', () => window.bluetalk.updater.install());

  const isCheckingUpdates = updateAction === 'check' || updaterState?.status === 'checking';
  const isDownloadingUpdate = updateAction === 'download' || updaterState?.status === 'downloading';
  const updateProgress = Math.max(0, Math.min(100, updaterState?.percent || 0));
  const latestVersion = updaterState?.downloadedVersion || updaterState?.availableVersion || '-';
  const showManualDownload = updaterState?.supported && (
    (!updaterState?.autoDownloadUpdates && updaterState?.status === 'available') ||
    (updaterState?.status === 'error' && Boolean(updaterState?.availableVersion))
  );
  const showInstallAction = updaterState?.supported && updaterState?.status === 'downloaded';

  return (
    <div className="page">
      <div className="page-header">
        <h1><Settings2 size={18} style={{ marginRight: 8, verticalAlign: 'text-top' }} />Settings</h1>
        <p>Configure your BlueTalk instance</p>
      </div>

      <div className="page-body">
        <section style={{ marginBottom: 28 }}>
          <div className="section-title">
            <h3><User size={14} />Identity</h3>
          </div>
          <div className="card flex flex-col gap-3">
            <div className="input-group">
              <label>Display Name</label>
              <input
                className="input"
                value={local.displayName || ''}
                onChange={(e) => change('displayName', e.target.value)}
                placeholder="Your name"
              />
            </div>
            {peerInfo && (
              <div className="input-group">
                <label>Peer ID</label>
                <input className="input font-mono" value={peerInfo.id || ''} readOnly style={{ color: 'var(--fg-2)' }} />
              </div>
            )}
          </div>
        </section>

        <section style={{ marginBottom: 28 }}>
          <div className="section-title">
            <h3><Network size={14} />Network</h3>
          </div>
          <div className="card flex flex-col gap-3">
            {peerInfo && (
              <>
                <div className="input-group">
                  <label>Your Primary Address</label>
                  <div className="flex gap-2">
                    <input
                      className="input font-mono"
                      value={peerInfo?.endpoints?.[0] || (peerInfo?.addresses?.[0] ? `${peerInfo.addresses[0]}:${peerInfo.port}` : 'Detecting...')}
                      readOnly
                      style={{ color: 'var(--fg-1)' }}
                    />
                    <button className="btn btn-secondary btn-icon" onClick={copyAddress} title="Copy address">
                      {copied ? <Check size={15} /> : <Copy size={15} />}
                    </button>
                  </div>
                </div>

                <div className="input-group">
                  <label>Listening Ports</label>
                  <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                    {(peerInfo?.ports?.length ? peerInfo.ports : [peerInfo.port]).map((port) => (
                      <span key={port} className="badge badge-default">{port}</span>
                    ))}
                  </div>
                </div>

                <div className="input-group">
                  <label>Reachable Endpoints</label>
                  <div className="code-block" style={{ marginTop: 0 }}>
                    {(peerInfo?.endpoints?.length ? peerInfo.endpoints : ['Detecting...']).map((endpoint) => (
                      <div key={endpoint}>{endpoint}</div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="input-group">
              <label>API Port</label>
              <input
                className="input font-mono"
                type="number"
                value={local.apiPort || 19876}
                onChange={(e) => change('apiPort', parseInt(e.target.value, 10) || 19876)}
              />
            </div>

            <div className="input-group">
              <label>Port Test</label>
              <div className="flex gap-2" style={{ alignItems: 'center' }}>
                <button
                  className="btn btn-secondary"
                  onClick={testNetworkPorts}
                  disabled={testingPorts}
                  title="Test common ports in restrictive networks"
                >
                  <TestTube2 size={15} />
                  {testingPorts ? 'Testing ports...' : 'Test ports'}
                </button>
                {portDiagnostics?.recommendedPort ? (
                  <span className="badge badge-success">Recommended: {portDiagnostics.recommendedPort}</span>
                ) : (
                  <span className="badge badge-muted">No recommendation</span>
                )}
              </div>

              {portDiagnostics && (
                <div className="code-block" style={{ marginTop: 8 }}>
                  <div><Globe size={13} style={{ display: 'inline-block', marginRight: 6, verticalAlign: 'text-top' }} />Host: {portDiagnostics.host}</div>
                  <div style={{ marginTop: 4 }}>
                    {portDiagnostics.checks.map((check) => (
                      <div key={check.port}>
                        <Cable size={12} style={{ display: 'inline-block', marginRight: 6, verticalAlign: 'text-top' }} />
                        Port {check.port}: {check.status === 'open' ? 'open' : 'blocked'}
                        {check.code ? ` (${check.code})` : ''}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium" style={{ fontSize: 13 }}>Connected Peers</span>
                <span className="badge badge-default">{peers.length}</span>
              </div>
              {peers.length === 0 ? (
                <p className="text-sm text-muted">BlueTalk discovers peers on the local network and can test multiple ports in parallel.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {peers.map((peer) => (
                    <div key={peer.id} className="flex items-center gap-2" style={{ fontSize: 12.5 }}>
                      <span className="online-dot" />
                      <span className="font-medium">{peer.name}</span>
                      <span className="font-mono text-muted">{peer.address}:{peer.port}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section style={{ marginBottom: 28 }}>
          <div className="section-title">
            <h3><ArrowUpCircle size={14} />Updates</h3>
          </div>
          <div className="card">
            <div className="toggle-row">
              <div className="toggle-row-info">
                <span>Automatic update checks</span>
                <span>Poll GitHub Releases in the background for packaged installs</span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={local.autoUpdateEnabled ?? true}
                  onChange={(e) => change('autoUpdateEnabled', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="toggle-row">
              <div className="toggle-row-info">
                <span>Automatically download updates</span>
                <span>Download the installer as soon as a newer release is found</span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={local.autoDownloadUpdates ?? true}
                  onChange={(e) => change('autoDownloadUpdates', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="updater-panel">
              <div className="card-row" style={{ alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="font-medium" style={{ fontSize: 13.5 }}>BlueTalk {updaterState?.currentVersion || settings.version || '1.0.0'}</div>
                  <p className="text-sm text-muted" style={{ marginTop: 4 }}>
                    {updaterState?.message || 'Check for updates manually or let BlueTalk check in the background.'}
                  </p>
                </div>
                <span className={`badge ${getUpdateBadgeClass(updaterState)}`}>
                  {getUpdateStatusLabel(updaterState)}
                </span>
              </div>

              <div className="updater-grid">
                <div className="input-group">
                  <label>Current Version</label>
                  <input className="input font-mono" value={updaterState?.currentVersion || '1.0.0'} readOnly />
                </div>
                <div className="input-group">
                  <label>Latest Release</label>
                  <input className="input font-mono" value={latestVersion} readOnly />
                </div>
                <div className="input-group">
                  <label>Last Checked</label>
                  <input className="input" value={formatDateTime(updaterState?.lastCheckedAt)} readOnly />
                </div>
                <div className="input-group">
                  <label>Release Date</label>
                  <input className="input" value={formatDateTime(updaterState?.releaseDate)} readOnly />
                </div>
              </div>

              {isDownloadingUpdate && (
                <div className="updater-progress">
                  <div className="updater-progress-bar">
                    <div className="updater-progress-fill" style={{ width: `${updateProgress}%` }} />
                  </div>
                  <div className="card-row text-sm text-muted">
                    <span>{updateProgress.toFixed(0)}%</span>
                    <span>{formatBytes(updaterState?.downloadedBytes || 0)} / {formatBytes(updaterState?.totalBytes || 0)}</span>
                  </div>
                </div>
              )}

              {updaterState?.errorMessage && (
                <div className="updater-note updater-note-error">
                  {updaterState.errorMessage}
                </div>
              )}

              {!updaterState?.supported && updaterState?.message && (
                <div className="updater-note">
                  {updaterState.message}
                </div>
              )}

              <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={checkForUpdates} disabled={isCheckingUpdates || isDownloadingUpdate}>
                  <RefreshCw size={15} />
                  {isCheckingUpdates ? 'Checking...' : 'Check now'}
                </button>

                {showManualDownload && (
                  <button className="btn btn-secondary" onClick={downloadUpdate} disabled={isDownloadingUpdate}>
                    <Download size={15} />
                    {isDownloadingUpdate ? 'Downloading...' : 'Download update'}
                  </button>
                )}

                {showInstallAction && (
                  <button className="btn btn-primary" onClick={installUpdate}>
                    <RotateCw size={15} />
                    Restart and install
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <section style={{ marginBottom: 28 }}>
          <div className="section-title">
            <h3><Server size={14} />Application</h3>
          </div>
          <div className="card">
            <div className="toggle-row">
              <div className="toggle-row-info">
                <span><Bell size={14} style={{ marginRight: 6, verticalAlign: 'text-top' }} />Windows Notifications</span>
                <span>Show system notifications for diagnostics and incoming events</span>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => window.bluetalk?.notify?.show?.({
                  title: 'BlueTalk',
                  body: 'Windows notifications are active.',
                })}
              >
                Test
              </button>
            </div>

            <div className="toggle-row">
              <div className="toggle-row-info">
                <span>Theme</span>
                <span>Switch between light and dark mode</span>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={toggleTheme}>
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                {theme === 'dark' ? 'Light' : 'Dark'}
              </button>
            </div>

            <div className="toggle-row">
              <div className="toggle-row-info">
                <span>Minimize to Tray</span>
                <span>Keep running in the background when closed</span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={local.minimizeToTray ?? true}
                  onChange={(e) => change('minimizeToTray', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
