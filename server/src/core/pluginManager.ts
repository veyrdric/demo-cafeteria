import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import express, { type Router } from 'express';
import { DATA_DIR } from './paths';
import { prisma } from './prisma';
import { bus } from './bus';
import type {
  Adjustment, DraftOrder, Order, OrderStatus, PanelSpec, Plugin, PluginContext,
} from '../api/plugin-api';

const HOOK_TIMEOUT_MS = 2000;
const PLUGIN_FILE = /\.(mjs|js)$/;
const SCAN_INTERVAL_MS = 1000;
/** Una única sentencia SELECT: lo único que un plugin puede pedirle a la base. */
const SELECT_ONLY = /^\s*select\b[^;]*;?\s*$/i;

interface Loaded {
  file: string;
  plugin: Plugin;
  ctx: PluginContext;
  router: Router;
  enabled: boolean;
  errors: number;
  lastError?: string;
  loadedAt: string;
}

export interface PluginInfo {
  name: string;
  version: string;
  description: string;
  file: string;
  enabled: boolean;
  errors: number;
  lastError?: string;
  loadedAt: string;
  hooks: string[];
  hasRoutes: boolean;
  panel?: PanelSpec;
}

/**
 * Gestor de plugins del Core.
 * Revisa la carpeta `plugins/` cada segundo: cuando aparece, cambia o desaparece un archivo,
 * el plugin se carga, se recarga o se descarga SIN reiniciar el servidor.
 * (Se consulta la carpeta en lugar de usar fs.watch porque este último no detecta los cambios
 * hechos desde el sistema anfitrión cuando la carpeta está montada en Docker.)
 */
export class PluginManager {
  private loaded = new Map<string, Loaded>(); // por nombre de plugin
  private seen = new Map<string, number>(); // archivo → fecha de modificación

  constructor(private dir: string) {}

  async start() {
    fs.mkdirSync(this.dir, { recursive: true });
    await this.scan();
    bus.log('core', `Vigilando la carpeta de plugins: ${this.dir}`);
    const loop = async () => {
      await this.scan().catch((e) => bus.log('core', `Error al revisar plugins: ${(e as Error).message}`, 'error'));
      setTimeout(loop, SCAN_INTERVAL_MS);
    };
    setTimeout(loop, SCAN_INTERVAL_MS);
  }

  /** Compara la carpeta con lo que ya se vio y carga, recarga o descarga lo que cambió. */
  private async scan() {
    const files = fs.readdirSync(this.dir).filter((f) => PLUGIN_FILE.test(f));
    for (const name of files) {
      const file = path.join(this.dir, name);
      const modified = fs.statSync(file).mtimeMs;
      if (this.seen.get(name) === modified) continue;
      this.seen.set(name, modified);
      await this.load(file);
    }
    for (const name of [...this.seen.keys()]) {
      if (files.includes(name)) continue;
      this.seen.delete(name);
      await this.unloadByFile(path.join(this.dir, name));
    }
  }

  private buildContext(name: string): PluginContext {
    const dataDir = path.join(DATA_DIR, 'plugins', name);
    fs.mkdirSync(dataDir, { recursive: true });
    return {
      log: (message) => bus.log(name, message),
      query: async (sql, params = []) => {
        if (!SELECT_ONLY.test(sql)) throw new Error('Los plugins solo pueden hacer una consulta SELECT');
        const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql, ...params);
        // SQLite devuelve los conteos como BigInt, que no se puede serializar a JSON
        return rows.map((row) =>
          Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v])),
        ) as never;
      },
      kv: {
        get: async (key) => (await prisma.pluginKv.findUnique({ where: { plugin_key: { plugin: name, key } } }))?.value,
        set: async (key, value) => {
          await prisma.pluginKv.upsert({
            where: { plugin_key: { plugin: name, key } },
            update: { value },
            create: { plugin: name, key, value },
          });
        },
      },
      dataDir,
      preview: false,
    };
  }

  private async load(file: string) {
    const base = path.basename(file);
    let mod: { default?: Plugin };
    try {
      // el parámetro ?v= evita la caché de módulos de Node y permite recargar el archivo
      mod = await import(`${pathToFileURL(file).href}?v=${Date.now()}`);
    } catch (e) {
      bus.log('core', `No se pudo cargar ${base}: ${(e as Error).message}`, 'error');
      return;
    }
    const plugin = mod.default;
    if (!plugin || typeof plugin.name !== 'string' || typeof plugin.version !== 'string') {
      bus.log('core', `${base} no cumple el contrato: exporta { name, version, ... } por defecto`, 'error');
      return;
    }

    const previous = this.loaded.get(plugin.name);
    if (previous) await this.callSafe(previous, 'onUnload', () => previous.plugin.onUnload?.(previous.ctx));

    const ctx = this.buildContext(plugin.name);
    const router = express.Router();
    const state = await prisma.pluginState.findUnique({ where: { name: plugin.name } });
    const entry: Loaded = {
      file, plugin, ctx, router, enabled: state?.enabled ?? true,
      errors: 0, loadedAt: new Date().toLocaleTimeString('es-AR'),
    };

    try {
      plugin.routes?.(router, ctx);
      await plugin.onLoad?.(ctx);
    } catch (e) {
      bus.log('core', `El plugin ${plugin.name} falló al iniciar: ${(e as Error).message}`, 'error');
      return;
    }

    this.loaded.set(plugin.name, entry);
    bus.log('core', `Plugin ${previous ? 'recargado' : 'cargado'}: ${plugin.name} v${plugin.version}`);
    bus.notify('plugins');
  }

  private async unloadByFile(file: string) {
    for (const [name, entry] of this.loaded) {
      if (entry.file !== file) continue;
      await this.callSafe(entry, 'onUnload', () => entry.plugin.onUnload?.(entry.ctx));
      this.loaded.delete(name);
      bus.log('core', `Plugin descargado: ${name}`);
      bus.notify('plugins');
    }
  }

  /** Ejecuta código de un plugin aislando fallas: un plugin roto nunca tumba al Core. */
  private async callSafe<T>(entry: Loaded, what: string, fn: () => T | Promise<T>): Promise<T | undefined> {
    try {
      return await Promise.race([
        Promise.resolve(fn()),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('tiempo de espera agotado')), HOOK_TIMEOUT_MS)),
      ]);
    } catch (e) {
      entry.errors += 1;
      entry.lastError = `${what}: ${(e as Error).message}`;
      // Solo se registra: avisar un "cambio" acá haría que el front recalcule la vista previa y vuelva a fallar en bucle.
      bus.log(entry.plugin.name, `Error en ${what}: ${(e as Error).message}`, 'error');
      return undefined;
    }
  }

  private active(): Loaded[] {
    return [...this.loaded.values()].filter((l) => l.enabled);
  }

  // ---- puntos de extensión que usa el Core ----

  async runPricing(order: DraftOrder, preview = false): Promise<Adjustment[]> {
    const out: Adjustment[] = [];
    for (const entry of this.active()) {
      const hook = entry.plugin.hooks?.onOrderPricing;
      if (!hook) continue;
      const res = await this.callSafe(entry, 'onOrderPricing', () => hook(structuredClone(order), { ...entry.ctx, preview }));
      if (!Array.isArray(res)) continue;
      for (const a of res as { label?: unknown; amount?: unknown }[]) {
        if (typeof a?.label === 'string' && Number.isFinite(a.amount)) {
          out.push({ plugin: entry.plugin.name, label: a.label, amount: Math.round(a.amount as number) });
        }
      }
    }
    return out;
  }

  async emitOrderCreated(order: Order) {
    for (const entry of this.active()) {
      const hook = entry.plugin.hooks?.onOrderCreated;
      if (hook) await this.callSafe(entry, 'onOrderCreated', () => hook(structuredClone(order), entry.ctx));
    }
  }

  async emitStatusChanged(order: Order, previous: OrderStatus) {
    for (const entry of this.active()) {
      const hook = entry.plugin.hooks?.onStatusChanged;
      if (hook) await this.callSafe(entry, 'onStatusChanged', () => hook(structuredClone(order), previous, entry.ctx));
    }
  }

  // ---- administración ----

  list(): PluginInfo[] {
    return [...this.loaded.values()].map((l) => ({
      name: l.plugin.name,
      version: l.plugin.version,
      description: l.plugin.description ?? '',
      file: path.basename(l.file),
      enabled: l.enabled,
      errors: l.errors,
      lastError: l.lastError,
      loadedAt: l.loadedAt,
      hooks: Object.keys(l.plugin.hooks ?? {}),
      hasRoutes: typeof l.plugin.routes === 'function',
      panel: l.plugin.panel,
    }));
  }

  async setEnabled(name: string, enabled: boolean): Promise<boolean> {
    const entry = this.loaded.get(name);
    if (!entry) return false;
    entry.enabled = enabled;
    await prisma.pluginState.upsert({ where: { name }, update: { enabled }, create: { name, enabled } });
    bus.log('core', `Plugin ${name} ${enabled ? 'activado' : 'desactivado'}`);
    bus.notify('plugins');
    return true;
  }

  /** Router propio de un plugin activo (se monta en /api/ext/:name). */
  routerFor(name: string): Router | undefined {
    const entry = this.loaded.get(name);
    return entry?.enabled ? entry.router : undefined;
  }
}
