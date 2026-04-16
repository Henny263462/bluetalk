/**
 * Hello plugin — main process side.
 *
 * Demonstrates:
 *  - Persisted plugin storage (scoped to the plugin id).
 *  - A main-process command invocable from the UI side or via invokeMainCommand.
 *  - Reacting to realtime peer events.
 */

module.exports = (bluetalk) => {
  bluetalk.log.info('Hello plugin activated. Peers:', bluetalk.peer.list().length);

  // Remember how many times the plugin has activated in this install.
  const activations = Number(bluetalk.store.get('activations', 0)) + 1;
  bluetalk.store.set('activations', activations);

  bluetalk.registerCommand('ping-peers', () => {
    bluetalk.peer.broadcast({
      kind: 'plugin-hello-ping',
      text: 'Hello from the hello plugin!',
      timestamp: Date.now(),
    });
    return { sent: bluetalk.peer.list().length };
  });

  bluetalk.events.on('peer:connected', (peer) => {
    bluetalk.log.info('peer connected:', peer?.id);
  });

  bluetalk.events.on('peer:message', (msg) => {
    if (msg?.kind === 'plugin-hello-ping') {
      bluetalk.log.info('ping reply from', msg.from);
    }
  });

  return {
    deactivate() {
      bluetalk.log.info('Hello plugin deactivated.');
    },
    onUiMessage(payload) {
      bluetalk.log.info('message from UI:', payload);
    },
  };
};
