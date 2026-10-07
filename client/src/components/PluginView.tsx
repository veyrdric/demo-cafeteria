import { useEffect, useState } from 'react';
import { api } from '../api';
import type { PanelData, PluginInfo } from '../types';

/** Vista a pantalla de un plugin que pidió un botón en el encabezado: sus datos se muestran como indicadores. */
export default function PluginView({ plugin, tick }: { plugin: PluginInfo; tick: number }) {
  const [data, setData] = useState<PanelData | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!plugin.panel) return;
    api.panel(plugin.name, plugin.panel.endpoint).then((d) => { setData(d); setErr(''); }).catch((e) => setErr((e as Error).message));
  }, [plugin.name, plugin.panel, tick]);

  return (
    <div className="scroll fill">
      <p className="muted live">Aportado por el plugin <b>{plugin.name}</b> v{plugin.version}. Se actualiza con cada pedido.</p>
      {err && <p className="error">{err}</p>}
      <div className="kpis">
        {data?.rows.map((r, i) => (
          <div className="kpi" key={i}><span>{r.label}</span><b>{r.value}</b></div>
        ))}
      </div>
    </div>
  );
}
