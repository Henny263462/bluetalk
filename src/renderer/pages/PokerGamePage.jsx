import React, { useCallback, useEffect, useState } from 'react';
import { Minus, X } from 'lucide-react';
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

export default function PokerGamePage() {
  const [snapshot, setSnapshot] = useState(null);
  const [selfId, setSelfId] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const info = await window.bluetalk?.peer?.getInfo?.();
        if (!cancelled && info?.id) setSelfId(info.id);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!window.bluetalk?.poker?.onState) return undefined;
    return window.bluetalk.poker.onState((payload) => {
      setSnapshot(payload || null);
    });
  }, []);

  const send = useCallback((action) => {
    window.bluetalk?.poker?.sendAction?.({ type: 'action', action });
  }, []);

  const closeWin = useCallback(() => {
    window.bluetalk?.poker?.closeGameWindow?.();
  }, []);

  const minimizeWin = useCallback(() => {
    window.bluetalk?.window?.minimize?.();
  }, []);

  const pub = snapshot?.public;
  const myHoleRaw = snapshot?.myHole;

  const holeLabels =
    Array.isArray(myHoleRaw) && myHoleRaw.length
      ? myHoleRaw.map(cardLabelFromRaw)
      : [];

  const board = pub?.board || [];
  const players = pub?.players || [];
  const settings = pub?.settings || {};
  const canAct =
    pub
    && selfId
    && pub.toAct === selfId
    && pub.phase !== 'between'
    && pub.phase !== 'lobby'
    && pub.phase !== 'showdown'
    && pub.phase !== 'idle';

  const tableTitle = settings.tableName || 'Poker';

  return (
    <div className="poker-game-root">
      <div className="poker-game-grain" aria-hidden />
      <header className="poker-game-titlebar">
        <div>
          <h1>{tableTitle}</h1>
          <div className="poker-game-titlebar-sub">
            Texas Hold&apos;em · Midnight Table
          </div>
        </div>
        <div className="poker-game-titlebar-actions">
          <button type="button" className="poker-game-btn-icon" title="Minimieren" onClick={minimizeWin}>
            <Minus size={18} strokeWidth={2} />
          </button>
          <button type="button" className="poker-game-btn-icon" title="Fenster schließen" onClick={closeWin}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>
      </header>

      <main className="poker-game-main">
        {!pub || pub.phase === 'lobby' ? (
          <div className="poker-game-wait">
            <p>
              <strong>Warte auf Spielstart</strong>
            </p>
            <p>
              Starte eine Hand in der BlueTalk-App unter Plugins → Poker, oder warte bis der Host die nächste Hand
              beginnt.
            </p>
          </div>
        ) : (
          <div className="poker-game-felt">
            <div className="poker-game-meta">
              <span>
                Phase: <strong>{pub.phase}</strong>
              </span>
              <span>
                Pot: <strong>{pub.pot ?? 0}</strong>
              </span>
              <span>
                Hand: <strong>#{pub.handNumber ?? 0}</strong>
              </span>
            </div>

            <div className="poker-game-board">
              {board.length ? (
                board.map((c, i) => (
                  <div
                    key={`${c}-${i}`}
                    className={`poker-game-card ${isRedLabel(c) ? 'poker-game-card--red' : ''}`}
                  >
                    {c}
                  </div>
                ))
              ) : (
                <span className="poker-game-card poker-game-card--dim">—</span>
              )}
            </div>

            <div className="poker-game-holes">
              Deine Karten:
              <span>
                {holeLabels.length
                  ? holeLabels.map((c) => (
                      <span
                        key={c}
                        className={`poker-game-card ${isRedLabel(c) ? 'poker-game-card--red' : ''}`}
                        style={{ width: 44, height: 62, fontSize: 13 }}
                      >
                        {c}
                      </span>
                    ))
                  : '—'}
              </span>
            </div>

            <div className="poker-game-players">
              {players.map((p) => (
                <div
                  key={p.peerId}
                  className={`poker-game-seat ${pub.toAct === p.peerId ? 'poker-game-seat--active' : ''}`}
                >
                  <div className="poker-game-seat-name">
                    {p.name}
                    {p.peerId === selfId ? ' · du' : ''}
                    {p.peerId === pub.hostPeerId ? ' · Host' : ''}
                    {p.isBot ? ' · Bot' : ''}
                  </div>
                  <div className="poker-game-seat-meta">
                    {p.chips} Chips
                    {p.folded ? ' · fold' : ''}
                    {p.allIn ? ' · all-in' : ''}
                  </div>
                </div>
              ))}
            </div>

            {pub.message ? <p className="poker-game-msg">{pub.message}</p> : null}

            {(pub.winners || []).length > 0 ? (
              <div className="poker-game-winners">
                {(pub.winners || []).map((w, i) => (
                  <div key={`${w.peerId}-${i}`}>
                    {w.peerId === selfId ? 'Du' : w.peerId}: +{w.amount} — {w.hand || ''}
                  </div>
                ))}
              </div>
            ) : null}

            {canAct ? (
              <div className="poker-game-actions">
                <button type="button" className="poker-game-act" onClick={() => send({ type: 'fold' })}>
                  Fold
                </button>
                <button type="button" className="poker-game-act" onClick={() => send({ type: 'check' })}>
                  Check
                </button>
                <button type="button" className="poker-game-act" onClick={() => send({ type: 'call' })}>
                  Call
                </button>
                <button
                  type="button"
                  className="poker-game-act poker-game-act--primary"
                  onClick={() => send({ type: 'raise', amount: settings.bigBlind || 20 })}
                >
                  Raise +BB
                </button>
                <button
                  type="button"
                  className="poker-game-act poker-game-act--primary"
                  onClick={() => send({ type: 'all_in' })}
                >
                  All-in
                </button>
              </div>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
