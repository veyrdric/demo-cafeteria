import type { Product } from '../types';
import { CATEGORY_LABEL, emojiFor, money } from '../format';

interface Props {
  products: Product[];
  cart: Record<number, number>;
  onChange: (id: number, delta: number) => void;
  className?: string;
}

/** La carta, en una tarjeta oscura de contraste. */
export default function Menu({ products, cart, onChange, className = '' }: Props) {
  const categories = [...new Set(products.map((p) => p.category))];

  return (
    <section className={`card board-menu ${className}`}>
      <h2 className="menu-title">Carta</h2>
      <div className="scroll menu-cols">
        {categories.map((cat) => (
          <div className="menu-col" key={cat}>
            <h3>{CATEGORY_LABEL[cat] ?? cat}</h3>
            {products.filter((p) => p.category === cat).map((p) => {
              const qty = cart[p.id] ?? 0;
              return (
                <div className={`dish ${qty ? 'picked' : ''}`} key={p.id}>
                  <span className="emoji">{emojiFor(p.name, p.category)}</span>
                  <span className="dname">{p.name}</span>
                  <span className="dprice">{money(p.price)}</span>
                  {qty === 0 ? (
                    <button className="chalk-btn" onClick={() => onChange(p.id, 1)} aria-label={`Agregar ${p.name}`}>+</button>
                  ) : (
                    <span className="chalk-step">
                      <button onClick={() => onChange(p.id, -1)} aria-label="Quitar uno">−</button>
                      <b>{qty}</b>
                      <button onClick={() => onChange(p.id, 1)} aria-label="Agregar uno">+</button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
