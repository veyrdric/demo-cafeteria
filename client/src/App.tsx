import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { LogEntry, Order, PluginInfo, Product } from './types';
import Menu from './components/Menu';
import Ticket from './components/Ticket';
import Board from './components/Board';
import Plugins from './components/Plugins';
import CoreLog from './components/CoreLog';
import Drawer from './components/Drawer';
import PluginView from './components/PluginView';

type Tab = 'menu' | 'ticket' | 'pedidos';
type DrawerKind = 'plugins' | 'log' | `plugin:${string}` | null;
interface Toast { id: number; text: string; kind: 'info' | 'error' }

let toastId = 0;
const initialDrawer = (): DrawerKind =>
  location.hash === '#plugins' ? 'plugins' : location.hash === '#registro' ? 'log' : location.hash.startsWith('#plugin:') ? (location.hash.slice(1) as DrawerKind) : null;

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [online, setOnline] = useState(false);
  const [tab, setTab] = useState<Tab>('menu');
  const [drawer, setDrawer] = useState<DrawerKind>(initialDrawer);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [tick, setTick] = useState(0); // fuerza el refresco de paneles y precios cuando cambian los plugins
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [errorCount, setErrorCount] = useState(0);
  const [seenErrors, setSeenErrors] = useState(0);

  const changeCart = (id: number, delta: number) =>
    setCart((c) => {
      const qty = Math.max(0, (c[id] ?? 0) + delta);
      const next = { ...c, [id]: qty };
      if (qty === 0) delete next[id];
      return next;
    });

  const loadOrders = useCallback(() => api.orders().then(setOrders).catch(() => {}), []);
  const loadPlugins = useCallback(() => api.plugins().then(setPlugins).catch(() => {}), []);

  const pushToast = useCallback((text: string, kind: Toast['kind']) => {
    const id = ++toastId;
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  useEffect(() => {
    api.products().then(setProducts).catch(() => {});
    void loadOrders();
    void loadPlugins();

    // Tiempo real: el Core avisa cuando cambian pedidos o plugins.
    const es = new EventSource('/api/stream');
    es.onopen = () => setOnline(true);
    es.onerror = () => setOnline(false);
    es.addEventListener('history', (e) => {
      const history = JSON.parse(e.data) as LogEntry[];
      setLogs(history.slice(-60));
      const errors = history.filter((l) => l.level === 'error').length;
      setErrorCount(errors);
      setSeenErrors(errors);
    });
    es.addEventListener('log', (e) => {
      const entry = JSON.parse(e.data) as LogEntry;
      setLogs((l) => [...l.slice(-59), entry]);
      if (entry.level === 'error') {
        setErrorCount((n) => n + 1);
        void loadPlugins(); // actualiza el contador de errores de la tarjeta sin recalcular precios
      }
      // Avisos emergentes: así se nota la carga de un plugin aunque el panel esté cerrado.
      if (entry.source === 'core' && /^Plugin /.test(entry.message)) pushToast(entry.message, entry.level === 'error' ? 'error' : 'info');
      else if (entry.level === 'error') pushToast(`${entry.source}: ${entry.message}`, 'error');
    });
    es.addEventListener('change', (e) => {
      if (e.data === '"orders"') void loadOrders();
      void loadPlugins();
      setTick((t) => t + 1);
    });
    return () => es.close();
  }, [loadOrders, loadPlugins, pushToast]);

  useEffect(() => { if (drawer === 'log') setSeenErrors(errorCount); }, [drawer, errorCount]);

  // Botones que aportan los propios plugins al encabezado (mientras estén cargados y activos).
  const headerPlugins = plugins.filter((p) => p.enabled && p.panel?.placement === 'header');
  const viewing = drawer?.startsWith('plugin:') ? headerPlugins.find((p) => `plugin:${p.name}` === drawer) : undefined;

  const cartCount = Object.values(cart).reduce((n, q) => n + q, 0);
  const active = (t: Tab) => (tab === t ? 'active' : '');
  const unread = Math.max(0, errorCount - seenErrors);
  const TABS: [Tab, string][] = [
    ['menu', 'Menú'], ['ticket', cartCount ? `Ticket (${cartCount})` : 'Ticket'], ['pedidos', 'Pedidos'],
  ];

  return (
    <div className="app">
      <header>
        <div className="brand">
          <span className="logo">☕</span>
          <div>
            <h1>Cafetería</h1>
            <small>Demo de arquitectura Microkernel</small>
          </div>
        </div>
        <div className="status">
          <span className={`dot ${online ? 'on' : 'off'}`}>{online ? 'Core conectado' : 'Core sin conexión'}</span>
          {headerPlugins.map((p) => (
            <button key={p.name} className="hbtn ext" onClick={() => setDrawer(`plugin:${p.name}`)}>{p.panel!.title}</button>
          ))}
          <button className="hbtn" onClick={() => setDrawer('plugins')}>
            Plugins <span className="count">{plugins.filter((p) => p.enabled).length}</span>
          </button>
          <button className="hbtn" onClick={() => setDrawer('log')}>
            Registro {unread > 0 && <span className="count alert">{unread}</span>}
          </button>
        </div>
      </header>

      <main>
        <div className="col left">
          <Menu className={`pane pane-menu ${active('menu')}`} products={products} cart={cart} onChange={changeCart} />
          <Board className={`pane pane-pedidos ${active('pedidos')}`} orders={orders} />
        </div>
        <div className="col right">
          <Ticket className={`pane pane-ticket ${active('ticket')}`} products={products} cart={cart} tick={tick} onClear={() => setCart({})} />
        </div>
      </main>

      <nav className="tabbar">
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>

      <Drawer open={drawer === 'plugins'} title="Plugins cargados" onClose={() => setDrawer(null)}>
        <Plugins plugins={plugins} tick={tick} />
      </Drawer>
      <Drawer open={!!viewing} title={viewing?.panel?.title ?? ''} onClose={() => setDrawer(null)}>
        {viewing && <PluginView plugin={viewing} tick={tick} />}
      </Drawer>
      <Drawer open={drawer === 'log'} title="Registro del Core" onClose={() => setDrawer(null)}>
        <CoreLog logs={logs} />
      </Drawer>

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}
      </div>
    </div>
  );
}
