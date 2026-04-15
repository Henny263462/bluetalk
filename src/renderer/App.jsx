import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, startTransition, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom';
import { MessageCircle, Settings as SettingsIcon, UserPlus, Minus, Maximize2, SquareStack, X } from 'lucide-react';

import ChatsPage from './pages/Chats';
import SettingsPage from './pages/Settings';
import NewConnectionsPage from './pages/NewConnections';
import CloudSyncPage from './pages/CloudSync';
import NotFoundPage from './pages/NotFound';
import RuntimeUnavailablePage from './pages/RuntimeUnavailable';
import NotificationCenter from './components/NotificationCenter';
import ProfileMenu from './components/ProfileMenu';
import { ToastProvider } from './components/ToastProvider';
import ErrorBoundary from './components/ErrorBoundary';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);
const CHAT_MESSAGE_BATCH_SIZE = 24;

function newChatMessageId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* ignore */
  }
  return `bt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function TitleBar() {
  const { peerCount } = useApp();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const api = window.bluetalk?.window;
    if (!api?.getMaximized || !api?.onMaximizedChange) return undefined;
    let cancelled = false;
    api.getMaximized().then((m) => {
      if (!cancelled) setIsMaximized(m);
    });
    const unsub = api.onMaximizedChange((m) => {
      if (!cancelled) setIsMaximized(m);
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

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
        <button type="button" onClick={() => window.bluetalk?.window.minimize()} className="tb-btn" title="Minimize" aria-label="Minimize">
          <Minus size={14} strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => window.bluetalk?.window.maximize()}
          className="tb-btn"
          title={isMaximized ? 'Restore' : 'Maximize'}
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <SquareStack size={14} strokeWidth={2} aria-hidden /> : <Maximize2 size={14} strokeWidth={2} aria-hidden />}
        </button>
        <button type="button" onClick={() => window.bluetalk?.window.close()} className="tb-btn tb-close" title="Close" aria-label="Close">
          <X size={14} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </div>
  );
}

function Sidebar() {
  const links = [
    { to: '/', label: 'Chats', icon: MessageCircle },
    { to: '/new', label: 'New', icon: UserPlus },
    { to: '/settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <nav className="sidebar">
      <div className="sidebar-nav">
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
      </div>
      <div className="sidebar-footer">
        <div className="sidebar-notif">
          <NotificationCenter />
        </div>
        <div className="sidebar-profile">
          <ProfileMenu variant="sidebar" />
        </div>
      </div>
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
    bio: '',
    profilePicture: '',
    peerPort: 0,
    peerPorts: [],
    apiPort: 19876,
    autoUpdateEnabled: true,
    autoDownloadUpdates: true,
    minimizeToTray: true,
    launchAtLogin: false,
    theme: 'dark',
    debugMode: false,
    windowsNotifications: true,
    sendReadReceipts: true,
  });
  const messageCacheRef = useRef({});
  const deliveryTimersRef = useRef(new Map());
  const settingsRef = useRef(settings);
  const [peerReadReceipts, setPeerReadReceipts] = useState({});
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => () => {
    for (const t of deliveryTimersRef.current.values()) {
      clearTimeout(t);
    }
    deliveryTimersRef.current.clear();
  }, []);

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

  const applyMessagePatch = useCallback(async (peerId, messageId, patch) => {
    if (!window.bluetalk || !peerId || !messageId || !patch) return;
    await window.bluetalk.messages.patch(peerId, messageId, patch);
    setMessages((prev) => {
      const list = prev[peerId] || [];
      const idx = list.findIndex((m) => m.messageId === messageId);
      if (idx < 0) return prev;
      const next = [...list];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, [peerId]: next };
    });
  }, []);

  useLayoutEffect(() => {
    if (!window.bluetalk) return undefined;
    const unsubs = [];

    unsubs.push(
      window.bluetalk.on('peer:connected', (peer) => {
        setPeers((prev) => {
          const idx = prev.findIndex((p) => p.id === peer.id);
          if (idx >= 0) {
            return prev.map((p, i) => (i === idx ? { ...p, ...peer } : p));
          }
          return [...prev, peer];
        });

        upsertContact({
          id: peer.id,
          name: peer.name || peer.id,
          address: peer.address && peer.port ? `${peer.address}:${peer.port}` : undefined,
          bio: peer.bio,
          profilePicture: peer.profilePicture,
        });
      })
    );

    unsubs.push(
      window.bluetalk.on('peer:disconnected', (peerId) => {
        setPeers((prev) => prev.filter((p) => p.id !== peerId));
      })
    );

    unsubs.push(
      window.bluetalk.on('peers:list-sync', (list) => {
        setPeers(Array.isArray(list) ? list : []);
      })
    );

    unsubs.push(
      window.bluetalk.on('peer:message', async (msg) => {
        if (msg.kind === 'profile' && msg.from) {
          upsertContact({
            id: msg.from,
            name: msg.displayName || msg.sender || msg.from,
            bio: msg.bio,
            profilePicture: msg.profilePicture,
          });
          return;
        }

        if (msg.kind === 'delivery-receipt' && msg.refMessageId && msg.from) {
          const tid = deliveryTimersRef.current.get(msg.refMessageId);
          if (tid) clearTimeout(tid);
          deliveryTimersRef.current.delete(msg.refMessageId);
          await applyMessagePatch(msg.from, msg.refMessageId, {
            deliveryStatus: 'delivered',
            deliveredAt: typeof msg.receivedAt === 'number' ? msg.receivedAt : Date.now(),
          });
          return;
        }

        if (msg.kind === 'read-receipt' && msg.lastReadMessageId && msg.from) {
          setPeerReadReceipts((prev) => {
            const next = { ...prev, [msg.from]: msg.lastReadMessageId };
            if (window.bluetalk) window.bluetalk.store.set('chatReadReceipts', next);
            return next;
          });
          return;
        }

        const normalized = {
          ...msg,
          messageId: msg.messageId || newChatMessageId(),
          timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : Date.now(),
        };

        if ((normalized.kind === 'chat' || normalized.kind === 'file') && msg.messageId && msg.from) {
          void window.bluetalk.peer.send(msg.from, {
            kind: 'delivery-receipt',
            refMessageId: msg.messageId,
            receivedAt: Date.now(),
            sender: settingsRef.current.displayName,
          });
        }

        const meta = await window.bluetalk.messages.append(msg.from, normalized);

        setChatMeta((prev) => ({
          ...prev,
          [msg.from]: meta?.count ? meta : {
            count: (prev[msg.from]?.count || 0) + 1,
            lastMessage: normalized,
          },
        }));

        startTransition(() => {
          setMessages((prev) => ({
            ...prev,
            [msg.from]: [...(prev[msg.from] || []), normalized],
          }));
        });

        if (msg.from) {
          setContacts((prev) => {
            const idx = prev.findIndex((c) => c.id === msg.from);
            const existing = idx >= 0 ? prev[idx] : null;
            const hasOutgoing = existing?.hasOutgoing === true;
            const requestCleared = existing?.pendingMessageRequest === false;
            const merged = {
              ...(existing || { id: msg.from, addedAt: Date.now() }),
              name: normalized.sender || existing?.name || msg.from,
              pendingMessageRequest: hasOutgoing || requestCleared ? false : true,
            };
            const updated = idx >= 0
              ? prev.map((c, i) => (i === idx ? merged : c))
              : [...prev, merged];
            if (window.bluetalk) window.bluetalk.store.set('contacts', updated);
            return updated;
          });
        }
      })
    );

    let cancelled = false;
    (async () => {
      try {
        const [storedContacts, storedChatMeta, storedSettings, storedReadReceipts, currentPeers] = await Promise.all([
          window.bluetalk.store.get('contacts', []),
          window.bluetalk.messages.getMeta(),
          window.bluetalk.store.get('settings', {}),
          window.bluetalk.store.get('chatReadReceipts', {}),
          window.bluetalk.peer.getPeers(),
        ]);

        if (cancelled) return;

        const meta = storedChatMeta || {};
        let migrated = false;
        const normalized = (storedContacts || []).map((c) => {
          if (!c?.id) return c;
          const count = meta[c.id]?.count || 0;
          if (count > 0 && c.hasOutgoing !== true && c.pendingMessageRequest !== true) {
            migrated = true;
            return { ...c, hasOutgoing: true };
          }
          return c;
        });
        if (migrated) {
          window.bluetalk.store.set('contacts', normalized);
        }

        setContacts(normalized);
        setChatMeta(meta);
        setPeerReadReceipts(storedReadReceipts && typeof storedReadReceipts === 'object' ? storedReadReceipts : {});

        if (storedSettings) {
          setSettings((s) => ({ ...s, ...storedSettings }));
          if (storedSettings.theme) setTheme(storedSettings.theme);
        }
        setPeers(currentPeers || []);
        setLoadError('');
      } catch (e) {
        if (!cancelled) {
          setLoadError(e?.message || 'Could not load your local data.');
        }
      }
    })();

    return () => {
      cancelled = true;
      unsubs.forEach((unsub) => unsub?.());
    };
  }, [upsertContact, applyMessagePatch]);

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

    const messageId = newChatMessageId();
    const createdAt = Date.now();

    const msg = {
      ...outgoing,
      sender: settings.displayName,
      messageId,
      timestamp: createdAt,
    };

    const selfMessage = {
      ...msg,
      from: 'self',
      deliveryStatus: 'pending',
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

      upsertContact({ id: peerId, hasOutgoing: true, pendingMessageRequest: false });

      const t = setTimeout(() => {
        deliveryTimersRef.current.delete(messageId);
        void applyMessagePatch(peerId, messageId, { deliveryStatus: 'scheduled' });
      }, 8000);
      deliveryTimersRef.current.set(messageId, t);

      return true;
    } catch {
      return false;
    }
  }, [settings.displayName, upsertContact, applyMessagePatch]);

  const sendReadReceipt = useCallback(async (peerId, lastReadMessageId) => {
    if (!window.bluetalk || !peerId || !lastReadMessageId) return;
    if (!settings.sendReadReceipts) return;
    try {
      await window.bluetalk.peer.send(peerId, {
        kind: 'read-receipt',
        lastReadMessageId,
        sender: settings.displayName,
      });
    } catch {
      /* ignore */
    }
  }, [settings.displayName, settings.sendReadReceipts]);

  const connectToAddress = useCallback(async (address) => {
    if (!window.bluetalk || !address?.trim()) {
      throw new Error('Address is required');
    }

    const peerInfo = await window.bluetalk.peer.connect(address.trim());
    upsertContact({
      id: peerInfo.id,
      name: peerInfo.name || peerInfo.id,
      address: address.trim(),
      hasOutgoing: true,
      bio: peerInfo.bio,
      profilePicture: peerInfo.profilePicture,
    });

    return peerInfo;
  }, [upsertContact]);

  const refreshDiscovery = useCallback(async () => {
    if (!window.bluetalk) return;
    await window.bluetalk.peer.refreshDiscovery();
    const list = await window.bluetalk.peer.getPeers();
    setPeers(list || []);
  }, []);

  const acceptMessageRequest = useCallback((peerId) => {
    if (!peerId) return;
    upsertContact({ id: peerId, pendingMessageRequest: false });
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
    setPeerReadReceipts((prev) => {
      const next = { ...prev };
      delete next[peerId];
      if (window.bluetalk) window.bluetalk.store.set('chatReadReceipts', next);
      return next;
    });
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
      if (window.bluetalk) {
        window.bluetalk.store.set('settings', merged);
        const profileKeys = ['displayName', 'bio', 'profilePicture'];
        if (profileKeys.some((k) => Object.prototype.hasOwnProperty.call(newSettings, k))) {
          window.bluetalk.peer.broadcast({
            kind: 'profile',
            displayName: merged.displayName,
            bio: merged.bio || '',
            profilePicture: merged.profilePicture || '',
            sender: merged.displayName,
          });
        }
      }
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
    peerReadReceipts,
    sendMessage,
    sendReadReceipt,
    loadChatMessages,
    connectToAddress,
    refreshDiscovery,
    setContactNickname,
    setChatPinned,
    deleteChat,
    removeContact,
    updateSettings,
    toggleTheme,
    upsertContact,
    acceptMessageRequest,
  };

  if (!window.bluetalk) {
    return (
      <AppContext.Provider value={ctx}>
        <ToastProvider>
          <RuntimeUnavailablePage />
        </ToastProvider>
      </AppContext.Provider>
    );
  }

  return (
    <AppContext.Provider value={ctx}>
      <ToastProvider>
        <ErrorBoundary>
          <HashRouter>
            <div className="app">
              <TitleBar />
              {loadError ? (
                <div className="app-banner app-banner--error" role="alert">
                  <span>{loadError}</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLoadError('')}>
                    Dismiss
                  </button>
                </div>
              ) : null}
              <div className="app-body">
                <Sidebar />
                <main className="content">
                  <Routes>
                    <Route path="/" element={<ChatsPage />} />
                    <Route path="/new" element={<NewConnectionsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/cloud-sync" element={<CloudSyncPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </main>
              </div>
            </div>
          </HashRouter>
        </ErrorBoundary>
      </ToastProvider>
    </AppContext.Provider>
  );
}
