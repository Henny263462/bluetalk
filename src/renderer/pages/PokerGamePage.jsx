import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Minus, X, Settings, Users, Play, RotateCcw, LogOut, Bot, Crown, Volume2, VolumeX } from 'lucide-react';
import './PokerGamePage.css';

const RN = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SN = ['♣', '♦', '♥', '♠'];

function cardLabelFromRaw(c) {
  if (typeof c !== 'number') return String(c || '');
  const r = c % 13;
  const s = (c / 13) | 0;
  return RN[r] + SN[s];
}

function isRedLabel(label) {
  return label.includes('♦') || label.includes('♥');
}

const PHASE_LABELS = {
  lobby: 'Lobby',
  preflop: 'Preflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown',
  between: 'Zwischenhände',
  idle: 'Warte',
};

const HAND_LABELS = {
  'Straight Flush': 'Straight Flush',
  'Vierling': 'Vierling',
  'Full House': 'Full House',
  'Flush': 'Flush',
  'Straight': 'Straight',
  'Drilling': 'Drilling',
  'Zwei Paare': 'Zwei Paare',
  'Paar': 'Paar',
  'High Card': 'High Card',
  'Gewinn (alle anderen gefoldet)': 'Gewinn (alle gefoldet)',
};

function usePokerState() {
  const [snapshot, setSnapshot] = useState(null);
  const [selfId, setSelfId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const info = await window.bluetalk?.peer?.getInfo?.();
        if (!cancelled && info?.id) setSelfId(info.id);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!window.bluetalk?.poker?.onState) return undefined;
    return window.bluetalk.poker.onState((payload) => {
      setSnapshot(payload || null);
      if (payload?.public?.hostPeerId) {
        setIsHost(payload.public.hostPeerId === selfId);
      }
    });
  }, [selfId]);

  const send = useCallback((action) => {
    window.bluetalk?.poker?.sendAction?.({ type: 'action', action });
  }, []);

  return { snapshot, selfId, isHost, send, soundEnabled, setSoundEnabled };
}

function Card3D({ label, hidden = false, animate = false }) {
  const red = !hidden && isRedLabel(label);
  return (
    <div className={`poker-card-3d ${animate ? 'poker-card-deal' : ''} ${hidden ? 'poker-card-back' : ''}`}>
      {!hidden && (
        <>
          <div className="poker-card-corner poker-card-tl">{label}</div>
          <div className="poker-card-center">{label.slice(-1)}</div>
          <div className="poker-card-corner poker-card-br">{label}</div>
        </>
      )}
      {hidden && <div className="poker-card-pattern" />}
      <div className={`poker-card-suit ${red ? 'red' : ''}`}>
        {!hidden && label.slice(-1)}
      </div>
    </div>
  );
}

function PokerChip({ value, small = false }) {
  const colors = {
    5: '#ef4444',
    10: '#3b82f6',
    25: '#22c55e',
    50: '#eab308',
    100: '#1f2937',
    500: '#a855f7',
    1000: '#f97316',
  };
  const color = colors[value] || '#6b7280';
  return (
    <div className={`poker-chip ${small ? 'poker-chip-small' : ''}`} style={{ '--chip-color': color }}>
      <div className="poker-chip-inner">
        <span>{value >= 1000 ? `${value / 1000}k` : value}</span>
      </div>
    </div>
  );
}

function PlayerAvatar({ name, isDealer, isActive, isHost, isBot, folded, allIn, chips, bet }) {
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <div className={`poker-player-avatar ${isActive ? 'active' : ''} ${folded ? 'folded' : ''} ${allIn ? 'allin' : ''}`}>
      <div className="poker-avatar-circle">
        <span>{initials}</span>
        {isDealer && <div className="poker-dealer-badge">D</div>}
        {isHost && <Crown size={10} className="poker-host-icon" />}
        {isBot && <Bot size={10} className="poker-bot-icon" />}
      </div>
      <div className="poker-avatar-name">{name}</div>
      <div className="poker-avatar-chips">{chips.toLocaleString()}</div>
      {bet > 0 && (
        <div className="poker-avatar-bet">
          <PokerChip value={bet} small />
        </div>
      )}
    </div>
  );
}

function SettingsPanel({ settings, isHost, onUpdate }) {
  const [local, setLocal] = useState(settings || {});

  useEffect(() => {
    setLocal(settings || {});
  }, [settings]);

  const update = (key, value) => {
    const next = { ...local, [key]: value };
    setLocal(next);
    if (isHost) onUpdate?.(next);
  };

  return (
    <div className="poker-settings-panel">
      <h4><Settings size={14} /> Tischeinstellungen</h4>
      <div className="poker-settings-grid">
        <label>
          Tischname
          <input value={local.tableName || ''} onChange={e => update('tableName', e.target.value)} disabled={!isHost} />
        </label>
        <label>
          Small Blind
          <input type="number" value={local.smallBlind || 10} onChange={e => update('smallBlind', Number(e.target.value))} disabled={!isHost} />
        </label>
        <label>
          Big Blind
          <input type="number" value={local.bigBlind || 20} onChange={e => update('bigBlind', Number(e.target.value))} disabled={!isHost} />
        </label>
        <label>
          Ante
          <input type="number" value={local.ante || 0} onChange={e => update('ante', Number(e.target.value))} disabled={!isHost} />
        </label>
        <label>
          Start-Chips
          <input type="number" value={local.startingChips || 2000} onChange={e => update('startingChips', Number(e.target.value))} disabled={!isHost} />
        </label>
        <label>
          Max. Spieler
          <input type="number" min="2" max="9" value={local.maxPlayers || 6} onChange={e => update('maxPlayers', Number(e.target.value))} disabled={!isHost} />
        </label>
        <label>
          Zugzeit (Sek.)
          <input type="number" value={local.turnTimeSec || 0} onChange={e => update('turnTimeSec', Number(e.target.value))} disabled={!isHost} />
        </label>
        <label className="poker-settings-checkbox">
          <input type="checkbox" checked={local.autoStart || false} onChange={e => update('autoStart', e.target.checked)} disabled={!isHost} />
          Auto-Start
        </label>
      </div>
    </div>
  );
}

function LobbyView({ snapshot, selfId, isHost, onStart, onLeave, onAddBot, onRemoveBot, settings, onUpdateSettings }) {
  const pub = snapshot?.public;
  const players = pub?.players || [];
  const hasBot = players.some(p => p.isBot);
  const canStart = players.filter(p => !p.isBot).length >= 2;

  return (
    <div className="poker-lobby">
      <div className="poker-lobby-header">
        <h2>{pub?.settings?.tableName || 'Poker-Tisch'}</h2>
        <div className="poker-lobby-meta">
          <span><Users size={14} /> {players.length} / {pub?.settings?.maxPlayers || 6} Spieler</span>
          <span>SB/BB: {pub?.settings?.smallBlind || 10}/{pub?.settings?.bigBlind || 20}</span>
        </div>
      </div>

      <div className="poker-lobby-table">
        <div className="poker-lobby-seats">
          {Array.from({ length: pub?.settings?.maxPlayers || 6 }).map((_, i) => {
            const player = players.find(p => p.seat === i);
            return (
              <div key={i} className={`poker-lobby-seat ${player ? 'occupied' : 'empty'}`}>
                {player ? (
                  <>
                    <div className="poker-lobby-avatar">
                      {player.name?.slice(0, 2).toUpperCase()}
                      {player.peerId === pub?.hostPeerId && <Crown size={10} />}
                      {player.isBot && <Bot size={10} />}
                    </div>
                    <div className="poker-lobby-player-info">
                      <span className="poker-lobby-player-name">
                        {player.name}
                        {player.peerId === selfId ? ' (Du)' : ''}
                      </span>
                      <span className="poker-lobby-player-chips">{player.chips.toLocaleString()} Chips</span>
                    </div>
                  </>
                ) : (
                  <span className="poker-lobby-empty">Platz {i + 1}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="poker-lobby-actions">
        {isHost && (
          <>
            <button className="poker-btn-primary" onClick={onStart} disabled={!canStart}>
              <Play size={16} /> Hand starten
            </button>
            {!hasBot ? (
              <button className="poker-btn-ghost" onClick={onAddBot}>
                <Bot size={16} /> Bot hinzufügen
              </button>
            ) : (
              <button className="poker-btn-ghost" onClick={onRemoveBot}>
                <Bot size={16} /> Bot entfernen
              </button>
            )}
          </>
        )}
        <button className="poker-btn-ghost" onClick={onLeave}>
          <LogOut size={16} /> Tisch verlassen
        </button>
      </div>

      <SettingsPanel settings={settings} isHost={isHost} onUpdate={onUpdateSettings} />
    </div>
  );
}

function GameTable({ snapshot, selfId, onAction }) {
  const pub = snapshot?.public;
  const myHole = snapshot?.myHole || [];
  const players = pub?.players || [];
  const board = pub?.board || [];
  const phase = pub?.phase;
  const isBetween = phase === 'between' || phase === 'showdown';

  const selfPlayer = players.find(p => p.peerId === selfId);
  const selfIndex = players.findIndex(p => p.peerId === selfId);

  // Positioniere Spieler im Kreis
  const positionedPlayers = useMemo(() => {
    if (!players.length) return [];
    const maxSeats = pub?.settings?.maxPlayers || 6;
    const result = [];
    
    for (let i = 0; i < maxSeats; i++) {
      const player = players.find(p => p.seat === i);
      if (player) {
        // Berechne relative Position zum eigenen Spieler
        let relPos = i - (selfPlayer?.seat || 0);
        if (relPos < 0) relPos += maxSeats;
        
        let position = 'side';
        if (relPos === 0) position = 'bottom';
        else if (relPos === Math.floor(maxSeats / 2)) position = 'top';
        else if (relPos < Math.floor(maxSeats / 2)) position = 'left';
        else position = 'right';

        result.push({ ...player, position, relPos });
      }
    }
    return result;
  }, [players, selfPlayer, pub?.settings?.maxPlayers]);

  const sidePlayers = positionedPlayers.filter(p => p.position === 'left' || p.position === 'right');
  const topPlayer = positionedPlayers.find(p => p.position === 'top');

  const canAct = pub?.toAct === selfId && !isBetween && phase !== 'lobby' && phase !== 'idle';
  const toCall = pub?.currentBet ? pub.currentBet - (selfPlayer?.currentRoundBet || 0) : 0;

  return (
    <div className="poker-table-container">
      {/* Top Player */}
      {topPlayer && (
        <div className="poker-player-top">
          <PlayerAvatar
            name={topPlayer.name}
            isDealer={pub?.dealerSeat === topPlayer.seat}
            isActive={pub?.toAct === topPlayer.peerId}
            isHost={topPlayer.peerId === pub?.hostPeerId}
            isBot={topPlayer.isBot}
            folded={topPlayer.folded}
            allIn={topPlayer.allIn}
            chips={topPlayer.chips}
            bet={topPlayer.currentRoundBet}
          />
        </div>
      )}

      <div className="poker-table-middle">
        {/* Left Players */}
        <div className="poker-players-left">
          {sidePlayers.filter(p => p.position === 'left').map(player => (
            <PlayerAvatar
              key={player.peerId}
              name={player.name}
              isDealer={pub?.dealerSeat === player.seat}
              isActive={pub?.toAct === player.peerId}
              isHost={player.peerId === pub?.hostPeerId}
              isBot={player.isBot}
              folded={player.folded}
              allIn={player.allIn}
              chips={player.chips}
              bet={player.currentRoundBet}
            />
          ))}
        </div>

        {/* Center - Board & Pot */}
        <div className="poker-table-center">
          <div className="poker-felt">
            {/* Pot */}
            <div className="poker-pot-area">
              {pub?.pot > 0 && (
                <div className="poker-pot">
                  <PokerChip value={Math.min(pub.pot, 1000)} />
                  <span className="poker-pot-amount">{pub.pot.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Board */}
            <div className="poker-board">
              {board.map((card, i) => (
                <Card3D key={i} label={card} animate={i >= board.length - (phase === 'flop' ? 3 : 1)} />
              ))}
              {board.length === 0 && phase !== 'lobby' && (
                <div className="poker-board-placeholder">Warte auf Karten...</div>
              )}
            </div>

            {/* Winner Anzeige */}
            {isBetween && pub?.winners?.length > 0 && (
              <div className="poker-winner-banner">
                {pub.winners.map((w, i) => (
                  <div key={i} className="poker-winner">
                    <Crown size={16} />
                    <span>{w.peerId === selfId ? 'Du' : w.peerId.slice(0, 8)} gewinnt {w.amount.toLocaleString()}</span>
                    <span className="poker-winner-hand">{HAND_LABELS[w.hand] || w.hand}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Players */}
        <div className="poker-players-right">
          {sidePlayers.filter(p => p.position === 'right').map(player => (
            <PlayerAvatar
              key={player.peerId}
              name={player.name}
              isDealer={pub?.dealerSeat === player.seat}
              isActive={pub?.toAct === player.peerId}
              isHost={player.peerId === pub?.hostPeerId}
              isBot={player.isBot}
              folded={player.folded}
              allIn={player.allIn}
              chips={player.chips}
              bet={player.currentRoundBet}
            />
          ))}
        </div>
      </div>

      {/* Bottom - Self */}
      <div className="poker-player-self">
        <div className="poker-self-info">
          <PlayerAvatar
            name={selfPlayer?.name || 'Du'}
            isDealer={pub?.dealerSeat === selfPlayer?.seat}
            isActive={canAct}
            isHost={selfId === pub?.hostPeerId}
            chips={selfPlayer?.chips || 0}
            bet={selfPlayer?.currentRoundBet || 0}
          />
        </div>

        {/* Hole Cards */}
        <div className="poker-hole-cards">
          {myHole.length > 0 ? (
            <>
              <Card3D label={cardLabelFromRaw(myHole[0])} animate />
              <Card3D label={cardLabelFromRaw(myHole[1])} animate />
            </>
          ) : (
            <>
              <Card3D hidden />
              <Card3D hidden />
            </>
          )}
        </div>

        {/* Actions */}
        {canAct && (
          <div className="poker-action-bar">
            <div className="poker-action-info">
              <span>Du bist am Zug</span>
              {toCall > 0 && <span className="poker-tocall">Zu callen: {toCall.toLocaleString()}</span>}
            </div>
            <div className="poker-actions">
              <button className="poker-act-fold" onClick={() => onAction({ type: 'fold' })}>
                Fold
              </button>
              {toCall === 0 ? (
                <button className="poker-act-check" onClick={() => onAction({ type: 'check' })}>
                  Check
                </button>
              ) : (
                <button className="poker-act-call" onClick={() => onAction({ type: 'call' })}>
                  Call {toCall.toLocaleString()}
                </button>
              )}
              <button className="poker-act-raise" onClick={() => onAction({ type: 'raise', amount: pub?.settings?.bigBlind || 20 })}>
                Raise
              </button>
              <button className="poker-act-allin" onClick={() => onAction({ type: 'all_in' })}>
                All-in
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Game Info Bar */}
      <div className="poker-game-info">
        <span className="poker-phase">{PHASE_LABELS[phase] || phase}</span>
        <span className="poker-hand-num">Hand #{pub?.handNumber || 0}</span>
        <span className="poker-blinds">Blinds: {pub?.settings?.smallBlind}/{pub?.settings?.bigBlind}</span>
        {pub?.message && <span className="poker-message">{pub.message}</span>}
      </div>
    </div>
  );
}

export default function PokerGamePage() {
  const { snapshot, selfId, isHost, send, soundEnabled, setSoundEnabled } = usePokerState();
  const [showSettings, setShowSettings] = useState(false);
  const pub = snapshot?.public;
  const phase = pub?.phase;
  const inLobby = !phase || phase === 'lobby';

  const closeWin = useCallback(() => {
    window.bluetalk?.poker?.closeGameWindow?.();
  }, []);

  const minimizeWin = useCallback(() => {
    window.bluetalk?.window?.minimize?.();
  }, []);

  const handleStart = useCallback(() => {
    window.bluetalk?.poker?.sendAction?.({ type: 'host_start' });
  }, []);

  const handleLeave = useCallback(() => {
    window.bluetalk?.poker?.sendAction?.({ type: 'leave' });
    closeWin();
  }, [closeWin]);

  const handleAddBot = useCallback(() => {
    window.bluetalk?.poker?.sendAction?.({ type: 'add_bot' });
  }, []);

  const handleRemoveBot = useCallback(() => {
    window.bluetalk?.poker?.sendAction?.({ type: 'remove_bot' });
  }, []);

  const handleUpdateSettings = useCallback((settings) => {
    window.bluetalk?.poker?.sendAction?.({ type: 'update_settings', settings });
  }, []);

  return (
    <div className="poker-game-root">
      <div className="poker-game-grain" aria-hidden />
      
      <header className="poker-game-titlebar">
        <div className="poker-title">
          <h1>{pub?.settings?.tableName || 'Poker'}</h1>
          <div className="poker-game-titlebar-sub">
            Texas Hold'em · {inLobby ? 'Lobby' : PHASE_LABELS[phase]}
          </div>
        </div>
        <div className="poker-game-titlebar-actions">
          <button 
            type="button" 
            className="poker-game-btn-icon" 
            title={soundEnabled ? "Ton aus" : "Ton an"}
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button 
            type="button" 
            className="poker-game-btn-icon" 
            title="Einstellungen"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings size={16} />
          </button>
          <button type="button" className="poker-game-btn-icon" title="Minimieren" onClick={minimizeWin}>
            <Minus size={16} />
          </button>
          <button type="button" className="poker-game-btn-icon" title="Schließen" onClick={closeWin}>
            <X size={16} />
          </button>
        </div>
      </header>

      <main className="poker-game-main">
        {inLobby ? (
          <LobbyView
            snapshot={snapshot}
            selfId={selfId}
            isHost={isHost}
            onStart={handleStart}
            onLeave={handleLeave}
            onAddBot={handleAddBot}
            onRemoveBot={handleRemoveBot}
            settings={pub?.settings}
            onUpdateSettings={handleUpdateSettings}
          />
        ) : (
          <GameTable
            snapshot={snapshot}
            selfId={selfId}
            onAction={send}
          />
        )}

        {showSettings && (
          <div className="poker-settings-modal">
            <SettingsPanel
              settings={pub?.settings}
              isHost={isHost}
              onUpdate={handleUpdateSettings}
            />
            <button className="poker-btn-ghost" onClick={() => setShowSettings(false)}>Schließen</button>
          </div>
        )}
      </main>
    </div>
  );
}
