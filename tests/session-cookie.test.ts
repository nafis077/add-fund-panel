import { describe, expect, it } from "vitest";
import { requestIsHttps, sessionCookieOptions } from "../src/lib/session-cookie";

describe("session cookie", () => {
  it("treats Railway forwarded HTTPS as secure even when request.url is HTTP", () => {
    const request = new Request("http://0.0.0.0:8080/api/auth/login", {
      headers: { "x-forwarded-proto": "https,http" },
    });
    expect(requestIsHttps(request)).toBe(true);
    expect(sessionCookieOptions(request).secure).toBe(true);
    expect(sessionCookieOptions(request).sameSite).toBe("lax");
    expect(sessionCookieOptions(request).httpOnly).toBe(true);
  });

  it("does not mark local HTTP as secure", () => {
    const request = new Request("http://localhost:3000/api/auth/login", {
      headers: { "x-forwarded-proto": "http" },
    });
    expect(requestIsHttps(request)).toBe(false);
    expect(sessionCookieOptions(request).secure).toBe(false);
  });
});
