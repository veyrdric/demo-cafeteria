import { useState } from 'react';
import { api } from '../api';
import type { Order, OrderStatus } from '../types';
import { money } from '../format';
import ConfirmButton from './ConfirmButton';

const FLOW: OrderStatus[] = ['pendiente', 'preparando', 'listo', 'entregado'];
const ACTIVE = FLOW.slice(0, 3);
const LABEL: Record<OrderStatus, string> = {
  pendiente: 'Pendiente', preparando: 'Preparando', listo: 'Listo', entregado: 'Entregado',
};

export default function Board({ orders, className = '' }: { orders: Order[]; className?: string }) {
  const [error, setError] = useState('');
  const delivered = orders.filter((o) => o.status === 'entregado');
  const activeCount = orders.length - delivered.length;

  const advance = async (o: Order) => {
    setError('');
    try {
      await api.advance(o.id, FLOW[FLOW.indexOf(o.status) + 1]);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const run = async (fn: () => Promise<unknown>) => {
    setError('');
    try { await fn(); } catch (e) { setError((e as Error).message); }
  };

  return (
    <section className={`card ${className}`}>
      <div className="card-head">
        <h2>Pedidos en curso <span className="count">{activeCount}</span></h2>
        {error && <span className="error">{error}</span>}
      </div>
      <div className="board">
        {ACTIVE.map((status) => {
          const list = orders.filter((o) => o.status === status);
          return (
            <div className={`lane s-${status}`} key={status}>
              <h3>{LABEL[status]} <span className="count">{list.length}</span></h3>
              <div className="scroll lane-body">
                {list.length === 0 && <div className="lane-empty">Sin pedidos</div>}
                {list.map((o) => (
                  <div className="order" key={o.id}>
                    <div className="row">
                      <b className="ttl">#{o.id} {o.customer}</b>
                      <span className="pill">{o.tableNo ? `Mesa ${o.tableNo}` : 'Mostrador'}</span>
                      <ConfirmButton className="mini x" title="Eliminar pedido" onConfirm={() => run(() => api.deleteOrder(o.id))}>✕</ConfirmButton>
                    </div>
                    <div className="items">
                      {o.items.map((i, k) => <span key={k}>{i.qty}× {i.name}</span>)}
                    </div>
                    {o.adjustments.map((a, k) => (
                      <div key={k} className={`tag ${a.amount < 0 ? 'discount' : 'surcharge'}`}>{a.label}: {money(a.amount)}</div>
                    ))}
                    <div className="row foot">
                      <b>{money(o.total)}</b>
                      <button className="next" onClick={() => advance(o)}>{LABEL[FLOW[FLOW.indexOf(status) + 1]]} →</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div className="lane history">
          <h3>Entregados <span className="count">{delivered.length}</span></h3>
          <div className="lane-note">
            <span>Historial: ya no están en curso</span>
            {delivered.length > 0 && (
              <ConfirmButton className="mini" onConfirm={() => run(api.clearDelivered)}>Vaciar</ConfirmButton>
            )}
          </div>
          <div className="scroll lane-body">
            {delivered.length === 0 && <div className="lane-empty">Todavía no hay entregas</div>}
            {delivered.map((o) => (
              <div className="done" key={o.id}>
                <span>#{o.id} {o.customer}</span>
                <span>{money(o.total)}</span>
                <ConfirmButton className="mini x" title="Eliminar pedido" onConfirm={() => run(() => api.deleteOrder(o.id))}>✕</ConfirmButton>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
