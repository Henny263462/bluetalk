import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { pluginRuntime } from './pluginRuntime';

/**
 * Global modal host for plugin-registered screens. A plugin opens a screen by
 * calling `BlueTalkPlugin.ui.openScreen('my-screen', ctx)`.
 */
export default function PluginScreenHost() {
  const [state, setState] = useState(null); // { screen, ctx }
  const containerRef = useRef(null);

  useEffect(() => {
    const offOpen = pluginRuntime.onScreenOpen(({ screen, ctx }) => {
      setState({ screen, ctx });
    });
    const offClose = pluginRuntime.onScreenClose(() => setState(null));
    return () => {
      offOpen();
      offClose();
    };
  }, []);

  useEffect(() => {
    if (!state || !containerRef.current) return undefined;
    const container = containerRef.current;
    container.innerHTML = '';
    let cleanup = null;
    try {
      cleanup = state.screen.render(container, {
        ...state.ctx,
        close: () => setState(null),
      });
    } catch (e) {
      console.error('[PluginScreenHost] render failed:', e);
    }
    return () => {
      try {
        if (typeof cleanup === 'function') cleanup();
      } catch {
        /* ignore */
      }
      container.innerHTML = '';
    };
  }, [state]);

  if (!state) return null;

  return (
    <div className="plugin-screen-overlay" role="dialog">
      <div className="plugin-screen-dialog">
        <div className="plugin-screen-header">
          <span className="plugin-screen-title">{state.screen.title}</span>
          <button
            type="button"
            className="plugin-screen-close"
            onClick={() => setState(null)}
            aria-label="Close"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        <div ref={containerRef} className="plugin-screen-body" />
      </div>
    </div>
  );
}
