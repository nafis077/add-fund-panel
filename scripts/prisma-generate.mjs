import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { applyDatabaseEnv, assertSchemaExists } from "./prisma-env.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

process.env.PRISMA_HIDE_UPDATE_MESSAGE = "1";
applyDatabaseEnv(process.env, { createFallback: false });

if (!existsSync(path.join(root, "scripts/prisma-env.mjs"))) {
  console.info("[prisma] skip generate: project files are not copied yet");
  process.exit(0);
}

const schema = assertSchemaExists();
const prismaBin = path.join(root, "node_modules/.bin/prisma");
console.info(`[prisma] generating client from ${schema}`);
const result = spawnSync(existsSync(prismaBin) ? prismaBin : "npx", existsSync(prismaBin) ? ["generate", "--schema", schema] : ["prisma", "generate", "--schema", schema], {
  stdio: "inherit",
  env: process.env,
  cwd: root,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
