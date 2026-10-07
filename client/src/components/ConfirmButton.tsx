import { useEffect, useState, type ReactNode } from 'react';

/** Botón de dos pasos: el primer clic pide confirmación y se cancela solo a los 3 s. */
export default function ConfirmButton({ onConfirm, children, className = '', title }: {
  onConfirm: () => void; children: ReactNode; className?: string; title?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      className={`danger ${armed ? 'armed' : ''} ${className}`}
      title={title}
      onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}
    >
      {armed ? '¿Seguro?' : children}
    </button>
  );
}
