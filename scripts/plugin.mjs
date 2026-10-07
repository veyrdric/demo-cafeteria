#!/usr/bin/env node
// Uso:
//   npm run plugin -- listar
//   npm run plugin -- inyectar <nombre>     (copia plugins-disponibles/<nombre>.mjs a plugins/)
//   npm run plugin -- quitar <nombre>       (borra plugins/<nombre>.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const disponibles = path.join(root, 'plugins-disponibles');
const activos = path.join(root, 'plugins');
const [cmd, nombre] = process.argv.slice(2);
const lista = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).map((f) => f.replace(/\.mjs$/, ''));

if (cmd === 'listar') {
  console.log('Disponibles:', lista(disponibles).join(', ') || '—');
  console.log('Activos    :', lista(activos).join(', ') || '— (el Core corre solo, sin plugins)');
} else if (cmd === 'inyectar' && nombre) {
  const src = path.join(disponibles, `${nombre}.mjs`);
  if (!fs.existsSync(src)) { console.error(`No existe plugins-disponibles/${nombre}.mjs`); process.exit(1); }
  fs.copyFileSync(src, path.join(activos, `${nombre}.mjs`));
  console.log(`OK: ${nombre} inyectado en plugins/ — el Core lo carga en caliente`);
} else if (cmd === 'quitar' && nombre) {
  const dst = path.join(activos, `${nombre}.mjs`);
  if (!fs.existsSync(dst)) { console.error(`${nombre} no está en plugins/`); process.exit(1); }
  fs.rmSync(dst);
  console.log(`OK: ${nombre} quitado de plugins/ — el Core lo descarga en caliente`);
} else {
  console.log('Uso: npm run plugin -- listar | inyectar <nombre> | quitar <nombre>');
}
