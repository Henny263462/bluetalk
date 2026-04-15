import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Info, X, XCircle } from 'lucide-react';

const ToastContext = createContext(null);

function toastId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input) => {
      const opts = typeof input === 'string' ? { message: input } : input || {};
      const id = opts.id || toastId();
      const {
        title,
        message = '',
        variant = 'info',
        duration = 4800,
      } = opts;

      setToasts((prev) => [...prev, { id, title, message, variant }]);

      if (duration > 0) {
        window.setTimeout(() => dismissToast(id), duration);
      }
      return id;
    },
    [dismissToast]
  );

  const value = useMemo(() => ({ toast, dismissToast }), [toast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-relevant="additions text">
        {toasts.map((t) => {
          const Icon =
            t.variant === 'success'
              ? CheckCircle
              : t.variant === 'error'
                ? XCircle
                : t.variant === 'warning'
                  ? AlertCircle
                  : Info;
          return (
            <div key={t.id} className={`toast toast--${t.variant}`} role="status">
              <Icon className="toast-icon" size={18} strokeWidth={2} aria-hidden />
              <div className="toast-body">
                {t.title ? <div className="toast-title">{t.title}</div> : null}
                {t.message ? <div className="toast-message">{t.message}</div> : null}
              </div>
              <button
                type="button"
                className="toast-dismiss btn btn-ghost btn-icon"
                onClick={() => dismissToast(t.id)}
                aria-label="Dismiss notification"
              >
                <X size={14} strokeWidth={2} aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
