import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../..');

export const PLUGINS_DIR = path.join(root, 'plugins');
export const DATA_DIR = path.join(root, 'data');
export const CLIENT_DIR = path.join(root, 'client/dist');
export const DATABASE_URL = process.env.DATABASE_URL ?? `file:${path.join(DATA_DIR, 'cafeteria.db')}`;
