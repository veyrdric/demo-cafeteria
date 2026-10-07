import type { Order, OrderStatus, PanelData, PluginInfo, Preview, Product } from './types';

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json' },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Error ${res.status}`);
  return body as T;
}

export const api = {
  products: () => http<Product[]>('/api/products'),
  orders: () => http<Order[]>('/api/orders'),
  createOrder: (customer: string, tableNo: number | null, items: { productId: number; qty: number }[]) =>
    http<Order>('/api/orders', { method: 'POST', body: JSON.stringify({ customer, tableNo, items }) }),
  preview: (items: { productId: number; qty: number }[]) =>
    http<Preview>('/api/orders/preview', { method: 'POST', body: JSON.stringify({ items }) }),
  advance: (id: number, status: OrderStatus) =>
    http<Order>(`/api/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  deleteOrder: (id: number) => http(`/api/orders/${id}`, { method: 'DELETE' }),
  clearDelivered: () => http('/api/orders?status=entregado', { method: 'DELETE' }),
  clearLog: () => http('/api/log', { method: 'DELETE' }),
  plugins: () => http<PluginInfo[]>('/api/plugins'),
  setEnabled: (name: string, enabled: boolean) =>
    http(`/api/plugins/${name}/enabled`, { method: 'POST', body: JSON.stringify({ enabled }) }),
  panel: (name: string, endpoint: string) => http<PanelData>(`/api/ext/${name}${endpoint}`),
};
