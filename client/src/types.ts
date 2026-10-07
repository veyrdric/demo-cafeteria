export type OrderStatus = 'pendiente' | 'preparando' | 'listo' | 'entregado';

export interface Product { id: number; name: string; category: string; price: number }
export interface OrderItem { productId: number; name: string; category: string; qty: number; unitPrice: number }
export interface Adjustment { plugin: string; label: string; amount: number }

export interface Order {
  id: number;
  customer: string;
  tableNo: number | null;
  status: OrderStatus;
  subtotal: number;
  total: number;
  createdAt: string;
  items: OrderItem[];
  adjustments: Adjustment[];
}

export interface PluginInfo {
  name: string;
  version: string;
  description: string;
  file: string;
  enabled: boolean;
  errors: number;
  lastError?: string;
  loadedAt: string;
  hooks: string[];
  hasRoutes: boolean;
  panel?: { title: string; endpoint: string; placement?: 'panel' | 'header' };
}

export interface LogEntry { time: string; level: 'info' | 'warn' | 'error'; source: string; message: string }
export interface PanelData { rows: { label: string; value: string }[] }

export interface Preview { subtotal: number; total: number; adjustments: Adjustment[] }
