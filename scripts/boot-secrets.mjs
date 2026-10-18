import { createHash, randomBytes } from "node:crypto";

function derivedSecret(purpose, env, bytes = 32) {
  const material = [
    purpose,
    env.RAILWAY_PROJECT_ID,
    env.RAILWAY_SERVICE_ID,
    env.RAILWAY_ENVIRONMENT_ID,
    env.RAILWAY_PRIVATE_DOMAIN,
  ]
    .filter(Boolean)
    .join(":");

  if (material === purpose) {
    return randomBytes(bytes).toString("hex");
  }
  return createHash("sha256").update(material).digest("hex");
}

export function applyBootSecrets(env = process.env) {
  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 16) {
    env.AUTH_SECRET = derivedSecret("auth-secret", env);
    console.warn("[boot] AUTH_SECRET was missing. Using a Railway-service derived value. Set AUTH_SECRET in Variables to pin it.");
  }
  if (!env.ENCRYPTION_KEY || env.ENCRYPTION_KEY.length < 32) {
    env.ENCRYPTION_KEY = derivedSecret("encryption-key", env);
    console.warn("[boot] ENCRYPTION_KEY was missing. Using a Railway-service derived value. Set ENCRYPTION_KEY in Variables to pin it.");
  }
  return env;
}
