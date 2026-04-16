/**
 * In-app release notes: shown once per installed app version (see App.jsx).
 * When you ship a new version, add a matching key here (same as package.json version).
 */
const RELEASE_NOTES = {
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
