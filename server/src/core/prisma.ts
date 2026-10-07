import fs from 'node:fs';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/client';
import { DATA_DIR, DATABASE_URL } from './paths';

fs.mkdirSync(DATA_DIR, { recursive: true });

export const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: DATABASE_URL }) });
