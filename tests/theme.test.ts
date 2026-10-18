import { describe, expect, it } from "vitest";
import { isTheme } from "../src/lib/theme";

describe("theme", () => {
  it("accepts only light and dark", () => {
    expect(isTheme("light")).toBe(true);
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("system")).toBe(false);
    expect(isTheme("")).toBe(false);
  });
});
