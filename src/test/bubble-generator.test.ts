import { describe, expect, it } from "vitest";
import { generateLevel, resolveShot, starsFor } from "@/lib/bubble-generator";

describe("bubble levels", () => {
  it("level 1 is easy: 2 colors, 3 rows", () => {
    const l = generateLevel(1);
    expect(l.colors).toBe(2);
    expect(l.rows).toBe(3);
  });
  it("later levels get harder", () => {
    expect(generateLevel(200).colors).toBe(6);
    expect(generateLevel(200).rows).toBeGreaterThan(generateLevel(1).rows);
  });
  it("same level always has the same layout", () => {
    expect(generateLevel(42).grid).toEqual(generateLevel(42).grid);
  });
  it("3 same-colored bubbles pop", () => {
    const g = generateLevel(1).grid.map((r) => r.map(() => null as number | null));
    g[0]![0] = 1; g[0]![1] = 1; g[0]![2] = 1;
    expect(resolveShot(g, 0, 2).popped).toHaveLength(3);
  });
  it("stars depend on shots left", () => {
    expect(starsFor(10, 20)).toBe(3);
    expect(starsFor(0, 20)).toBe(1);
  });
});
