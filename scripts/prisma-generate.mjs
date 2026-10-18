import { spawnSync } from "node:child_process";
import { assertSchemaExists, usePostgres } from "./prisma-env.mjs";

if (usePostgres() && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
}

const schema = assertSchemaExists();
console.info(`[prisma] generating client from ${schema}`);
const result = spawnSync("npx", ["prisma", "generate", "--schema", schema], {
  stdio: "inherit",
  env: process.env,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
