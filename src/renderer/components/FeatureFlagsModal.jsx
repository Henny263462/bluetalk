import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { FEATURE_FLAG_DEFINITIONS, getEffectiveFlag } from '../featureFlags';

const ICON_STROKE = 1.75;

export default function FeatureFlagsModal({ open, onClose, settings, updateSettings }) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedId(null);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return FEATURE_FLAG_DEFINITIONS;
    return FEATURE_FLAG_DEFINITIONS.filter(
      (d) =>
        d.label.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q)
    );
  }, [search]);

  if (!open) return null;

  const selected = selectedId ? FEATURE_FLAG_DEFINITIONS.find((d) => d.id === selectedId) : null;

  const setFlag = (id, value) => {
    updateSettings({ featureFlags: { [id]: value } });
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="presentation"
      style={{ zIndex: 1100 }}
    >
      <div
        className="modal animate-scale feature-flags-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feature-flags-title"
      >
        {!selected ? (
          <>
            <div className="feature-flags-modal-head">
              <div className="flex items-center justify-between gap-2">
                <h2 id="feature-flags-title" style={{ margin: 0, fontSize: '1.05rem' }}>
                  Feature flags
                </h2>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  onClick={onClose}
                  aria-label="Schließen"
                >
                  <X size={18} strokeWidth={ICON_STROKE} />
                </button>
              </div>
              <input
                type="search"
                className="input feature-flags-search"
                placeholder="Suchen…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="feature-flags-body">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted" style={{ margin: 12 }}>Keine Treffer.</p>
              ) : (
                filtered.map((def) => {
                  const on = getEffectiveFlag(settings, def.id);
                  return (
                    <button
                      key={def.id}
                      type="button"
                      className="feature-flags-row"
                      onClick={() => setSelectedId(def.id)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium" style={{ fontSize: 14 }}>{def.label}</span>
                        <span className={`badge ${on ? 'badge-success' : 'badge-muted'}`}>
                          {on ? 'An' : 'Aus'}
                        </span>
                      </div>
                      <div className="text-xs text-muted font-mono" style={{ marginTop: 6 }}>{def.id}</div>
                    </button>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <div className="feature-flags-detail">
            <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setSelectedId(null)}
                aria-label="Zurück zur Liste"
              >
                <ChevronLeft size={20} strokeWidth={ICON_STROKE} />
              </button>
              <h2 style={{ margin: 0, fontSize: '1.05rem', flex: 1 }}>{selected.label}</h2>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={onClose}
                aria-label="Schließen"
              >
                <X size={18} strokeWidth={ICON_STROKE} />
              </button>
            </div>
            <p className="text-xs text-muted font-mono" style={{ margin: '8px 0 0 40px' }}>{selected.id}</p>
            <div className="feature-flags-detail-desc">{selected.description}</div>
            <div
              className="toggle-row"
              style={{
                marginTop: 'auto',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '12px 14px',
                flexShrink: 0,
              }}
            >
              <div className="toggle-row-info">
                <span>Aktiviert</span>
                <span>Schalter für diese Option</span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={getEffectiveFlag(settings, selected.id)}
                  onChange={(e) => setFlag(selected.id, e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
