import { describe, expect, it } from "vitest";
import { hasPermission } from "@/lib/permissions";

describe("authorization", () => {
  it("gates financial actions by role", () => {
    expect(hasPermission("VIEWER", "payments.view")).toBe(true);
    expect(hasPermission("VIEWER", "payments.create")).toBe(false);
    expect(hasPermission("OPERATOR", "payments.create")).toBe(true);
    expect(hasPermission("OPERATOR", "payments.approve")).toBe(false);
    expect(hasPermission("ADMIN", "payments.approve")).toBe(true);
    expect(hasPermission("ADMIN", "panels.manage")).toBe(true);
    expect(hasPermission("OPERATOR", "panels.manage")).toBe(false);
  });
});
