import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Order, Preview, Product } from '../types';
import { money } from '../format';

interface Props {
  products: Product[];
  cart: Record<number, number>;
  tick: number;
  onClear: () => void;
  className?: string;
}

export default function Ticket({ products, cart, tick, onClear, className = '' }: Props) {
  const [customer, setCustomer] = useState('');
  const [tableNo, setTableNo] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [last, setLast] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);

  const items = Object.entries(cart).map(([id, qty]) => ({ productId: Number(id), qty }));
  const lines = items.map((i) => ({ ...i, product: products.find((p) => p.id === i.productId)! })).filter((l) => l.product);

  // Precio en vivo: lo calcula el Core con los plugins activos en este momento.
  const key = JSON.stringify(items);
  useEffect(() => {
    if (items.length === 0) { setPreview(null); return; }
    let cancelled = false;
    api.preview(items).then((p) => { if (!cancelled) setPreview(p); }).catch(() => { if (!cancelled) setPreview(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      const order = await api.createOrder(customer, tableNo ? Number(tableNo) : null, items);
      setLast(order);
      onClear();
      setCustomer('');
      setTableNo('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Si el Core no responde la vista previa, el subtotal se calcula acá para no mostrar $0.
  const localSubtotal = lines.reduce((n, l) => n + l.qty * l.product.price, 0);
  const subtotal = preview?.subtotal ?? localSubtotal;
  const total = preview?.total ?? localSubtotal;
  const discounts = preview?.adjustments.filter((a) => a.amount !== 0) ?? [];
  const hints = preview?.adjustments.filter((a) => a.amount === 0) ?? [];
  const saved = discounts.reduce((s, a) => s + (a.amount < 0 ? -a.amount : 0), 0);

  return (
    <section className={`card ticket ${className}`}>
      <h2>Ticket</h2>

      {lines.length === 0 ? (
        <p className="empty fill">Elegí productos del menú para armar el pedido.</p>
      ) : (
        <>
          <ul className="scroll lines">
            {lines.map((l) => (
              <li key={l.productId}>
                <span>{l.qty}× {l.product.name}</span>
                <span>{money(l.qty * l.product.price)}</span>
              </li>
            ))}
          </ul>

          <div className="totals">
            <div className="line"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            {discounts.map((a, i) => (
              <div key={i} className={`line ${a.amount < 0 ? 'discount' : 'surcharge'}`}>
                <span>{a.label} <small>· {a.plugin}</small></span>
                <span>{money(a.amount)}</span>
              </div>
            ))}
            <div className="line total"><span>Total</span><span>{money(total)}</span></div>
          </div>

          {saved > 0 && <div className="note saved">Ahorrás {money(saved)} gracias a los plugins</div>}
          {hints.map((h, i) => <div className="note hint" key={i}>{h.label}</div>)}

          <div className="form">
            <input placeholder="Nombre del cliente" value={customer} onChange={(e) => setCustomer(e.target.value)} />
            <input placeholder="Mesa (opcional)" type="number" min="1" value={tableNo} onChange={(e) => setTableNo(e.target.value)} />
          </div>
          <div className="actions">
            <button onClick={onClear}>Vaciar</button>
            <button className="primary" disabled={busy || !customer.trim()} onClick={submit}>
              Confirmar pedido · {money(total)}
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </>
      )}

      {last && (
        <div className="note ok">
          Pedido #{last.id} de {last.customer} confirmado por {money(last.total)}
          {last.adjustments.map((a, i) => (
            <div key={i}><small>{a.label}: {money(a.amount)}</small></div>
          ))}
        </div>
      )}
    </section>
  );
}
