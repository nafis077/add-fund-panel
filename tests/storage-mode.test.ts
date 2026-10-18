import { describe, expect, it } from "vitest";
import { biometricLabel } from "@/lib/pwa";
import { storageReport } from "@/lib/storage-mode";
import { rpIdFromRequest } from "@/lib/webauthn";

describe("storage and face unlock helpers", () => {
  it("treats Railway SQLite without a volume as ephemeral", () => {
    const report = storageReport({
      DATABASE_URL: "file:/app/data/panel-treasury.db",
      RAILWAY_ENVIRONMENT: "production",
    });
    expect(report.engine).toBe("sqlite");
    expect(report.persistent).toBe(false);
  });

  it("treats Postgres as persistent and does not require a schema change", () => {
    const report = storageReport({
      DATABASE_URL: "postgresql://u:p@h:5432/db",
      RAILWAY_ENVIRONMENT: "production",
    });
    expect(report.persistent).toBe(true);
    expect(report.engine).toBe("postgres");
  });

  it("labels iPhone unlock as Face ID", () => {
    expect(biometricLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("Unlock with Face ID");
  });

  it("reads the Railway host as the WebAuthn RP ID", () => {
    const request = new Request("http://0.0.0.0:8080/api/auth/webauthn/status", {
      headers: { "x-forwarded-host": "panel.up.railway.app", host: "0.0.0.0:8080" },
    });
    expect(rpIdFromRequest(request)).toBe("panel.up.railway.app");
  });
});
