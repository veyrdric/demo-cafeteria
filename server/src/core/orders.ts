import type { Prisma } from '../generated/client';
import type { Adjustment, DraftOrder, Order, OrderItem, OrderStatus } from '../api/plugin-api';
import { prisma } from './prisma';

const include = { items: true, adjustments: { orderBy: { id: 'asc' } } } satisfies Prisma.OrderInclude;
type OrderRow = Prisma.OrderGetPayload<{ include: typeof include }>;

export const FLOW: OrderStatus[] = ['pendiente', 'preparando', 'listo', 'entregado'];

/** Convierte la fila de la base al formato que ven los plugins y el front. */
function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    customer: row.customer,
    tableNo: row.tableNo,
    status: row.status,
    subtotal: row.subtotal,
    total: row.total,
    createdAt: row.createdAt.toISOString(),
    items: row.items.map(({ productId, name, category, qty, unitPrice }) => ({ productId, name, category, qty, unitPrice })),
    adjustments: row.adjustments.map(({ plugin, label, amount }) => ({ plugin, label, amount })),
  };
}

export const totalOf = (subtotal: number, adjustments: Adjustment[]) =>
  Math.max(0, subtotal + adjustments.reduce((sum, a) => sum + a.amount, 0));

export const listProducts = () =>
  prisma.product.findMany({ orderBy: [{ category: 'asc' }, { id: 'asc' }] });

export async function listOrders(): Promise<Order[]> {
  const rows = await prisma.order.findMany({ include, orderBy: { id: 'desc' }, take: 50 });
  return rows.map(toOrder);
}

export async function getOrder(id: number): Promise<Order | undefined> {
  const row = await prisma.order.findUnique({ where: { id }, include });
  return row ? toOrder(row) : undefined;
}

interface OrderRequest {
  customer?: string;
  tableNo?: number | null;
  items?: { productId: number; qty: number }[];
}

/** Valida el pedido y arma el borrador con los precios del menú (todavía sin ajustes de plugins). */
export async function buildDraft(body: OrderRequest): Promise<{ draft: DraftOrder } | { error: string }> {
  const { customer, tableNo, items } = body;
  if (!Array.isArray(items) || items.length === 0) return { error: 'Agregá al menos un producto' };

  const products = await prisma.product.findMany({ where: { id: { in: items.map((i) => Number(i.productId)) } } });
  const lines: OrderItem[] = [];
  for (const [n, item] of items.entries()) {
    const product = products.find((p) => p.id === Number(item.productId));
    const qty = Math.floor(Number(item.qty));
    if (!product || !(qty > 0)) return { error: `Producto o cantidad inválidos (línea ${n + 1})` };
    lines.push({ productId: product.id, name: product.name, category: product.category, qty, unitPrice: product.price });
  }
  return {
    draft: {
      customer: customer?.trim() ?? '',
      tableNo: tableNo == null ? null : Number(tableNo),
      items: lines,
      subtotal: lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0),
    },
  };
}

export async function createOrder(draft: DraftOrder, adjustments: Adjustment[]): Promise<Order> {
  const row = await prisma.order.create({
    data: {
      customer: draft.customer,
      tableNo: draft.tableNo,
      subtotal: draft.subtotal,
      total: totalOf(draft.subtotal, adjustments),
      items: { create: draft.items },
      adjustments: { create: adjustments },
    },
    include,
  });
  return toOrder(row);
}

export async function setStatus(id: number, status: OrderStatus): Promise<Order> {
  return toOrder(await prisma.order.update({ where: { id }, data: { status }, include }));
}

export const deleteOrder = (id: number) => prisma.order.delete({ where: { id } });

export async function deleteDelivered(): Promise<number> {
  return (await prisma.order.deleteMany({ where: { status: 'entregado' } })).count;
}
