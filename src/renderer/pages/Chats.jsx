import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Archive,
  Download,
  File,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  Film,
  Music,
  Paperclip,
  Pin,
  PinOff,
  FileBarChart,
  Search,
  SendHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../App';
import { useToast } from '../components/ToastProvider';

const CHAT_ICON_STROKE = 1.75;

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

function PeerAvatar({ pictureUrl, name, size = 36, className = '' }) {
  const initial = (name || '?')[0].toUpperCase();
  const dim = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  if (pictureUrl) {
    return (
      <img
        src={pictureUrl}
        alt=""
        className={`peer-avatar-img ${className}`}
        style={dim}
      />
    );
  }
  return (
    <div className={`list-item-avatar peer-avatar-fallback ${className}`} style={dim}>
      {initial}
    </div>
  );
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

function getFileBlobUrl(message) {
  if (!message || message.kind !== 'file' || !message.fileData) return '';
  const type = message.fileType || 'application/octet-stream';
  return `data:${type};base64,${message.fileData}`;
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

function extOf(name) {
  const i = String(name || '').lastIndexOf('.');
  if (i <= 0) return '';
  return String(name).slice(i + 1).toLowerCase();
}

function getFileCategory(mime, fileName) {
  const m = String(mime || '').toLowerCase();
  const ext = extOf(fileName);

  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';

  if (!m || m === 'application/octet-stream') {
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(ext)) return 'image';
    if (['mp4', 'webm', 'ogg', 'mov', 'mkv', 'avi', 'm4v'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus'].includes(ext)) return 'audio';
  }

  return 'other';
}

function FileTypeIcon({ mime, fileName, size = 22 }) {
  const m = String(mime || '').toLowerCase();
  const ext = extOf(fileName);
  const stroke = CHAT_ICON_STROKE;
  const common = { size, strokeWidth: stroke, 'aria-hidden': true };

  if (m.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
    return <FileImage {...common} />;
  }
  if (m.startsWith('video/')) return <Film {...common} />;
  if (m.startsWith('audio/')) return <Music {...common} />;
  if (m === 'application/pdf' || ext === 'pdf') return <FileType {...common} />;
  if (
    m.includes('zip') ||
    m.includes('rar') ||
    m.includes('7z') ||
    m.includes('tar') ||
    m.includes('gzip') ||
    ['zip', 'rar', '7z', 'tar', 'gz', 'tgz'].includes(ext)
  ) {
    return <Archive {...common} />;
  }
  if (m.includes('spreadsheet') || m.includes('excel') || ['xls', 'xlsx', 'csv', 'ods'].includes(ext)) {
    return <FileSpreadsheet {...common} />;
  }
  if (m.includes('presentation') || ['ppt', 'pptx', 'odp'].includes(ext)) {
    return <FileBarChart {...common} />;
  }
  if (m.startsWith('text/') || ['txt', 'md', 'rtf'].includes(ext)) {
    return <FileText {...common} />;
  }
  if (
    ['json', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'xml', 'yaml', 'yml', 'toml', 'rs', 'go', 'py', 'java', 'c', 'cpp', 'h'].includes(
      ext
    )
  ) {
    return <FileCode {...common} />;
  }
  return <File {...common} />;
}

function FileMessage({ message }) {
  const dataUrl = getFileBlobUrl(message);
  const mime = message.fileType || 'application/octet-stream';
  const category = getFileCategory(mime, message.fileName);
  const imageUrl = category === 'image' ? getImageUrl(message) : '';
  const hasPayload = Boolean(message.fileData && dataUrl);
  const showImagePreview = category === 'image' && !!imageUrl;
  const showIconRow =
    category === 'other' || (category === 'image' && !imageUrl) || ((category === 'video' || category === 'audio') && !hasPayload);
  const showMediaFooter = (category === 'video' || category === 'audio') && hasPayload;
  const showImageMeta = showImagePreview;

  return (
    <div className={`msg-file msg-file--${category}`}>
      {showImagePreview && (
        <a href={imageUrl} target="_blank" rel="noreferrer" className="msg-file-image-link">
          <img src={imageUrl} alt={message.fileName || 'Bildanhang'} className="msg-file-image" loading="lazy" />
        </a>
      )}

      {category === 'video' && hasPayload && (
        <video src={dataUrl} controls playsInline className="msg-file-video" preload="metadata" />
      )}

      {category === 'audio' && hasPayload && (
        <audio src={dataUrl} controls className="msg-file-audio" preload="metadata" />
      )}

      {showIconRow && (
        <div className="msg-file-row">
          <div className="msg-file-icon-wrap">
            <FileTypeIcon mime={mime} fileName={message.fileName} />
          </div>
          <div className="msg-file-meta-block">
            <div className="msg-file-name" title={message.fileName || ''}>
              {message.fileName || 'Anhang'}
            </div>
            <div className="msg-file-size">{formatSize(message.fileSize || 0)}</div>
          </div>
        </div>
      )}

      {showImageMeta && (
        <div className="msg-file-footer msg-file-footer--image">
          <div className="msg-file-meta-block msg-file-meta-block--grow">
            <div className="msg-file-name" title={message.fileName || ''}>
              {message.fileName || 'Anhang'}
            </div>
            <div className="msg-file-size">{formatSize(message.fileSize || 0)}</div>
          </div>
        </div>
      )}

      {showMediaFooter && (
        <div className="msg-file-footer">
          <div className="msg-file-meta-block msg-file-meta-block--grow">
            <div className="msg-file-name" title={message.fileName || ''}>
              {message.fileName || 'Anhang'}
            </div>
            <div className="msg-file-size">{formatSize(message.fileSize || 0)}</div>
          </div>
        </div>
      )}

      {message.fileData && (
        <a
          href={dataUrl}
          download={message.fileName || 'file'}
          className="msg-file-download"
          title="Datei herunterladen"
        >
          <Download size={14} strokeWidth={CHAT_ICON_STROKE} aria-hidden />
          <span>Download</span>
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
  const { toast } = useToast();
  const {
    peers,
    contacts,
    chatMeta,
    loadedChats,
    messages,
    settings,
    sendMessage,
    loadChatMessages,
    connectToAddress,
    setContactNickname,
    setChatPinned,
    deleteChat,
  } = useApp();

  const location = useLocation();
  const navigate = useNavigate();

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingChat, setDeletingChat] = useState(false);

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
      const profilePicture = contact?.profilePicture || peer?.profilePicture || '';
      const bio = contact?.bio ?? peer?.bio ?? '';

      list.push({
        id,
        peer,
        contact,
        displayName: contact?.nickname || baseName,
        baseName,
        profilePicture,
        bio,
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

  const mainChatList = useMemo(
    () =>
      chatList.filter((chat) => {
        if (chat.contact?.pendingMessageRequest === true) return false;
        if (chat.messageCount === 0 && !chat.contact?.hasOutgoing) return false;
        return true;
      }),
    [chatList]
  );

  const filtered = useMemo(
    () => mainChatList.filter((chat) =>
      `${chat.displayName} ${chat.baseName} ${chat.id}`.toLowerCase().includes(search.toLowerCase())
    ),
    [mainChatList, search]
  );

  const selectedPeer = useMemo(
    () => chatList.find((c) => c.id === selectedPeerId) || null,
    [chatList, selectedPeerId]
  );

  const openPeerFromNav = location.state?.openPeerId;
  useEffect(() => {
    if (!openPeerFromNav) return;
    setSelectedPeerId(openPeerFromNav);
    navigate('.', { replace: true, state: {} });
  }, [openPeerFromNav, navigate]);

  useEffect(() => {
    if (openPeerFromNav) return;
    if (selectedPeerId != null) return;
    const first = mainChatList[0];
    if (first) setSelectedPeerId(first.id);
  }, [openPeerFromNav, selectedPeerId, mainChatList]);

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
      } catch (e) {
        if (!cancelled) {
          toast({
            variant: 'error',
            title: 'Could not load messages',
            message: e?.message || 'Check storage permissions or try again.',
          });
        }
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    }

    ensureMessages();
    return () => {
      cancelled = true;
    };
  }, [chatMeta, loadChatMessages, loadedChats, selectedPeerId, toast]);

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
        const msg = 'Message could not be delivered. Peer is probably offline.';
        setWarning(msg);
        toast({ variant: 'error', title: 'Message not sent', message: msg });
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
        const msg = 'File could not be delivered. Peer is probably offline.';
        setWarning(msg);
        toast({ variant: 'error', title: 'File not sent', message: msg });
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
    } catch (e) {
      toast({
        variant: 'error',
        title: 'Could not load older messages',
        message: e?.message || 'Try again in a moment.',
      });
    } finally {
      setLoadingMore(false);
    }
  };

  const handleFilePicked = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (file.size > MAX_CHAT_FILE_SIZE_BYTES) {
      const msg = `Max file size in chat is ${MAX_CHAT_FILE_SIZE_GB} GB.`;
      setWarning(msg);
      toast({ variant: 'warning', title: 'File too large', message: msg });
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
      const msg = 'Could not read file.';
      setWarning(msg);
      toast({ variant: 'error', title: 'File error', message: msg });
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
      const msg = err.message || 'Connection failed';
      setWarning(msg);
      toast({ variant: 'error', title: 'Connection failed', message: msg });
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

  const confirmDeleteChat = async () => {
    if (!selectedPeer) return;
    setDeletingChat(true);
    try {
      await deleteChat(selectedPeer.id);
      setSelectedPeerId(null);
      setWarning('');
      setPendingFile(null);
      setShowDeleteConfirm(false);
    } finally {
      setDeletingChat(false);
    }
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
              <Search size={14} strokeWidth={CHAT_ICON_STROKE} aria-hidden />
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
                <p>No chats yet. Use New in the sidebar for peers without a conversation, or connect below.</p>
              </div>
            )}
            {filtered.map((chat) => (
              <div
                key={chat.id}
                className={`list-item ${selectedPeer?.id === chat.id ? 'active' : ''}`}
                onClick={() => setSelectedPeerId(chat.id)}
              >
                <PeerAvatar pictureUrl={chat.profilePicture} name={chat.displayName} size={36} />
                <div className="list-item-info">
                  <div className="list-item-name-row">
                    <div className="list-item-name">{chat.displayName}</div>
                    {chat.pinned && (
                      <span className="chat-pin-badge" title="Angehefteter Chat">
                        <Pin size={12} strokeWidth={CHAT_ICON_STROKE} aria-hidden />
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
                  Connect to peer
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="chat-header">
                <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
                  <PeerAvatar pictureUrl={selectedPeer.profilePicture} name={selectedPeer.displayName} size={40} />
                  <div style={{ minWidth: 0 }}>
                    <div className="font-medium truncate" style={{ fontSize: 14 }}>{selectedPeer.displayName}</div>
                    <div className="text-sm text-muted chat-header-meta">
                      <span>
                        {selectedPeer.offline ? 'Offline' : 'Online'}
                        {selectedPeer.contact?.nickname && selectedPeer.baseName !== selectedPeer.contact.nickname
                          ? ` · ${selectedPeer.baseName}`
                          : ''}
                      </span>
                      {selectedPeer.bio ? (
                        <span className="chat-header-bio" title={selectedPeer.bio}>
                          {selectedPeer.bio}
                        </span>
                      ) : null}
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
                    title={selectedPeer.pinned ? 'Chat lösen' : 'Chat anheften'}
                  >
                    {selectedPeer.pinned ? (
                      <PinOff size={16} strokeWidth={CHAT_ICON_STROKE} aria-hidden />
                    ) : (
                      <Pin size={16} strokeWidth={CHAT_ICON_STROKE} aria-hidden />
                    )}
                  </button>
                  <button
                    className="btn btn-danger btn-icon"
                    onClick={() => setShowDeleteConfirm(true)}
                    title="Chat löschen"
                  >
                    <Trash2 size={16} strokeWidth={CHAT_ICON_STROKE} aria-hidden />
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

                {msgs.map((m, i) => {
                  const isSelf = m.from === 'self';
                  const bubbleName = isSelf ? (settings.displayName || 'You') : (m.sender || selectedPeer.displayName);
                  const bubblePic = isSelf ? settings.profilePicture : selectedPeer.profilePicture;
                  return (
                    <div
                      key={`${m.timestamp || i}-${m.from || 'msg'}-${i}`}
                      className={`msg-row ${isSelf ? 'msg-row-self' : 'msg-row-other'}`}
                    >
                      <PeerAvatar pictureUrl={bubblePic} name={bubbleName} size={28} className="msg-avatar" />
                      <div className={`msg ${isSelf ? 'msg-self' : 'msg-other'} animate-in`}>
                        {!isSelf && <div className="msg-sender">{m.sender || m.from}</div>}
                        {m.kind === 'file' ? <FileMessage message={m} /> : <ChatMessage message={m} />}
                        <div className="msg-time">{formatTime(m.timestamp)}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              {pendingFile && (
                <div className="pending-file">
                  <div className="pending-file-icon-wrap" aria-hidden>
                    <FileTypeIcon mime={pendingFile.type} fileName={pendingFile.name} size={20} />
                  </div>
                  <div className="pending-file-info">
                    <div className="pending-file-name">{pendingFile.name}</div>
                    <div className="pending-file-meta">{formatSize(pendingFile.size)}</div>
                  </div>
                  {pendingFile.type.startsWith('image/') && (
                    <img src={pendingFile.dataUrl} alt="" className="pending-file-preview" />
                  )}
                  {pendingFile.type.startsWith('video/') && (
                    <video src={pendingFile.dataUrl} className="pending-file-preview pending-file-preview--video" muted playsInline preload="metadata" />
                  )}
                  <button
                    className="btn btn-ghost btn-icon"
                    onClick={() => setPendingFile(null)}
                    title="Anhang entfernen"
                    type="button"
                  >
                    <X size={16} strokeWidth={CHAT_ICON_STROKE} />
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
                  title="Datei anhängen"
                  style={{ height: 40, width: 40 }}
                >
                  <Paperclip size={17} strokeWidth={CHAT_ICON_STROKE} aria-hidden />
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
                  title="Nachricht senden"
                >
                  <SendHorizontal size={17} strokeWidth={CHAT_ICON_STROKE} aria-hidden />
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
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => setShowConnect(false)} aria-label="Schließen">
                <X size={16} strokeWidth={CHAT_ICON_STROKE} />
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
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => setShowNickname(false)} aria-label="Schließen">
                <X size={16} strokeWidth={CHAT_ICON_STROKE} />
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

      {showDeleteConfirm && selectedPeer && (
        <div
          className="modal-overlay"
          onClick={() => !deletingChat && setShowDeleteConfirm(false)}
        >
          <div className="modal modal-danger animate-scale" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 style={{ margin: 0 }}>Delete chat?</h3>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => !deletingChat && setShowDeleteConfirm(false)}
                disabled={deletingChat}
                aria-label="Schließen"
              >
                <X size={16} strokeWidth={CHAT_ICON_STROKE} />
              </button>
            </div>
            <p className="text-muted" style={{ margin: '0 0 16px', lineHeight: 1.5 }}>
              This removes the conversation with <strong>{selectedPeer.displayName}</strong> and all messages stored on this device. This cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deletingChat}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={confirmDeleteChat}
                disabled={deletingChat}
              >
                {deletingChat ? 'Deleting…' : 'Delete chat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
