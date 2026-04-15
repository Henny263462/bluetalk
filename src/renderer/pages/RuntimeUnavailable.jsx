import React from 'react';
import { PlugZap } from 'lucide-react';

export default function RuntimeUnavailablePage() {
  return (
    <div className="error-page">
      <div className="error-page-card animate-scale">
        <div className="error-page-icon" aria-hidden>
          <PlugZap size={28} strokeWidth={1.75} />
        </div>
        <h1 className="error-page-title">BlueTalk is not available here</h1>
        <p className="error-page-lead text-muted">
          This screen is meant to run inside the BlueTalk desktop app. Open the packaged app or run the Electron dev session
          so the secure bridge to messaging and storage is active.
        </p>
      </div>
    </div>
  );
}
