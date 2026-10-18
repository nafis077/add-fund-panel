import { spawn } from "node:child_process";
import { applyBootSecrets } from "./boot-secrets.mjs";
import { applyDatabaseEnv, assertSchemaExists, isPostgresUrl } from "./prisma-env.mjs";

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}

const env = applyDatabaseEnv(applyBootSecrets({ ...process.env }));
env.PRISMA_HIDE_UPDATE_MESSAGE = "1";
const port = env.PORT || "3000";
const schema = assertSchemaExists(env);

if (isPostgresUrl(env.DATABASE_URL)) {
  console.log("[boot] Using PostgreSQL. Existing panel data will be kept.");
} else {
  console.log("[boot] No PostgreSQL DATABASE_URL. Using SQLite so the service can start.");
  if (env.RAILWAY_ENVIRONMENT && !env.RAILWAY_VOLUME_MOUNT_PATH) {
    console.error("[boot] WARNING: SQLite on Railway without a volume. Every deploy wipes panels and other data.");
    console.error("[boot] Add a Postgres plugin and attach DATABASE_URL to this web service. Do not reset or recreate the database.");
  } else {
    console.log("[boot] Add a Railway Postgres plugin, then reference DATABASE_URL on this service to keep data across deploys.");
  }
}

await run("npx", ["prisma", "generate", "--schema", schema], env);
await run("npx", ["prisma", "migrate", "deploy", "--schema", schema], env);
await run("node", ["scripts/ensure-admin.mjs"], env);
await run("npx", ["next", "start", "--hostname", "0.0.0.0", "--port", port], env);
