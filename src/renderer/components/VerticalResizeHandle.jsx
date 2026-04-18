import React, { useCallback } from 'react';

/**
 * Vertikaler Griffsstreifen (ändert die Breite des linken Panels bei Drag nach links/rechts).
 */
export default function VerticalResizeHandle({ onBegin, onDelta, onCommit, onDoubleClick, className = '' }) {
  const onMouseDown = useCallback(
    (e) => {
      if (e.detail > 1) return;
      e.preventDefault();
      onBegin?.();
      let lastX = e.clientX;
      const move = (ev) => {
        const dx = ev.clientX - lastX;
        lastX = ev.clientX;
        onDelta(dx);
      };
      const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        onCommit?.();
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    },
    [onBegin, onDelta, onCommit]
  );

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Breite anpassen"
      className={`resize-handle-v ${className}`.trim()}
      onMouseDown={onMouseDown}
      onDoubleClick={(e) => {
        e.preventDefault();
        onDoubleClick?.();
      }}
    />
  );
}
