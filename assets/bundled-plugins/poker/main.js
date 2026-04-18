/**
 * Poker-Plugin — Main-Prozess: Logging, optionale Befehle.
 */
module.exports = (bluetalk) => {
  bluetalk.log.info('Poker-Plugin aktiv');

  bluetalk.registerCommand('log', (args) => {
    bluetalk.log.info('poker/ui:', args);
    return { ok: true };
  });

  return {
    deactivate() {
      bluetalk.log.info('Poker-Plugin deaktiviert');
    },
    onUiMessage(payload) {
      if (payload?.wire === 'debug') {
        bluetalk.log.info('poker debug:', payload);
      }
    },
  };
};
