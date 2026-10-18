import { describe, expect, it } from "vitest";
import { applyBootSecrets } from "../scripts/boot-secrets.mjs";

describe("boot secrets", () => {
  it("keeps provided secrets", () => {
    const env = applyBootSecrets({
      AUTH_SECRET: "already-set-auth-secret",
      ENCRYPTION_KEY: "already-set-encryption-key-32bytes",
    });
    expect(env.AUTH_SECRET).toBe("already-set-auth-secret");
    expect(env.ENCRYPTION_KEY).toBe("already-set-encryption-key-32bytes");
  });

  it("derives the same secrets for the same Railway service", () => {
    const shared = {
      RAILWAY_PROJECT_ID: "proj_1",
      RAILWAY_SERVICE_ID: "svc_1",
      RAILWAY_ENVIRONMENT_ID: "env_1",
    };
    const first = applyBootSecrets({ ...shared });
    const second = applyBootSecrets({ ...shared });
    expect(first.AUTH_SECRET).toBe(second.AUTH_SECRET);
    expect(first.ENCRYPTION_KEY).toBe(second.ENCRYPTION_KEY);
    expect(first.ENCRYPTION_KEY).toHaveLength(64);
    expect(first.AUTH_SECRET).not.toBe(first.ENCRYPTION_KEY);
  });
});
