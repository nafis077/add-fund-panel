import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyDatabaseEnv,
  isPostgresUrl,
  resolveDatabaseUrl,
  usePostgres,
} from "../scripts/prisma-env.mjs";

describe("prisma environment", () => {
  it("detects Railway Postgres URLs", () => {
    expect(isPostgresUrl("postgresql://user:pass@host:5432/railway")).toBe(true);
    expect(isPostgresUrl("postgres://user:pass@host:5432/railway")).toBe(true);
    expect(isPostgresUrl("file:./dev.db")).toBe(false);
  });

  it("uses Railway private and public URL aliases", () => {
    expect(resolveDatabaseUrl({ DATABASE_PRIVATE_URL: "postgresql://u:p@private:5432/db" })).toBe(
      "postgresql://u:p@private:5432/db",
    );
    expect(resolveDatabaseUrl({ DATABASE_PUBLIC_URL: "postgresql://u:p@public:5432/db" })).toBe(
      "postgresql://u:p@public:5432/db",
    );
  });

  it("composes a URL from PG* variables", () => {
    expect(
      resolveDatabaseUrl({
        PGHOST: "db.internal",
        PGPORT: "5432",
        PGUSER: "postgres",
        PGPASSWORD: "p@ss:word",
        PGDATABASE: "railway",
      }),
    ).toBe("postgresql://postgres:p%40ss%3Aword@db.internal:5432/railway");
  });

  it("keeps an explicit Postgres URL and schema", () => {
    const env = applyDatabaseEnv({
      DATABASE_URL: "postgresql://u:p@h:5432/db",
      PRISMA_SCHEMA: "sqlite",
      RAILWAY_ENVIRONMENT: "production",
    });
    expect(env.DATABASE_URL).toBe("postgresql://u:p@h:5432/db");
    expect(env.PRISMA_SCHEMA).toBe("postgresql");
    expect(usePostgres(env)).toBe(true);
  });

  it("falls back to SQLite when Railway has no Postgres URL", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "panel-treasury-"));
    const env = applyDatabaseEnv({
      RAILWAY_ENVIRONMENT: "production",
      PRISMA_SCHEMA: "postgresql",
      SQLITE_PATH: dir,
    });
    expect(env.PRISMA_SCHEMA).toBe("sqlite");
    expect(env.DATABASE_URL).toBe(`file:${path.resolve(dir, "panel-treasury.db")}`);
    expect(usePostgres(env)).toBe(false);
  });
});
