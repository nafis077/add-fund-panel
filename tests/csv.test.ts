import { describe, expect, it } from "vitest";
import { parseCsv, toCsv, validateRows } from "@/lib/validation";

describe("csv import", () => {
  it("parses headered bulk fund rows", () => {
    const rows = parseCsv("panel,username,amount,method\nPanel A,john,50,Admin Credit\nPanel B,alex,100,Admin Credit");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.username).toBe("john");
    expect(rows[1]?.amount).toBe("100");
  });

  it("flags invalid usernames, amounts, and duplicates", () => {
    const issues = validateRows([
      { clientRowId: "1", panelId: "p1", username: "john", amount: "50", method: "Admin Credit" },
      { clientRowId: "2", panelId: "p1", username: "bad user", amount: "-1", method: "Admin Credit" },
      { clientRowId: "3", panelId: "p1", username: "john", amount: "50", method: "Admin Credit" },
    ]);
    expect(issues.some((issue) => issue.code === "invalid_row")).toBe(true);
    expect(issues.some((issue) => issue.code === "duplicate_row")).toBe(true);
  });

  it("exports csv without leaking secrets", () => {
    const csv = toCsv([{ username: "john", amount: 12, api_key: undefined }]);
    expect(csv).toContain("username");
    expect(csv).not.toContain("secret");
  });
});
