import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Paperclip,
  Pin,
  PinOff,
  Search,
  SendHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../App';

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_CHAT_FILE_SIZE_GB = 5;
const MAX_CHAT_FILE_SIZE_BYTES = MAX_CHAT_FILE_SIZE_GB * 1024 * 1024 * 1024;
const CHAT_BATCH_SIZE = 24;

function getLastPreview(message) {
  if (!message) return 'No messages';
  if (message.kind === 'file') return `File: ${message.fileName || message.content || 'Attachment'}`;
  return (message.from === 'self' ? 'You: ' : '') + (message.content || 'Message');
}

function readFileAsData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const parts = dataUrl.split(',');
      const base64 = parts[1] || '';
      resolve({ dataUrl, base64 });
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function getImageUrl(message) {
  if (!message) return '';

  if (message.kind === 'file') {
    const type = message.fileType || 'application/octet-stream';
    if (!type.startsWith('image/') || !message.fileData) return '';
    return `data:${type};base64,${message.fileData}`;
  }

  const content = String(message.content || '').trim();
  if (!content) return '';
  if (content.startsWith('data:image/')) return content;
  if (/^https?:\/\/\S+\.(png|jpe?g|gif|webp|bmp|svg)(\?\S*)?$/i.test(content)) return content;
  return '';
}

function FileMessage({ message }) {
  const dataUrl = getImageUrl(message);

  return (
    <div className="msg-file">
      {dataUrl && (
        <a href={dataUrl} target="_blank" rel="noreferrer" className="msg-file-image-link">
          <img src={dataUrl} alt={message.fileName || 'Image attachment'} className="msg-file-image" />
        </a>
      )}
      <div className="msg-file-info">
        <div className="msg-file-name">{message.fileName || 'Attachment'}</div>
        <div className="msg-file-size">{formatSize(message.fileSize || 0)}</div>
      </div>
      {message.fileData && (
        <a
          href={`data:${message.fileType || 'application/octet-stream'};base64,${message.fileData}`}
          download={message.fileName || 'file'}
          className="msg-file-download"
          title="Download file"
        >
          Download
        </a>
      )}
    </div>
  );
}

function ChatMessage({ message }) {
  const imageUrl = getImageUrl(message);
  if (!imageUrl) return <div>{message.content}</div>;

  return (
    <a href={imageUrl} target="_blank" rel="noreferrer" className="msg-inline-image-link">
      <img src={imageUrl} alt="Shared image" className="msg-inline-image" />
    </a>
  );
}

export default function ChatsPage() {
  const {
    peers,
    contacts,
    chatMeta,
    loadedChats,
    messages,
    sendMessage,
    loadChatMessages,
    connectToAddress,
    setContactNickname,
    setChatPinned,
    deleteChat,
  } = useApp();

  const [selectedPeerId, setSelectedPeerId] = useState(null);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [warning, setWarning] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [showConnect, setShowConnect] = useState(false);
  const [connectAddress, setConnectAddress] = useState('');
  const [connecting, setConnecting] = useState(false);

  const [showNickname, setShowNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');

  const [pendingFile, setPendingFile] = useState(null);
  const [readingFile, setReadingFile] = useState(false);

  const endRef = useRef(null);
  const fileInputRef = useRef(null);

  const chatList = useMemo(() => {
    const ids = new Set([
      ...contacts.map((c) => c.id),
      ...peers.map((p) => p.id),
      ...Object.keys(chatMeta || {}),
    ]);
    ids.delete('self');

    const list = [];
    for (const id of ids) {
      const peer = peers.find((p) => p.id === id);
      const contact = contacts.find((c) => c.id === id);
      const meta = chatMeta[id] || null;
      const baseName = contact?.name || peer?.name || id;

      list.push({
        id,
        peer,
        contact,
        displayName: contact?.nickname || baseName,
        baseName,
        offline: !peer,
        pinned: Boolean(contact?.pinned),
        lastMessage: meta?.lastMessage || null,
        messageCount: meta?.count || 0,
      });
    }

    return list.sort((a, b) => {
      if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
      const aTs = a.lastMessage?.timestamp || a.contact?.addedAt || 0;
      const bTs = b.lastMessage?.timestamp || b.contact?.addedAt || 0;
      return bTs - aTs;
    });
  }, [chatMeta, contacts, peers]);

  const filtered = useMemo(
    () => chatList.filter((chat) =>
      `${chat.displayName} ${chat.baseName} ${chat.id}`.toLowerCase().includes(search.toLowerCase())
    ),
    [chatList, search]
  );

  const selectedPeer = useMemo(
    () => chatList.find((c) => c.id === selectedPeerId) || null,
    [chatList, selectedPeerId]
  );

  const msgs = selectedPeer ? messages[selectedPeer.id] || [] : [];
  const hasMoreMessages = selectedPeer ? selectedPeer.messageCount > msgs.length : false;
  const newestTimestamp = msgs[msgs.length - 1]?.timestamp || 0;

  useEffect(() => {
    if (selectedPeerId && !chatList.find((chat) => chat.id === selectedPeerId)) {
      setSelectedPeerId(null);
    }
  }, [chatList, selectedPeerId]);

  useEffect(() => {
    let cancelled = false;

    async function ensureMessages() {
      if (!selectedPeerId) return;
      if (loadedChats[selectedPeerId]) return;
      if (!(chatMeta[selectedPeerId]?.count > 0)) return;

      setLoadingMessages(true);
      try {
        await loadChatMessages(selectedPeerId, { reset: true, limit: CHAT_BATCH_SIZE });
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    }

    ensureMessages();
    return () => {
      cancelled = true;
    };
  }, [chatMeta, loadChatMessages, loadedChats, selectedPeerId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [newestTimestamp, selectedPeerId]);

  const send = async () => {
    if (!selectedPeer) return;
    if (!input.trim() && !pendingFile) return;

    setWarning('');

    if (input.trim()) {
      const ok = await sendMessage(selectedPeer.id, { kind: 'chat', content: input.trim() });
      if (!ok) {
        setWarning('Message could not be delivered. Peer is probably offline.');
        return;
      }
      setInput('');
    }

    if (pendingFile) {
      const ok = await sendMessage(selectedPeer.id, {
        kind: 'file',
        content: pendingFile.name,
        fileName: pendingFile.name,
        fileSize: pendingFile.size,
        fileType: pendingFile.type,
        fileData: pendingFile.base64,
      });
      if (!ok) {
        setWarning('File could not be delivered. Peer is probably offline.');
        return;
      }
      setPendingFile(null);
    }
  };

  const loadOlderMessages = async () => {
    if (!selectedPeer) return;
    setLoadingMore(true);
    try {
      await loadChatMessages(selectedPeer.id, { limit: CHAT_BATCH_SIZE });
    } finally {
      setLoadingMore(false);
    }
  };

  const handleFilePicked = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (file.size > MAX_CHAT_FILE_SIZE_BYTES) {
      setWarning(`Max file size in chat is ${MAX_CHAT_FILE_SIZE_GB} GB.`);
      return;
    }

    setReadingFile(true);
    setWarning('');
    try {
      const data = await readFileAsData(file);
      setPendingFile({
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        base64: data.base64,
        dataUrl: data.dataUrl,
      });
    } catch {
      setWarning('Could not read file.');
    } finally {
      setReadingFile(false);
    }
  };

  const handleConnect = async () => {
    if (!connectAddress.trim()) return;
    setConnecting(true);
    setWarning('');
    try {
      const peerInfo = await connectToAddress(connectAddress.trim());
      setSelectedPeerId(peerInfo.id);
      setShowConnect(false);
      setConnectAddress('');
    } catch (err) {
      setWarning(err.message || 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const openNicknameDialog = () => {
    if (!selectedPeer) return;
    setNicknameInput(selectedPeer.contact?.nickname || '');
    setShowNickname(true);
  };

  const saveNickname = () => {
    if (!selectedPeer) return;
    setContactNickname(selectedPeer.id, nicknameInput);
    setShowNickname(false);
  };

  const togglePinnedState = () => {
    if (!selectedPeer) return;
    setChatPinned(selectedPeer.id, !selectedPeer.pinned);
  };

  const handleDeleteChat = async () => {
    if (!selectedPeer) return;
    const confirmed = window.confirm(`Delete chat with ${selectedPeer.displayName}?`);
    if (!confirmed) return;

    await deleteChat(selectedPeer.id);
    setSelectedPeerId(null);
    setWarning('');
    setPendingFile(null);
  };

  return (
    <div className="page">
      <div className="split-layout">
        <div className="split-list">
          <div className="split-list-header">
            <h2>Chats</h2>
          </div>
          <div style={{ padding: '8px 12px' }}>
            <div className="search-bar">
              <Search size={14} />
              <input
                className="input"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="split-list-body">
            {filtered.length === 0 && (
              <div className="empty-state" style={{ padding: '24px 12px' }}>
                <p>No chats yet. Connect to a peer to start.</p>
              </div>
            )}
            {filtered.map((chat) => (
              <div
                key={chat.id}
                className={`list-item ${selectedPeer?.id === chat.id ? 'active' : ''}`}
                onClick={() => setSelectedPeerId(chat.id)}
              >
                <div className="list-item-avatar">
                  {(chat.displayName || '?')[0].toUpperCase()}
                </div>
                <div className="list-item-info">
                  <div className="list-item-name-row">
                    <div className="list-item-name">{chat.displayName}</div>
                    {chat.pinned && (
                      <span className="chat-pin-badge" title="Pinned chat">
                        <Pin size={12} />
                      </span>
                    )}
                  </div>
                  <div className="list-item-sub">{getLastPreview(chat.lastMessage)}</div>
                </div>
                <div className="chat-list-meta">
                  {chat.lastMessage && <span className="list-item-meta">{formatTime(chat.lastMessage.timestamp)}</span>}
                  <span className={chat.offline ? 'offline-dot' : 'online-dot'} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="split-detail">
          {!selectedPeer ? (
            <div className="chat-empty">
              <div className="empty-state">
                <p>Select a conversation to start messaging</p>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowConnect(true)}>
                  Connect Peer
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="chat-header">
                <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
                  <div className="list-item-avatar">
                    {(selectedPeer.displayName || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="font-medium truncate" style={{ fontSize: 14 }}>{selectedPeer.displayName}</div>
                    <div className="text-sm text-muted">
                      {selectedPeer.offline ? 'Offline' : 'Online'}
                      {selectedPeer.contact?.nickname && selectedPeer.baseName !== selectedPeer.contact.nickname
                        ? ` - ${selectedPeer.baseName}`
                        : ''}
                    </div>
                  </div>
                </div>
                <div className="chat-header-actions">
                  <button className="btn btn-secondary btn-sm" onClick={openNicknameDialog}>
                    Nickname
                  </button>
                  <button
                    className="btn btn-secondary btn-icon"
                    onClick={togglePinnedState}
                    title={selectedPeer.pinned ? 'Unpin chat' : 'Pin chat'}
                  >
                    {selectedPeer.pinned ? <PinOff size={16} /> : <Pin size={16} />}
                  </button>
                  <button
                    className="btn btn-danger btn-icon"
                    onClick={handleDeleteChat}
                    title="Delete chat"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="chat-messages">
                {hasMoreMessages && (
                  <div className="chat-load-more">
                    <button className="btn btn-secondary btn-sm" onClick={loadOlderMessages} disabled={loadingMore}>
                      {loadingMore ? 'Loading...' : `Load ${Math.min(CHAT_BATCH_SIZE, selectedPeer.messageCount - msgs.length)} older messages`}
                    </button>
                  </div>
                )}

                {loadingMessages && msgs.length === 0 && (
                  <div className="chat-empty">
                    <p className="text-muted">Loading messages...</p>
                  </div>
                )}

                {!loadingMessages && msgs.length === 0 && (
                  <div className="chat-empty">
                    <p className="text-muted">No messages yet. Say hello!</p>
                  </div>
                )}

                {msgs.map((m, i) => (
                  <div key={`${m.timestamp || i}-${m.from || 'msg'}-${i}`} className={`msg ${m.from === 'self' ? 'msg-self' : 'msg-other'} animate-in`}>
                    {m.from !== 'self' && <div className="msg-sender">{m.sender || m.from}</div>}
                    {m.kind === 'file' ? <FileMessage message={m} /> : <ChatMessage message={m} />}
                    <div className="msg-time">{formatTime(m.timestamp)}</div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              {pendingFile && (
                <div className="pending-file">
                  <div className="pending-file-info">
                    <div className="pending-file-name">{pendingFile.name}</div>
                    <div className="pending-file-meta">{formatSize(pendingFile.size)}</div>
                  </div>
                  {pendingFile.type.startsWith('image/') && (
                    <img src={pendingFile.dataUrl} alt={pendingFile.name} className="pending-file-preview" />
                  )}
                  <button className="btn btn-ghost btn-icon" onClick={() => setPendingFile(null)} title="Remove attachment">
                    <X size={16} />
                  </button>
                </div>
              )}

              {warning && <div className="chat-warning">{warning}</div>}

              <div className="chat-input-bar">
                <input
                  type="file"
                  hidden
                  ref={fileInputRef}
                  onChange={handleFilePicked}
                  disabled={readingFile || !selectedPeer}
                />
                <button
                  className="btn btn-secondary btn-icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={readingFile || !selectedPeer}
                  title="Attach file"
                  style={{ height: 40, width: 40 }}
                >
                  <Paperclip size={17} />
                </button>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={readingFile ? 'Reading file...' : 'Type a message...'}
                  rows={1}
                />
                <button
                  className="btn btn-primary btn-icon"
                  onClick={send}
                  disabled={!input.trim() && !pendingFile}
                  style={{ height: 40, width: 40 }}
                  title="Send message"
                >
                  <SendHorizontal size={17} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {showConnect && (
        <div className="modal-overlay" onClick={() => setShowConnect(false)}>
          <div className="modal animate-scale" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 style={{ margin: 0 }}>Connect to Peer</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowConnect(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="input-group">
              <label>Address or IP</label>
              <input
                className="input font-mono"
                placeholder="e.g. 192.168.1.42 or 192.168.1.42:8080"
                value={connectAddress}
                onChange={(e) => setConnectAddress(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowConnect(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConnect} disabled={!connectAddress.trim() || connecting}>
                {connecting ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNickname && selectedPeer && (
        <div className="modal-overlay" onClick={() => setShowNickname(false)}>
          <div className="modal animate-scale" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 style={{ margin: 0 }}>Set Nickname</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowNickname(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="input-group">
              <label>Nickname</label>
              <input
                className="input"
                placeholder={`Current: ${selectedPeer.baseName}`}
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveNickname()}
                autoFocus
              />
              <span className="text-xs text-muted">Leave empty to clear the nickname.</span>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowNickname(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveNickname}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
