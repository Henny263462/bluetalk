import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { MessageCircle, Settings as SettingsIcon } from 'lucide-react';

import ChatsPage from './pages/Chats';
import SettingsPage from './pages/Settings';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

function TitleBar() {
  const { peerCount, theme, toggleTheme } = useApp();

  return (
    <div className="titlebar">
      <div className="titlebar-drag">
        <div className="titlebar-brand">
          <div className="brand-dot" />
          <span>BlueTalk</span>
        </div>
      </div>
      <div className="titlebar-status">
        <span className={peerCount > 0 ? 'online-dot' : 'offline-dot'} />
        <span>{peerCount} peer{peerCount !== 1 ? 's' : ''}</span>
      </div>
      <button
        className="tb-btn"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
      >
        {theme === 'dark' ? 'Light' : 'Dark'}
      </button>
      <div className="titlebar-controls">
        <button onClick={() => window.bluetalk?.window.minimize()} className="tb-btn" title="Minimize">
          −
        </button>
        <button onClick={() => window.bluetalk?.window.maximize()} className="tb-btn" title="Maximize">
          □
        </button>
        <button onClick={() => window.bluetalk?.window.close()} className="tb-btn tb-close" title="Close">
          ×
        </button>
      </div>
    </div>
  );
}

function Sidebar() {
  const links = [
    { to: '/', label: 'Chats', icon: MessageCircle },
    { to: '/settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <nav className="sidebar">
      {links.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          title={label}
        >
          <Icon size={15} strokeWidth={2} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default function App() {
  const [peers, setPeers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState({});
  const [theme, setTheme] = useState('dark');
  const [settings, setSettings] = useState({
    displayName: 'Anonymous',
    peerPort: 0,
    peerPorts: [],
    apiPort: 19876,
    minimizeToTray: true,
    theme: 'dark',
  });

  const upsertContact = useCallback((patch) => {
    if (!patch?.id) return;
    setContacts((prev) => {
      const idx = prev.findIndex((c) => c.id === patch.id);
      const merged = idx >= 0
        ? { ...prev[idx], ...patch }
        : { id: patch.id, addedAt: Date.now(), ...patch };

      const updated = idx >= 0
        ? prev.map((contact, i) => (i === idx ? merged : contact))
        : [...prev, merged];

      if (window.bluetalk) window.bluetalk.store.set('contacts', updated);
      return updated;
    });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const load = async () => {
      if (!window.bluetalk) return;

      const stored = await window.bluetalk.store.get('contacts', []);
      setContacts(stored || []);

      const storedMsgs = await window.bluetalk.store.get('messages', {});
      setMessages(storedMsgs || {});

      const storedSettings = await window.bluetalk.store.get('settings', {});
      if (storedSettings) {
        setSettings((s) => ({ ...s, ...storedSettings }));
        if (storedSettings.theme) setTheme(storedSettings.theme);
      }

      const currentPeers = await window.bluetalk.peer.getPeers();
      setPeers(currentPeers || []);
    };

    load();
  }, []);

  useEffect(() => {
    if (!window.bluetalk) return;
    const unsubs = [];

    unsubs.push(
      window.bluetalk.on('peer:connected', (peer) => {
        setPeers((prev) => {
          if (prev.find((p) => p.id === peer.id)) return prev;
          return [...prev, peer];
        });

        upsertContact({
          id: peer.id,
          name: peer.name || peer.id,
          address: peer.address && peer.port ? `${peer.address}:${peer.port}` : undefined,
        });
      })
    );

    unsubs.push(
      window.bluetalk.on('peer:disconnected', (peerId) => {
        setPeers((prev) => prev.filter((p) => p.id !== peerId));
      })
    );

    unsubs.push(
      window.bluetalk.on('peer:message', (msg) => {
        setMessages((prev) => {
          const key = msg.from;
          const updated = { ...prev, [key]: [...(prev[key] || []), msg] };
          window.bluetalk.store.set('messages', updated);
          return updated;
        });

        if (msg.from) {
          upsertContact({
            id: msg.from,
            name: msg.sender || msg.from,
          });
        }
      })
    );

    return () => unsubs.forEach((unsub) => unsub?.());
  }, [upsertContact]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (window.bluetalk) window.bluetalk.store.set('settings.theme', next);
      return next;
    });
  }, []);

  const sendMessage = useCallback(async (peerId, payload) => {
    if (!window.bluetalk || !peerId) return false;

    const outgoing = typeof payload === 'string'
      ? { kind: 'chat', content: payload }
      : { kind: 'chat', ...payload };

    const msg = {
      ...outgoing,
      sender: settings.displayName,
    };

    try {
      const sent = await window.bluetalk.peer.send(peerId, msg);
      if (!sent) return false;

      setMessages((prev) => {
        const self = { ...msg, from: 'self', timestamp: Date.now() };
        const updated = { ...prev, [peerId]: [...(prev[peerId] || []), self] };
        window.bluetalk.store.set('messages', updated);
        return updated;
      });

      return true;
    } catch {
      return false;
    }
  }, [settings.displayName]);

  const connectToAddress = useCallback(async (address) => {
    if (!window.bluetalk || !address?.trim()) {
      throw new Error('Address is required');
    }

    const peerInfo = await window.bluetalk.peer.connect(address.trim());
    upsertContact({
      id: peerInfo.id,
      name: peerInfo.name || peerInfo.id,
      address: address.trim(),
    });

    return peerInfo;
  }, [upsertContact]);

  const setContactNickname = useCallback((contactId, nickname) => {
    if (!contactId) return;
    upsertContact({ id: contactId, nickname: (nickname || '').trim() });
  }, [upsertContact]);

  const removeContact = useCallback((contactId) => {
    setContacts((prev) => {
      const updated = prev.filter((c) => c.id !== contactId);
      if (window.bluetalk) window.bluetalk.store.set('contacts', updated);
      return updated;
    });
  }, []);

  const updateSettings = useCallback((newSettings) => {
    setSettings((prev) => {
      const merged = { ...prev, ...newSettings };
      if (window.bluetalk) window.bluetalk.store.set('settings', merged);
      return merged;
    });
  }, []);

  const ctx = {
    peers,
    contacts,
    messages,
    settings,
    theme,
    peerCount: peers.length,
    sendMessage,
    connectToAddress,
    setContactNickname,
    removeContact,
    updateSettings,
    toggleTheme,
  };

  return (
    <AppContext.Provider value={ctx}>
      <HashRouter>
        <div className="app">
          <TitleBar />
          <div className="app-body">
            <Sidebar />
            <main className="content">
              <Routes>
                <Route path="/" element={<ChatsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </div>
      </HashRouter>
    </AppContext.Provider>
  );
}
