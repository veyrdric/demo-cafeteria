import { useEffect, useRef } from 'react';
import type { LogEntry } from '../types';
import { api } from '../api';
import ConfirmButton from './ConfirmButton';

export default function CoreLog({ logs, className = '' }: { logs: LogEntry[]; className?: string }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [logs]);

  return (
    <section className={`bare ${className}`}>
      <div className="live">
        <span className="muted">Se actualiza en vivo mientras el Core trabaja.</span>
        <ConfirmButton className="mini" onConfirm={() => { void api.clearLog().catch(() => {}); }}>Limpiar</ConfirmButton>
      </div>
      <div className="scroll log">
        {logs.map((l, i) => (
          <div key={i} className={l.level}>
            <span className="muted">{l.time}</span> <b>[{l.source}]</b> {l.message}
          </div>
        ))}
        <div ref={end} />
      </div>
    </section>
  );
}
