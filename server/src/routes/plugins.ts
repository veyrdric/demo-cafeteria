import { Router } from 'express';
import type { PluginManager } from '../core/pluginManager';

/** Administración de plugins y rutas que ellos mismos aportan (/api/ext/:name). */
export function pluginsRouter(plugins: PluginManager) {
  const router = Router();

  router.get('/plugins', (_req, res) => res.json(plugins.list()));

  router.post('/plugins/:name/enabled', async (req, res) => {
    const ok = await plugins.setEnabled(req.params.name, Boolean(req.body?.enabled));
    res.status(ok ? 200 : 404).json({ ok });
  });

  // Las rutas de los plugins se resuelven en cada request: aparecen y desaparecen junto con el plugin.
  router.use('/ext/:name', (req, res, next) => {
    const pluginRouter = plugins.routerFor(req.params.name);
    if (!pluginRouter) { res.status(404).json({ error: 'Plugin no disponible' }); return; }
    pluginRouter(req, res, next);
  });

  return router;
}
