// Plugin ROTO a propósito: sirve para demostrar que una falla en un plugin
// no tumba al Core ni impide crear pedidos.

/** @type {import('../server/src/api/plugin-api').Plugin} */
export default {
  name: 'plugin-defectuoso',
  version: '0.0.1',
  description: 'Lanza un error en cada pedido. El Core debe seguir funcionando.',
  hooks: {
    onOrderPricing() {
      throw new Error('¡Boom! este plugin está roto');
    },
    onOrderCreated() {
      throw new Error('¡Boom otra vez!');
    },
  },
};
