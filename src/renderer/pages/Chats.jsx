import React, { useEffect, useMemo, useRef, useState } from 'react';
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

function FileMessage({ message }) {
  const type = message.fileType || 'application/octet-stream';
  const isImage = type.startsWith('image/');
  const dataUrl = message.fileData ? `data:${type};base64,${message.fileData}` : '';

  return (
    <div className="msg-file">
      {isImage && dataUrl && (
        <img src={dataUrl} alt={message.fileName || 'Image attachment'} className="msg-file-image" />
      )}
      <div className="msg-file-info">
        <div className="msg-file-name">{message.fileName || 'Attachment'}</div>
        <div className="msg-file-size">{formatSize(message.fileSize || 0)}</div>
      </div>
      {dataUrl && (
        <a href={dataUrl} download={message.fileName || 'file'} className="msg-file-download" title="Download file">
          Download
        </a>
      )}
    </div>
  );
}

export default function ChatsPage() {
  const {
    peers,
    contacts,
    messages,
    sendMessage,
    connectToAddress,
    setContactNickname,
  } = useApp();

  const [selectedPeerId, setSelectedPeerId] = useState(null);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [warning, setWarning] = useState('');

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
      ...Object.keys(messages),
    ]);
    ids.delete('self');

    const list = [];
    for (const id of ids) {
      const peer = peers.find((p) => p.id === id);
      const contact = contacts.find((c) => c.id === id);
      const peerMsgs = messages[id] || [];
      const lastMessage = peerMsgs[peerMsgs.length - 1];
      const baseName = contact?.name || peer?.name || id;
      list.push({
        id,
        peer,
        contact,
        displayName: contact?.nickname || baseName,
        baseName,
        offline: !peer,
        lastMessage,
      });
    }

    return list.sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0));
  }, [contacts, peers, messages]);

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

  useEffect(() => {
    if (selectedPeerId && !chatList.find((chat) => chat.id === selectedPeerId)) {
      setSelectedPeerId(null);
    }
  }, [chatList, selectedPeerId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

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

  return (
    <div className="page">
      <div className="split-layout">
        <div className="split-list">
          <div className="split-list-header">
            <h2>Chats</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowConnect(true)} title="Connect to peer">
              +
            </button>
          </div>
          <div style={{ padding: '8px 12px' }}>
            <div className="search-bar">
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
                  <div className="list-item-name">{chat.displayName}</div>
                  <div className="list-item-sub">{getLastPreview(chat.lastMessage)}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
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
              <div
                style={{
                  padding: '12px 20px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexShrink: 0,
                }}
              >
                <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
                  <div className="list-item-avatar">
                    {(selectedPeer.displayName || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="font-medium truncate" style={{ fontSize: 14 }}>{selectedPeer.displayName}</div>
                    <div className="text-sm text-muted">
                      {selectedPeer.offline ? 'Offline' : 'Online'}
                      {selectedPeer.contact?.nickname && selectedPeer.baseName !== selectedPeer.contact.nickname
                        ? ` · ${selectedPeer.baseName}`
                        : ''}
                    </div>
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={openNicknameDialog}>
                  Nickname
                </button>
              </div>

              <div className="chat-messages">
                {msgs.length === 0 && (
                  <div className="chat-empty">
                    <p className="text-muted">No messages yet. Say hello!</p>
                  </div>
                )}
                {msgs.map((m, i) => (
                  <div key={i} className={`msg ${m.from === 'self' ? 'msg-self' : 'msg-other'} animate-in`}>
                    {m.from !== 'self' && <div className="msg-sender">{m.sender || m.from}</div>}
                    {m.kind === 'file' ? <FileMessage message={m} /> : <div>{m.content}</div>}
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
                  <button className="btn btn-ghost btn-icon" onClick={() => setPendingFile(null)}>
                    ×
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
                  disabled={readingFile}
                  title="Attach file"
                  style={{ height: 40, width: 40 }}
                >
                  +
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
                >
                  →
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
                ×
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
                ×
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
