import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

process.env.DATABASE_URL = "file:./test.db";
process.env.AUTH_SECRET = "test-auth-secret-value-for-unit-tests";
process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.PAYMENT_TIMEOUT_MS = "200";
process.env.DISABLE_INPROCESS_WORKER = "1";

const dbPath = path.join(process.cwd(), "prisma", "test.db");
rmSync(dbPath, { force: true });
rmSync(`${dbPath}-journal`, { force: true });
execSync("npx prisma generate --schema=prisma/schema.prisma", {
  stdio: "pipe",
  env: process.env,
});
execSync("npx prisma db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss", {
  stdio: "pipe",
  env: process.env,
});
