import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not configured');

// Neon pooled endpoints use PgBouncer. Disabling Prisma's prepared statement
// cache there avoids stale cached result types after database migrations.
const runtimeDatabaseUrl = new URL(databaseUrl);
if (runtimeDatabaseUrl.hostname.includes('-pooler.')) {
  runtimeDatabaseUrl.searchParams.set('pgbouncer', 'true');
}

export const prisma = new PrismaClient({
  datasources: { db: { url: runtimeDatabaseUrl.toString() } },
});
