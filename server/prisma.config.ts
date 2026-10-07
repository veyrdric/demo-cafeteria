import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: {
    url: process.env.DATABASE_URL ?? `file:${path.resolve(import.meta.dirname, '../data/cafeteria.db')}`,
  },
});
