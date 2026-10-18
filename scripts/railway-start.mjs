import { spawn } from "node:child_process";
import { applyBootSecrets } from "./boot-secrets.mjs";
import { assertSchemaExists, isPostgresUrl } from "./prisma-env.mjs";

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}

const env = applyBootSecrets({ ...process.env });
const port = env.PORT || "3000";
const schema = assertSchemaExists();

if (!isPostgresUrl(env.DATABASE_URL)) {
  console.error("Railway needs a PostgreSQL DATABASE_URL. Add a Railway Postgres plugin and redeploy.");
  process.exit(1);
}

await run("npx", ["prisma", "generate", "--schema", schema], env);
await run("npx", ["prisma", "migrate", "deploy", "--schema", schema], env);
await run("node", ["scripts/ensure-admin.mjs"], env);
await run("npx", ["next", "start", "--hostname", "0.0.0.0", "--port", port], env);
