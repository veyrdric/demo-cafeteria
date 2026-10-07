// Plugin de REPORTES: "Estadísticas".
// Aporta una ruta propia (/api/ext/estadisticas/resumen) y un botón "Estadísticas" en el encabezado de la app.
// Consulta la base SQLite real mediante ctx.query (solo lectura).

/** @type {import('../server/src/api/plugin-api').Plugin} */
export default {
  name: 'estadisticas',
  version: '1.1.0',
  description: 'Ventas, ticket promedio, producto más pedido y descuentos otorgados (consultas SQL reales).',

  routes(router, ctx) {
    router.get('/resumen', async (_req, res) => {
      const [tot] = await ctx.query(
        `SELECT COUNT(*) AS pedidos, COALESCE(SUM(total), 0) AS ventas, COALESCE(AVG(total), 0) AS ticket FROM orders`,
      );
      const [top] = await ctx.query(
        `SELECT name, SUM(qty) AS n FROM order_items GROUP BY name ORDER BY n DESC LIMIT 1`,
      );
      const [desc] = await ctx.query(`SELECT COALESCE(SUM(-amount), 0) AS d FROM order_adjustments WHERE amount < 0`);
      const [curso] = await ctx.query(`SELECT COUNT(*) AS n FROM orders WHERE status != 'entregado'`);
      res.json({
        rows: [
          { label: 'Pedidos', value: String(tot.pedidos) },
          { label: 'En curso', value: String(curso.n) },
          { label: 'Ventas', value: `$${tot.ventas}` },
          { label: 'Ticket promedio', value: `$${Math.round(tot.ticket)}` },
          { label: 'Más pedido', value: top ? `${top.name} (${top.n})` : '—' },
          { label: 'Descuentos otorgados', value: `$${desc.d}` },
        ],
      });
    });
  },
  panel: { title: 'Estadísticas', endpoint: '/resumen', placement: 'header' },
};
