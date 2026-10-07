// Plugin de PRECIOS: "Combo desayuno".
// REGLA: por cada bebida + una pastelería en el MISMO pedido, 15% de descuento sobre esa pastelería.
//   - 1 Latte + 1 Brownie        -> combo (descuento sobre el Brownie)
//   - 2 Espresso + 1 Brownie     -> 1 combo (solo hay una pastelería)
//   - 2 Espresso (sin pastelería) -> sin descuento
// Se activa copiando este archivo a /plugins con el servidor en marcha.

/** @type {import('../server/src/api/plugin-api').Plugin} */
export default {
  name: 'combo-desayuno',
  version: '1.2.0',
  description: 'Bebida + pastelería en el mismo pedido: 15% de descuento sobre la pastelería.',

  hooks: {
    async onOrderPricing(order, ctx) {
      const bebidas = order.items.filter((i) => i.category === 'bebida').reduce((n, i) => n + i.qty, 0);
      // precio de cada unidad de pastelería, de menor a mayor
      const pasteles = order.items
        .filter((i) => i.category === 'pasteleria')
        .flatMap((i) => Array(i.qty).fill(i.unitPrice))
        .sort((a, b) => a - b);

      const combos = Math.min(bebidas, pasteles.length);

      if (combos === 0) {
        // En la vista previa avisamos qué falta para llegar al descuento (amount 0 = sugerencia).
        if (ctx.preview && bebidas > 0) {
          return [{ label: 'Sumá una pastelería y llevate 15% de descuento en ella', amount: 0 }];
        }
        if (ctx.preview && pasteles.length > 0) {
          return [{ label: 'Sumá una bebida y llevate 15% de descuento en la pastelería', amount: 0 }];
        }
        return [];
      }

      const descuento = pasteles.slice(0, combos).reduce((s, p) => s + Math.round(p * 0.15), 0);
      if (!ctx.preview) {
        await ctx.kv.set('combos', String(Number((await ctx.kv.get('combos')) ?? 0) + combos));
        ctx.log(`Aplicó ${combos} combo(s) al pedido de ${order.customer}`);
      }
      return [{ label: `Combo desayuno x${combos}`, amount: -descuento }];
    },
  },

  routes(router, ctx) {
    router.get('/resumen', async (_req, res) => {
      res.json({
        rows: [
          { label: 'Regla', value: 'bebida + pastelería = 15% off en la pastelería' },
          { label: 'Combos aplicados', value: (await ctx.kv.get('combos')) ?? '0' },
        ],
      });
    });
  },
  panel: { title: 'Combo desayuno', endpoint: '/resumen' },
};
