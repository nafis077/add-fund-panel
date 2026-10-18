import { existsSync } from "node:fs";

export function isPostgresUrl(url = process.env.DATABASE_URL) {
  return Boolean(url && /^(postgres(ql)?:\/\/|prisma\+postgres)/i.test(url));
}

export function usePostgres() {
  if (process.env.PRISMA_SCHEMA === "postgresql") return true;
  if (process.env.RAILWAY_ENVIRONMENT) return true;
  return isPostgresUrl();
}

export function schemaPath() {
  return usePostgres() ? "prisma/pg/schema.prisma" : "prisma/schema.prisma";
}

export function assertSchemaExists() {
  const path = schemaPath();
  if (!existsSync(path)) {
    throw new Error(`Prisma schema not found: ${path}`);
  }
  return path;
}
