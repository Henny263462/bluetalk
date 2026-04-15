import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, Wifi, X } from 'lucide-react';
import { useApp } from '../App';
import { useToast } from '../components/ToastProvider';

export default function NewConnectionsPage() {
  const { toast } = useToast();
  const { peers, contacts, chatMeta, connectToAddress, upsertContact } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showConnect, setShowConnect] = useState(false);
  const [connectAddress, setConnectAddress] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  const newPeerRows = useMemo(() => {
    const ids = new Set([
      ...peers.map((p) => p.id),
      ...contacts.map((c) => c.id),
    ]);
    ids.delete('self');

    const rows = [];
    for (const id of ids) {
      const count = chatMeta[id]?.count || 0;
      const contact = contacts.find((c) => c.id === id);
      if (count > 0) continue;
      if (contact?.pendingMessageRequest) continue;
      if (contact?.hasOutgoing) continue;

      const peer = peers.find((p) => p.id === id);
      const baseName = contact?.name || peer?.name || id;
      rows.push({
        id,
        peer,
        contact,
        displayName: contact?.nickname || baseName,
        baseName,
        offline: !peer,
      });
    }

    return rows.sort((a, b) => {
      if (a.offline !== b.offline) return Number(a.offline) - Number(b.offline);
      return (a.displayName || '').localeCompare(b.displayName || '', undefined, { sensitivity: 'base' });
    });
  }, [peers, contacts, chatMeta]);

  const filtered = useMemo(
    () =>
      newPeerRows.filter((row) =>
        `${row.displayName} ${row.baseName} ${row.id}`.toLowerCase().includes(search.toLowerCase())
      ),
    [newPeerRows, search]
  );

  const startChat = (peerId) => {
    upsertContact({ id: peerId, hasOutgoing: true });
    navigate('/', { state: { openPeerId: peerId } });
  };

  const handleConnect = async () => {
    if (!connectAddress.trim()) return;
    setConnecting(true);
    setError('');
    try {
      const peerInfo = await connectToAddress(connectAddress.trim());
      setShowConnect(false);
      setConnectAddress('');
      navigate('/', { state: { openPeerId: peerInfo.id } });
    } catch (err) {
      const msg = err.message || 'Connection failed';
      setError(msg);
      toast({ variant: 'error', title: 'Connection failed', message: msg });
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title-row">
          <span className="page-title-icon">
            <UserPlus size={22} strokeWidth={2} />
          </span>
          New connections
        </h1>
        <p>Peers you have not started a chat with yet. Open a conversation here first.</p>
      </div>
      <div className="page-body">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="search-bar flex-1" style={{ minWidth: 200, maxWidth: 360 }}>
            <Search size={14} />
            <input
              className="input"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowConnect(true)}>
            <Wifi size={14} />
            Connect to peer
          </button>
        </div>

        {error && (
          <div className="chat-warning mb-3" style={{ margin: '0 0 12px' }}>
            {error}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="card">
            <p className="text-muted text-sm">
              No new connections. When someone connects or you add a peer without messages yet, they appear here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((row) => (
              <div key={row.id} className="card card-row">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="list-item-avatar">{(row.displayName || '?')[0].toUpperCase()}</div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{row.displayName}</div>
                    <div className="text-xs text-muted truncate">
                      {row.offline ? 'Offline' : 'Online'}
                      {row.id !== row.displayName ? ` · ${row.id}` : ''}
                    </div>
                  </div>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => startChat(row.id)}>
                  Start chat
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showConnect && (
        <div className="modal-overlay" onClick={() => setShowConnect(false)}>
          <div className="modal animate-scale" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 style={{ margin: 0 }}>Connect to peer</h3>
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => setShowConnect(false)}>
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
              <button type="button" className="btn btn-secondary" onClick={() => setShowConnect(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConnect}
                disabled={!connectAddress.trim() || connecting}
              >
                {connecting ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
