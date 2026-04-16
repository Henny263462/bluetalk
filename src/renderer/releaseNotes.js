/**
 * In-app release notes: shown once per installed app version (see App.jsx).
 * When you ship a new version, add a matching key here (same as package.json version).
 */
const RELEASE_NOTES = {
  '1.1.4': {
    title: "What's new in BlueTalk 1.1.4",
    items: [
      'Plugin system: install plugins to add sidebar tabs, modal screens and react to realtime peer events.',
      'Plugins have access to peers, contacts, messages, E2EE-aware chat sends, notifications and per-plugin storage.',
      'New Plugins page in the sidebar to enable, disable, uninstall and rescan plugins. First launch seeds a "Hello" example plugin.',
      'Plugin APIs: events.on() for peer:connected/disconnected/message/file-offered/file-received/discovered, plus ui.registerTab, ui.registerScreen and registerCommand.',
    ],
  },
  '1.1.3': {
    title: "What's new in BlueTalk 1.1.3",
    items: [
      'Settings: Feature flags panel for optional performance and UI tweaks (smoother sends, faster large file reads, deferred attachment saves, unread list badges, solid corner toasts).',
      'Global toggle for outgoing end-to-end encryption in feature flags; per-chat lock control still applies when encryption is enabled.',
    ],
  },
  '1.1.2': {
    title: "What's new in BlueTalk 1.1.2",
    items: [
      'Larger chat attachments (up to 15 GB per file) with a higher transport limit for big sends.',
      'Block and unblock contacts from the chat header or list context menu; blocked peers cannot message you.',
      'End-to-end encryption for chat and file payloads between peers (AES-256-GCM over ECDH P-256).',
    ],
  },
  '1.1.0': {
    title: "What's new in BlueTalk 1.1.0",
    items: [
      'Settings: clear renderer cache to fix stuck UI or file dialogs.',
      'Settings: delete all local data or clear chat history with confirmation.',
      'Faster outgoing messages with optimistic send and clearer delivery states.',
      'Contacts reconnect automatically on startup.',
    ],
  },
};

export function getReleaseNotesForVersion(version) {
  if (!version || typeof version !== 'string') return null;
  const entry = RELEASE_NOTES[version];
  if (!entry || !Array.isArray(entry.items) || entry.items.length === 0) return null;
  return { version, title: entry.title || `What's new in BlueTalk ${version}`, items: entry.items };
}
