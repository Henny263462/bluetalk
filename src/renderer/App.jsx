import React, { useState, useEffect, useCallback, useRef, startTransition, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { MessageCircle, Settings as SettingsIcon } from 'lucide-react';

import ChatsPage from './pages/Chats';
import SettingsPage from './pages/Settings';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);
const CHAT_MESSAGE_BATCH_SIZE = 24;

function TitleBar() {
  const { peerCount } = useApp();

  return (
    <div className="titlebar">
      <div className="titlebar-drag">
        <div className="titlebar-brand">
          <span>BlueTalk</span>
        </div>
      </div>
      <div className="titlebar-status">
        <span className={peerCount > 0 ? 'online-dot' : 'offline-dot'} />
        <span>{peerCount} peer{peerCount !== 1 ? 's' : ''}</span>
      </div>
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
  const [chatMeta, setChatMeta] = useState({});
  const [loadedChats, setLoadedChats] = useState({});
  const [messages, setMessages] = useState({});
  const [theme, setTheme] = useState('dark');
  const [settings, setSettings] = useState({
    displayName: 'Anonymous',
    peerPort: 0,
    peerPorts: [],
    apiPort: 19876,
    autoUpdateEnabled: true,
    autoDownloadUpdates: true,
    minimizeToTray: true,
    theme: 'dark',
    debugMode: false,
  });
  const messageCacheRef = useRef({});

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
    messageCacheRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const load = async () => {
      if (!window.bluetalk) return;

      const [storedContacts, storedChatMeta, storedSettings, currentPeers] = await Promise.all([
        window.bluetalk.store.get('contacts', []),
        window.bluetalk.messages.getMeta(),
        window.bluetalk.store.get('settings', {}),
        window.bluetalk.peer.getPeers(),
      ]);

      setContacts(storedContacts || []);
      setChatMeta(storedChatMeta || {});

      if (storedSettings) {
        setSettings((s) => ({ ...s, ...storedSettings }));
        if (storedSettings.theme) setTheme(storedSettings.theme);
      }
      setPeers(currentPeers || []);
    };

    load();
  }, []);

  const loadChatMessages = useCallback(async (peerId, options = {}) => {
    if (!window.bluetalk || !peerId) {
      return { messages: [], total: 0, hasMore: false };
    }

    const reset = Boolean(options.reset);
    const currentMessages = reset ? [] : (messageCacheRef.current[peerId] || []);
    const batch = await window.bluetalk.messages.getBatch(peerId, {
      skip: reset ? 0 : currentMessages.length,
      limit: options.limit || CHAT_MESSAGE_BATCH_SIZE,
    });

    setMessages((prev) => ({
      ...prev,
      [peerId]: reset ? (batch.messages || []) : [...(batch.messages || []), ...(prev[peerId] || [])],
    }));
    setLoadedChats((prev) => ({ ...prev, [peerId]: true }));

    return batch;
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
      window.bluetalk.on('peer:message', async (msg) => {
        const meta = await window.bluetalk.messages.append(msg.from, msg);

        setChatMeta((prev) => ({
          ...prev,
          [msg.from]: meta?.count ? meta : {
            count: (prev[msg.from]?.count || 0) + 1,
            lastMessage: msg,
          },
        }));

        startTransition(() => {
          setMessages((prev) => ({
            ...prev,
            [msg.from]: [...(prev[msg.from] || []), msg],
          }));
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

    const selfMessage = {
      ...msg,
      from: 'self',
      timestamp: Date.now(),
    };

    try {
      const sent = await window.bluetalk.peer.send(peerId, msg);
      if (!sent) return false;

      const meta = await window.bluetalk.messages.append(peerId, selfMessage);

      setMessages((prev) => ({
        ...prev,
        [peerId]: [...(prev[peerId] || []), selfMessage],
      }));

      setChatMeta((prev) => ({
        ...prev,
        [peerId]: meta?.count ? meta : {
          count: (prev[peerId]?.count || 0) + 1,
          lastMessage: selfMessage,
        },
      }));

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

  const setChatPinned = useCallback((contactId, pinned) => {
    if (!contactId) return;
    upsertContact({ id: contactId, pinned: Boolean(pinned) });
  }, [upsertContact]);

  const removeContact = useCallback((contactId) => {
    setContacts((prev) => {
      const updated = prev.filter((c) => c.id !== contactId);
      if (window.bluetalk) window.bluetalk.store.set('contacts', updated);
      return updated;
    });
  }, []);

  const deleteChat = useCallback(async (peerId) => {
    if (!window.bluetalk || !peerId) return false;

    await window.bluetalk.messages.deleteChat(peerId);
    setMessages((prev) => {
      const updated = { ...prev };
      delete updated[peerId];
      return updated;
    });
    setChatMeta((prev) => {
      const updated = { ...prev };
      delete updated[peerId];
      return updated;
    });
    setLoadedChats((prev) => {
      const updated = { ...prev };
      delete updated[peerId];
      return updated;
    });
    removeContact(peerId);
    return true;
  }, [removeContact]);

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
    chatMeta,
    loadedChats,
    messages,
    settings,
    theme,
    peerCount: peers.length,
    sendMessage,
    loadChatMessages,
    connectToAddress,
    setContactNickname,
    setChatPinned,
    deleteChat,
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
