// Plugin de EVENTOS: "Notificaciones".
// Escucha la creación de pedidos y los cambios de estado, y escribe un archivo real
// (server/data/plugins/notificaciones/notificaciones.log), como si avisara a la cocina y al salón.

import fs from 'node:fs';
import path from 'node:path';

/** @type {import('../server/src/api/plugin-api').Plugin} */
export default {
  name: 'notificaciones',
  version: '1.0.0',
  description: 'Avisa a cocina cuando entra un pedido y al salón cuando está listo (archivo de log real).',

  hooks: {
    onOrderCreated(order, ctx) {
      const detalle = order.items.map((i) => `${i.qty}x ${i.name}`).join(', ');
      escribir(ctx, `COCINA  | Nuevo pedido #${order.id} de ${order.customer}: ${detalle}`);
    },
    onStatusChanged(order, previo, ctx) {
      if (order.status === 'listo') {
        const donde = order.tableNo ? `mesa ${order.tableNo}` : 'mostrador';
        escribir(ctx, `SALÓN   | Pedido #${order.id} LISTO para ${order.customer} (${donde})`);
      } else {
        escribir(ctx, `ESTADO  | Pedido #${order.id}: ${previo} -> ${order.status}`);
      }
    },
  },

  routes(router, ctx) {
    router.get('/ultimas', (_req, res) => {
      const file = path.join(ctx.dataDir, 'notificaciones.log');
      const lineas = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').slice(-8).reverse() : [];
      res.json({ rows: lineas.map((l, i) => ({ label: `#${lineas.length - i}`, value: l })) });
    });
  },
  panel: { title: 'Últimas notificaciones', endpoint: '/ultimas' },
};

function escribir(ctx, texto) {
  const linea = `${new Date().toLocaleString('es-AR')} | ${texto}\n`;
  fs.appendFileSync(path.join(ctx.dataDir, 'notificaciones.log'), linea);
  ctx.log(texto);
}
