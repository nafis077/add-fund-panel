import { spawn } from "node:child_process";
import { assertSchemaExists, usePostgres } from "./prisma-env.mjs";

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}

const port = process.env.PORT || "3000";
const schema = assertSchemaExists();

if (!usePostgres()) {
  console.error("Railway needs a PostgreSQL DATABASE_URL. Add a Railway Postgres plugin and redeploy.");
  process.exit(1);
}

if (!process.env.AUTH_SECRET || !process.env.ENCRYPTION_KEY) {
  console.error("Set AUTH_SECRET and ENCRYPTION_KEY in the Railway service variables.");
  process.exit(1);
}

await run("npx", ["prisma", "generate", "--schema", schema]);
await run("npx", ["prisma", "migrate", "deploy", "--schema", schema]);
await run("node", ["scripts/ensure-admin.mjs"]);
await run("npx", ["next", "start", "--hostname", "0.0.0.0", "--port", port]);
