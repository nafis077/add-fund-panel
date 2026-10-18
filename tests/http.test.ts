import { describe, expect, it } from "vitest";
import { AuthError } from "../src/lib/permissions";
import { allowedOriginsForRequest, assertSameOrigin, normalizeOrigin } from "../src/lib/http";

function request(url: string, init?: RequestInit) {
  return new Request(url, { method: "POST", ...init });
}

describe("same-origin checks", () => {
  it("normalizes default ports", () => {
    expect(normalizeOrigin("https://app.up.railway.app:443/path")).toBe("https://app.up.railway.app");
    expect(normalizeOrigin("http://localhost:80")).toBe("http://localhost");
  });

  it("allows Railway HTTPS origin when the server URL is the internal HTTP host", () => {
    const req = request("http://0.0.0.0:8080/api/panels", {
      headers: {
        origin: "https://app.up.railway.app",
        host: "0.0.0.0:8080",
        "x-forwarded-host": "app.up.railway.app",
        "x-forwarded-proto": "https",
      },
    });
    expect(allowedOriginsForRequest(req)).toContain("https://app.up.railway.app");
    expect(() => assertSameOrigin(req)).not.toThrow();
  });

  it("allows the Railway public domain when request.url stays on localhost", () => {
    const req = request("http://localhost:3000/api/settings", {
      headers: {
        origin: "https://panel.up.railway.app",
        host: "localhost:3000",
      },
    });
    expect(
      allowedOriginsForRequest(req, { RAILWAY_PUBLIC_DOMAIN: "panel.up.railway.app" }),
    ).toContain("https://panel.up.railway.app");
  });

  it("blocks a foreign origin", () => {
    const req = request("https://app.up.railway.app/api/panels", {
      headers: {
        origin: "https://evil.example",
        host: "app.up.railway.app",
        "x-forwarded-proto": "https",
      },
    });
    expect(() => assertSameOrigin(req)).toThrow(AuthError);
    try {
      assertSameOrigin(req);
    } catch (error) {
      expect(error).toBeInstanceOf(AuthError);
      expect((error as AuthError).message).toBe("Cross-site request blocked");
      expect((error as AuthError).status).toBe(403);
    }
  });

  it("does not check GET requests", () => {
    const req = new Request("https://app.up.railway.app/api/panels", {
      method: "GET",
      headers: { origin: "https://evil.example" },
    });
    expect(() => assertSameOrigin(req)).not.toThrow();
  });
});
