import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
import { Bell, Network, User, Settings2, Moon, Sun, Copy, Check, TestTube2, Server, Globe, Cable } from 'lucide-react';

export default function SettingsPage() {
  const { settings, updateSettings, peers, theme, toggleTheme } = useApp();
  const [peerInfo, setPeerInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  const [local, setLocal] = useState(settings);
  const [portDiagnostics, setPortDiagnostics] = useState(null);
  const [testingPorts, setTestingPorts] = useState(false);

  useEffect(() => { setLocal(settings); }, [settings]);

  useEffect(() => {
    const fetchInfo = async () => {
      if (window.bluetalk) {
        const info = await window.bluetalk.peer.getInfo();
        setPeerInfo(info);
      }
    };
    fetchInfo();
    const interval = setInterval(fetchInfo, 5000);
    return () => clearInterval(interval);
  }, []);

  const change = (key, value) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
    updateSettings({ [key]: value });
  };

  const copyAddress = () => {
    const endpoint = peerInfo?.endpoints?.[0] || (peerInfo?.addresses?.[0] && peerInfo?.port
      ? `${peerInfo.addresses[0]}:${peerInfo.port}`
      : '');

    if (endpoint) {
      navigator.clipboard?.writeText(endpoint);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
          ? 'BlueTalk Netzwerk-Test erfolgreich'
          : 'BlueTalk Netzwerk-Test abgeschlossen';
        const body = openPorts.length > 0
          ? `Empfohlener Port: ${recommended}`
          : 'Keine offenen Standard-Ports erkannt. Nutze manuellen Port.';
        window.bluetalk.notify.show({ title, body });
      }
    } catch {
      if (window.bluetalk?.notify?.show) {
        window.bluetalk.notify.show({
          title: 'BlueTalk Netzwerk-Test fehlgeschlagen',
          body: 'Die Port-Prüfung konnte nicht ausgeführt werden.',
        });
      }
    } finally {
      setTestingPorts(false);
    }
  };

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
              <label>Port-Test (blockierte Netzwerke / Schulnetz)</label>
              <div className="flex gap-2" style={{ alignItems: 'center' }}>
                <button
                  className="btn btn-secondary"
                  onClick={testNetworkPorts}
                  disabled={testingPorts}
                  title="Teste typische Ports in restriktiven Netzwerken"
                >
                  <TestTube2 size={15} />
                  {testingPorts ? 'Teste Ports...' : 'Ports testen'}
                </button>
                {portDiagnostics?.recommendedPort ? (
                  <span className="badge badge-success">Empfohlen: {portDiagnostics.recommendedPort}</span>
                ) : (
                  <span className="badge badge-muted">Kein Port empfohlen</span>
                )}
              </div>

              {portDiagnostics && (
                <div className="code-block" style={{ marginTop: 8 }}>
                  <div><Globe size={13} style={{ display: 'inline-block', marginRight: 6, verticalAlign: 'text-top' }} />Host: {portDiagnostics.host}</div>
                  <div style={{ marginTop: 4 }}>
                    {portDiagnostics.checks.map((check) => (
                      <div key={check.port}>
                        <Cable size={12} style={{ display: 'inline-block', marginRight: 6, verticalAlign: 'text-top' }} />
                        Port {check.port}: {check.status === 'open' ? 'offen' : 'blockiert'}
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
                <p className="text-sm text-muted">BlueTalk sucht Geräte im selben Netzwerk automatisch und testet mehrere Peer-Ports parallel.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {peers.map((p) => (
                    <div key={p.id} className="flex items-center gap-2" style={{ fontSize: 12.5 }}>
                      <span className="online-dot" />
                      <span className="font-medium">{p.name}</span>
                      <span className="font-mono text-muted">{p.address}:{p.port}</span>
                    </div>
                  ))}
                </div>
              )}
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
                <span>Show system notifications for network diagnostics</span>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => window.bluetalk?.notify?.show?.({
                  title: 'BlueTalk',
                  body: 'Windows-Benachrichtigung ist aktiv.',
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
