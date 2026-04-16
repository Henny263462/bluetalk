import React, { useCallback, useEffect, useState } from 'react';
import { FolderOpen, Plug, Power, RefreshCw, Trash2, Upload } from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import { pluginRuntime } from '../plugins/pluginRuntime';

const ICON_STROKE = 1.75;

export default function PluginsPage() {
  const { toast } = useToast();
  const [plugins, setPlugins] = useState(() => pluginRuntime.getPlugins());
  const [busy, setBusy] = useState('');

  const refresh = useCallback(async () => {
    if (!window.bluetalk?.plugins) return;
    const list = await window.bluetalk.plugins.list();
    setPlugins(list || []);
  }, []);

  useEffect(() => {
    refresh();
    const off = pluginRuntime.onPluginsChanged((list) => setPlugins(list));
    const offChanged = window.bluetalk?.on?.('plugins:changed', (list) => setPlugins(list || []));
    return () => {
      off?.();
      offChanged?.();
    };
  }, [refresh]);

  const rescan = async () => {
    if (!window.bluetalk?.plugins) return;
    setBusy('rescan');
    try {
      const list = await window.bluetalk.plugins.rescan();
      setPlugins(list || []);
      toast({ variant: 'success', title: 'Plugins rescanned', message: `${list?.length || 0} plugin(s) loaded.` });
    } catch (e) {
      toast({ variant: 'error', title: 'Rescan failed', message: e?.message || 'Unknown error' });
    } finally {
      setBusy('');
    }
  };

  const openDir = async () => {
    if (!window.bluetalk?.plugins) return;
    await window.bluetalk.plugins.openDir();
  };

  const installFromDialog = async () => {
    if (!window.bluetalk?.plugins) return;
    setBusy('install');
    try {
      const result = await window.bluetalk.plugins.installFromDialog();
      if (result?.ok) {
        toast({ variant: 'success', title: 'Plugin installed', message: result.plugin?.manifest?.name || result.plugin?.id });
        refresh();
      } else if (!result?.canceled) {
        toast({ variant: 'error', title: 'Install failed', message: result?.error || 'Unknown error' });
      }
    } finally {
      setBusy('');
    }
  };

  const toggle = async (plugin) => {
    if (!window.bluetalk?.plugins) return;
    setBusy(`toggle:${plugin.id}`);
    try {
      await window.bluetalk.plugins.setEnabled(plugin.id, !plugin.enabled);
      await refresh();
    } finally {
      setBusy('');
    }
  };

  const uninstall = async (plugin) => {
    if (!window.bluetalk?.plugins) return;
    const ok = window.confirm(`Uninstall ${plugin.manifest?.name || plugin.id}? Its files and stored data will be deleted.`);
    if (!ok) return;
    setBusy(`remove:${plugin.id}`);
    try {
      await window.bluetalk.plugins.uninstall(plugin.id);
      await refresh();
      toast({ variant: 'success', title: 'Plugin removed', message: plugin.manifest?.name || plugin.id });
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="page page-plugins">
      <div className="page-header">
        <div>
          <h2>
            <Plug size={18} strokeWidth={ICON_STROKE} />
            Plugins
          </h2>
          <p>
            Extend BlueTalk with plugins that add tabs, custom screens and react to realtime events.
            Plugins are loaded from your user data folder.
          </p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={openDir}>
            <FolderOpen size={15} strokeWidth={ICON_STROKE} />
            Open folder
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={rescan} disabled={busy === 'rescan'}>
            <RefreshCw size={15} strokeWidth={ICON_STROKE} />
            {busy === 'rescan' ? 'Rescanning…' : 'Rescan'}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={installFromDialog} disabled={busy === 'install'}>
            <Upload size={15} strokeWidth={ICON_STROKE} />
            {busy === 'install' ? 'Installing…' : 'Install from folder'}
          </button>
        </div>
      </div>

      <div className="plugin-grid">
        {plugins.length === 0 ? (
          <div className="plugin-empty">
            <h3>No plugins installed</h3>
            <p>
              Drop a plugin folder (containing <code>manifest.json</code>) into your plugins directory,
              or use the install button above. Click <em>Open folder</em> to find its location.
            </p>
          </div>
        ) : null}
        {plugins.map((plugin) => (
          <article key={plugin.id} className={`plugin-card ${plugin.enabled ? 'is-enabled' : ''}`}>
            <header className="plugin-card-head">
              <div>
                <h4>{plugin.manifest?.name || plugin.id}</h4>
                <span className="plugin-card-meta">
                  v{plugin.manifest?.version || '0.0.0'} · {plugin.manifest?.author || 'Unknown author'}
                </span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={Boolean(plugin.enabled)}
                  onChange={() => toggle(plugin)}
                  disabled={busy === `toggle:${plugin.id}`}
                />
                <span className="toggle-slider" />
              </label>
            </header>
            {plugin.manifest?.description ? (
              <p className="plugin-card-desc">{plugin.manifest.description}</p>
            ) : null}
            <div className="plugin-card-caps">
              {plugin.hasUi ? <span className="plugin-cap">UI</span> : null}
              {plugin.hasMain ? <span className="plugin-cap">Main</span> : null}
              {Array.isArray(plugin.manifest?.permissions)
                ? plugin.manifest.permissions.map((perm) => (
                    <span key={perm} className="plugin-cap plugin-cap-perm">{perm}</span>
                  ))
                : null}
            </div>
            {plugin.lastError ? (
              <div className="plugin-error-banner" role="alert">
                {plugin.lastError}
              </div>
            ) : null}
            <footer className="plugin-card-foot">
              <span className="plugin-card-id">{plugin.id}</span>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => uninstall(plugin)}
                disabled={busy === `remove:${plugin.id}`}
              >
                <Trash2 size={14} strokeWidth={ICON_STROKE} />
                {busy === `remove:${plugin.id}` ? 'Removing…' : 'Uninstall'}
              </button>
            </footer>
          </article>
        ))}
      </div>
    </div>
  );
}
