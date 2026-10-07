import { useEffect, type ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Panel lateral deslizable: guarda lo técnico (plugins, registro) fuera de la pantalla principal. */
export default function Drawer({ open, title, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={`scrim ${open ? 'open' : ''}`} onClick={onClose} />
      <aside className={`drawer ${open ? 'open' : ''}`} aria-hidden={!open} aria-label={title}>
        <div className="drawer-head">
          <h2>{title}</h2>
          <button onClick={onClose}>Cerrar</button>
        </div>
        <div className="drawer-body">{open && children}</div>
      </aside>
    </>
  );
}
