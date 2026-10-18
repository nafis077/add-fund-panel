import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

export function isPostgresUrl(url = process.env.DATABASE_URL) {
  return Boolean(url && /^(postgres(ql)?:\/\/|prisma\+postgres)/i.test(url));
}

export function isSqliteUrl(url = process.env.DATABASE_URL) {
  return Boolean(url && /^file:/i.test(url));
}

export function resolveDatabaseUrl(env = process.env) {
  const candidates = [
    env.DATABASE_URL,
    env.DATABASE_PRIVATE_URL,
    env.POSTGRES_URL,
    env.POSTGRES_PRISMA_URL,
    env.POSTGRES_URL_NON_POOLING,
    env.DATABASE_URL_UNPOOLED,
    env.DATABASE_PUBLIC_URL,
  ].filter((value) => typeof value === "string" && value.length > 0);

  for (const url of candidates) {
    if (isPostgresUrl(url) || isSqliteUrl(url)) return url;
  }

  if (env.PGHOST && env.PGUSER && env.PGDATABASE) {
    const user = encodeURIComponent(env.PGUSER);
    const password = encodeURIComponent(env.PGPASSWORD || "");
    const host = env.PGHOST;
    const port = env.PGPORT || "5432";
    const database = encodeURIComponent(env.PGDATABASE);
    const sslmode = env.PGSSLMODE ? `?sslmode=${encodeURIComponent(env.PGSSLMODE)}` : "";
    return `postgresql://${user}:${password}@${host}:${port}/${database}${sslmode}`;
  }

  return "";
}

export function sqliteFallbackUrl(env = process.env) {
  const dir = env.RAILWAY_VOLUME_MOUNT_PATH || env.SQLITE_PATH || path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  return `file:${path.resolve(dir, "panel-treasury.db")}`;
}

export function applyDatabaseEnv(env = process.env, options = {}) {
  const resolved = resolveDatabaseUrl(env);
  if (isPostgresUrl(resolved)) {
    env.DATABASE_URL = resolved;
    env.PRISMA_SCHEMA = "postgresql";
    return env;
  }
  if (isSqliteUrl(resolved)) {
    env.DATABASE_URL = resolved;
    env.PRISMA_SCHEMA = "sqlite";
    return env;
  }
  if (options.createFallback === false) {
    env.DATABASE_URL = env.DATABASE_URL || "file:./prisma/dev.db";
    env.PRISMA_SCHEMA = "sqlite";
    return env;
  }
  env.DATABASE_URL = sqliteFallbackUrl(env);
  env.PRISMA_SCHEMA = "sqlite";
  return env;
}

export function usePostgres(env = process.env) {
  if (isPostgresUrl(env.DATABASE_URL)) return true;
  if (env.PRISMA_SCHEMA === "sqlite") return false;
  if (env.PRISMA_SCHEMA === "postgresql") return true;
  return false;
}

export function schemaPath(env = process.env) {
  return usePostgres(env) ? "prisma/pg/schema.prisma" : "prisma/schema.prisma";
}

export function assertSchemaExists(env = process.env) {
  const schema = schemaPath(env);
  if (!existsSync(schema)) {
    throw new Error(`Prisma schema not found: ${schema}`);
  }
  return schema;
}
