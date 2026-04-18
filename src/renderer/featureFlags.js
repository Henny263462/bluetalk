/**
 * Experimentelle und Leistungs-Schalter. Werte in settings.featureFlags; fehlende Keys nutzen defaultEnabled.
 */
export const FEATURE_FLAG_DEFINITIONS = [
  {
    id: 'smoothChatSend',
    label: 'Flüssiger Chat-Versand',
    description:
      'Aktualisiert den Verlauf mit niedriger Priorität (React startTransition), damit Tippen und Scrollen beim Senden weniger ruckeln.',
    defaultEnabled: true,
  },
  {
    id: 'fastFileRead',
    label: 'Schnelleres Einlesen von Dateien',
    description:
      'Nutzt den nativen Data-URL-Pfad des Browsers beim Lesen großer Dateien statt manueller Base64-Konvertierung — oft spürbar schneller und weniger CPU-lastig.',
    defaultEnabled: true,
  },
  {
    id: 'deferFileDiskAfterSend',
    label: 'Datei erst senden, dann lokal speichern',
    description:
      'Schreibt ausgehende Dateianhänge erst nach erfolgreichem Versand in die lokale Chat-Datei, statt parallel zu Netzwerk und Verschlüsselung. Reduziert Lastspitzen bei großen Dateien.',
    defaultEnabled: true,
  },
  {
    id: 'chatUnreadListBadges',
    label: 'Ungelesen in der Chat-Liste',
    description:
      'Zeigt in der Chat-Liste einen Hinweis und eine Zahl (1–9, ab 10 als „9+“), wenn seit dem letzten Öffnen des Chats neue Nachrichten vom Peer eingegangen sind.',
    defaultEnabled: false,
  },
  {
    id: 'e2eeEncryption',
    label: 'Ende-zu-Ende-Verschlüsselung (ausgehend)',
    description:
      'Master-Schalter: Wenn aus, werden alle ausgehenden Chat- und Dateinachrichten unverschlüsselt gesendet; die Schloss-Steuerung pro Chat hat dann keine Wirkung. Wenn an, ist Verschlüsselung Standard und kann pro Chat im Gespräch deaktiviert werden (Klartext ausgehend). Eingehende E2EE-Nachrichten werden weiter entschlüsselt.',
    defaultEnabled: true,
  },
  {
    id: 'solidBottomRightToasts',
    label: 'Toasts unten rechts (deckend)',
    description:
      'Zeigt Benachrichtigungen unten rechts mit undurchsichtigem, einfarbigem Hintergrund pro Typ (keine transparenten Weichzeichner-Farben). Unten links bleibt das bisherige Erscheinungsbild.',
    defaultEnabled: false,
  },
  {
    id: 'chatOfflineReconnectOverlay',
    label: 'Offline: Weichzeichner über der Eingabe & Auto-Reconnect',
    description:
      'Wenn der Peer im geöffneten Chat nicht verbunden ist: unscharfer Bereich über der Textleiste mit Lade-Punkt, Eingabe gesperrt, und alle 3 Sekunden erneuter Verbindungsversuch zur gespeicherten Adresse (ohne Toast-Spam).',
    defaultEnabled: false,
  },
  {
    id: 'resizableUi',
    label: 'Größenanpassbare Bereiche',
    description:
      'Zeigt Ziehgriffe zwischen linker Navigationsleiste und Inhalt sowie zwischen Chat-Liste und Gespräch. Ab ausreichender Breite: Icon links, Beschriftung rechts daneben, beides wird mit weiterem Aufziehen größer. Schmal bleibt die kompakte Darstellung. Breiten werden gespeichert; Doppelklick auf einen Griff setzt die Standardbreite.',
    defaultEnabled: false,
  },
  {
    id: 'contactNotificationMute',
    label: 'Kontakt stummschalten (Mitteilungen)',
    description:
      'Erlaubt pro Kontakt Windows-Mitteilungen stummzuschalten: für eine feste Dauer (z. B. 1 h) oder bis du die Stummschaltung wieder aufhebst. Betrifft nur Benachrichtigungen, nicht den Nachrichteneingang.',
    defaultEnabled: false,
  },
];

/** @param {object | null | undefined} contact */
export function isContactNotificationMuted(contact, now = Date.now()) {
  if (!contact || typeof contact !== 'object') return false;
  if (contact.notifyMutedManual === true) return true;
  if (typeof contact.notifyMutedUntil === 'number' && now < contact.notifyMutedUntil) return true;
  return false;
}

const DEFAULT_FLAG_MAP = Object.fromEntries(
  FEATURE_FLAG_DEFINITIONS.map((d) => [d.id, d.defaultEnabled])
);

export function mergeFeatureFlagDefaults(stored) {
  return {
    ...DEFAULT_FLAG_MAP,
    ...(stored && typeof stored === 'object' ? stored : {}),
  };
}

export function getEffectiveFlag(settings, flagId) {
  const def = FEATURE_FLAG_DEFINITIONS.find((d) => d.id === flagId);
  const v = settings?.featureFlags?.[flagId];
  if (typeof v === 'boolean') return v;
  return def ? def.defaultEnabled : false;
}
