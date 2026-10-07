/**
 * API del Microkernel.
 *
 * Es el CONTRATO entre el Core y los plugins. El Core solo conoce estas interfaces;
 * cada plugin las implementa sin que el Core sepa nada de su código.
 * Mientras este contrato no cambie, se pueden agregar plugins sin tocar el Core
 * (principio Open-Closed).
 */
import type { Router } from 'express';

export type OrderStatus = 'pendiente' | 'preparando' | 'listo' | 'entregado';

export type Category = 'bebida' | 'pasteleria' | 'sandwich';

export interface OrderItem {
  productId: number;
  name: string;
  category: Category;
  qty: number;
  unitPrice: number;
}

/** Ajuste de precio que un plugin aplica a un pedido (negativo = descuento). */
export interface Adjustment {
  plugin: string;
  label: string;
  amount: number;
}

/** Pedido todavía no guardado: es lo que ven los plugins de precios. */
export interface DraftOrder {
  customer: string;
  tableNo: number | null;
  items: OrderItem[];
  subtotal: number;
}

export interface Order extends DraftOrder {
  id: number;
  status: OrderStatus;
  total: number;
  adjustments: Adjustment[];
  createdAt: string;
}

/** Lo que el Core le entrega a cada plugin al cargarlo. */
export interface PluginContext {
  /** Escribe en el registro del Core (se ve en vivo en el front). */
  log(message: string): void;
  /** Consulta SQL de solo lectura (una única sentencia SELECT) sobre la base de la cafetería. */
  query<T = Record<string, unknown>>(sql: string, params?: (string | number | null)[]): Promise<T[]>;
  /** Almacenamiento clave/valor propio del plugin (persistente en SQLite). */
  kv: {
    get(key: string): Promise<string | undefined>;
    set(key: string, value: string): Promise<void>;
  };
  /** Carpeta propia del plugin para escribir archivos. */
  dataDir: string;
  /**
   * true cuando el Core solo está calculando una vista previa del precio (el pedido todavía
   * no se guardó). Un plugin de precios no debería registrar efectos en ese caso.
   */
  preview: boolean;
}

export interface PanelSpec {
  title: string;
  /** Ruta dentro del plugin que devuelve `{ rows: [{ label, value }] }`. */
  endpoint: string;
  /**
   * Dónde se muestra: 'panel' (por defecto) dentro de la tarjeta del plugin, o 'header' para que
   * el plugin agregue su propio botón al encabezado de la app mientras esté cargado.
   */
  placement?: 'panel' | 'header';
}

export interface Plugin {
  name: string;
  version: string;
  description?: string;

  /** Puntos de extensión que el Core invoca. Todos son opcionales. */
  hooks?: {
    /**
     * Antes de guardar un pedido: devuelve ajustes de precio (descuentos/recargos).
     * Un ajuste con amount 0 se muestra como sugerencia (solo se informa en la vista previa).
     */
    onOrderPricing?(order: DraftOrder, ctx: PluginContext): Adjustment[] | Omit<Adjustment, 'plugin'>[] | void | Promise<unknown>;
    /** Después de guardar un pedido. */
    onOrderCreated?(order: Order, ctx: PluginContext): void | Promise<void>;
    /** Cuando un pedido cambia de estado. */
    onStatusChanged?(order: Order, previous: OrderStatus, ctx: PluginContext): void | Promise<void>;
  };

  /** Rutas HTTP propias: quedan montadas en /api/ext/<name>/... */
  routes?(router: Router, ctx: PluginContext): void;
  /** Panel que el front muestra automáticamente. */
  panel?: PanelSpec;

  onLoad?(ctx: PluginContext): void | Promise<void>;
  onUnload?(ctx: PluginContext): void | Promise<void>;
}
