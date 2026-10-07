import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { CLIENT_DIR, PLUGINS_DIR } from './core/paths';
import { PluginManager } from './core/pluginManager';
import { bus } from './core/bus';
import { ordersRouter } from './routes/orders';
import { pluginsRouter } from './routes/plugins';
import { streamRouter } from './routes/stream';

const PORT = Number(process.env.PORT ?? 3001);

const plugins = new PluginManager(PLUGINS_DIR);
const app = express();
app.use(express.json());
app.use('/api', ordersRouter(plugins), pluginsRouter(plugins), streamRouter());

// En producción (Docker) el mismo servidor entrega el front ya compilado.
if (fs.existsSync(CLIENT_DIR)) {
  app.use(express.static(CLIENT_DIR));
  app.use((_req, res) => res.sendFile(path.join(CLIENT_DIR, 'index.html')));
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  bus.log('core', `Error interno: ${err.message}`, 'error');
  res.status(500).json({ error: 'Error interno del Core' });
});

await plugins.start();
app.listen(PORT, () => bus.log('core', `Core de la cafetería escuchando en http://localhost:${PORT}`));
