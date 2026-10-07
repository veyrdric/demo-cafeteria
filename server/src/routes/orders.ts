import { Router } from 'express';
import type { PluginManager } from '../core/pluginManager';
import { bus } from '../core/bus';
import {
  FLOW, buildDraft, createOrder, deleteDelivered, deleteOrder, getOrder, listOrders, listProducts, setStatus, totalOf,
} from '../core/orders';
import type { OrderStatus } from '../api/plugin-api';

/** Funcionalidad mínima del Core: menú y pedidos. */
export function ordersRouter(plugins: PluginManager) {
  const router = Router();

  router.get('/products', async (_req, res) => res.json(await listProducts()));
  router.get('/orders', async (_req, res) => res.json(await listOrders()));

  // Vista previa: calcula el precio con los plugins activos SIN guardar nada.
  router.post('/orders/preview', async (req, res) => {
    const built = await buildDraft(req.body ?? {});
    if ('error' in built) { res.status(400).json(built); return; }
    const adjustments = await plugins.runPricing(built.draft, true);
    res.json({ subtotal: built.draft.subtotal, adjustments, total: totalOf(built.draft.subtotal, adjustments) });
  });

  router.post('/orders', async (req, res) => {
    const built = await buildDraft(req.body ?? {});
    if ('error' in built) { res.status(400).json(built); return; }
    if (!built.draft.customer) { res.status(400).json({ error: 'Falta el nombre del cliente' }); return; }

    // Punto de extensión: los plugins activos pueden ajustar el precio.
    // Los ajustes en 0 son solo sugerencias de la vista previa y no se guardan.
    const adjustments = (await plugins.runPricing(built.draft)).filter((a) => a.amount !== 0);
    const order = await createOrder(built.draft, adjustments);
    bus.log('core', `Pedido #${order.id} creado (${order.customer}) — total $${order.total}`);
    bus.notify('orders');
    void plugins.emitOrderCreated(order);
    res.status(201).json(order);
  });

  router.patch('/orders/:id/status', async (req, res) => {
    const id = Number(req.params.id);
    const order = await getOrder(id);
    const next = req.body?.status as OrderStatus;
    if (!order) { res.status(404).json({ error: 'Pedido inexistente' }); return; }
    if (FLOW.indexOf(next) !== FLOW.indexOf(order.status) + 1) {
      res.status(400).json({ error: `No se puede pasar de ${order.status} a ${next}` });
      return;
    }
    const updated = await setStatus(id, next);
    bus.log('core', `Pedido #${id}: ${order.status} → ${next}`);
    bus.notify('orders');
    void plugins.emitStatusChanged(updated, order.status);
    res.json(updated);
  });

  // Eliminar un pedido cargado por error o vaciar el historial de entregados.
  router.delete('/orders/:id', async (req, res) => {
    const id = Number(req.params.id);
    const order = await getOrder(id);
    if (!order) { res.status(404).json({ error: 'Pedido inexistente' }); return; }
    await deleteOrder(id);
    bus.log('core', `Pedido #${id} eliminado (${order.customer}, estado: ${order.status})`, 'warn');
    bus.notify('orders');
    res.json({ ok: true });
  });

  router.delete('/orders', async (req, res) => {
    if (req.query.status !== 'entregado') { res.status(400).json({ error: 'Solo se pueden vaciar los entregados' }); return; }
    const deleted = await deleteDelivered();
    bus.log('core', `Historial vaciado: ${deleted} pedido(s) entregado(s) eliminados`, 'warn');
    bus.notify('orders');
    res.json({ ok: true, deleted });
  });

  return router;
}
