import { describe, expect, it } from "vitest";
import { HINT_MAX, shouldShowHint } from "./hints";

describe("dicas de uso", () => {
  it("aparecem nas 3 primeiras vezes e depois somem", () => {
    expect(HINT_MAX).toBe(3);
    expect([0, 1, 2].every(shouldShowHint)).toBe(true);
    expect(shouldShowHint(3)).toBe(false);
    expect(shouldShowHint(10)).toBe(false);
  });
});
