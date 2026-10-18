import { describe, expect, it } from "vitest";
import { isPostgresUrl } from "../scripts/prisma-env.mjs";

describe("prisma environment", () => {
  it("detects Railway Postgres URLs", () => {
    expect(isPostgresUrl("postgresql://user:pass@host:5432/railway")).toBe(true);
    expect(isPostgresUrl("postgres://user:pass@host:5432/railway")).toBe(true);
    expect(isPostgresUrl("file:./dev.db")).toBe(false);
  });
});
