import { useEffect, useState } from 'react';
import { api } from '../api';
import type { PanelData, PluginInfo } from '../types';

function Panel({ plugin, tick }: { plugin: PluginInfo; tick: number }) {
  const [data, setData] = useState<PanelData | null>(null);
  const [err, setErr] = useState('');
  const spec = plugin.panel;

  useEffect(() => {
    if (!spec || !plugin.enabled || spec.placement === 'header') return;
    api.panel(plugin.name, spec.endpoint).then((d) => { setData(d); setErr(''); }).catch((e) => setErr((e as Error).message));
  }, [plugin.name, plugin.enabled, spec, tick]);

  if (!spec || !plugin.enabled || spec.placement === 'header') return null;
  return (
    <div className="panel">
      <h4>{spec.title}</h4>
      {err && <p className="error">{err}</p>}
      {data?.rows.map((r, i) => (
        <div className="kv" key={i}><span className="muted">{r.label}</span><span>{r.value}</span></div>
      ))}
    </div>
  );
}

export default function Plugins({ plugins, tick, className = '' }: { plugins: PluginInfo[]; tick: number; className?: string }) {
  return (
    <section className={`bare ${className}`}>
            <div className="scroll fill">
        {plugins.length === 0 && (
          <div className="empty-plugins">
            <b>El Core está corriendo solo</b>
            <p className="muted">Copiá un archivo a la carpeta <code>plugins/</code> y se carga al instante, sin reiniciar.</p>
          </div>
        )}
        {plugins.map((p) => (
          <div className={`plugin ${p.enabled ? '' : 'off'}`} key={p.name}>
            <div className="row">
              <b className="pl-name">
                {p.name} <span className="muted">v{p.version}</span>
                <span className={`stamp ${p.enabled ? (p.errors ? 'warn' : 'on') : 'off'}`}>
                  {p.enabled ? (p.errors ? 'Con errores' : 'Activo') : 'Desactivado'}
                </span>
              </b>
              <button onClick={() => api.setEnabled(p.name, !p.enabled)}>{p.enabled ? 'Desactivar' : 'Activar'}</button>
            </div>
            <p className="muted">{p.description}</p>
            <div className="chips">
              {p.hooks.map((h) => <span className="chip" key={h}>{h}</span>)}
              {p.hasRoutes && <span className="chip">/api/ext/{p.name}</span>}
              {p.panel?.placement === 'header' && <span className="chip">botón en el encabezado</span>}
              {p.errors > 0 && <span className="chip bad" title={p.lastError}>{p.errors} error(es)</span>}
            </div>
            {p.lastError && <p className="error small">{p.lastError}</p>}
            <Panel plugin={p} tick={tick} />
          </div>
        ))}
      </div>
    </section>
  );
}
