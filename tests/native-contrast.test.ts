import { describe, expect, it } from "vitest";
import { colors, contrastRatio, nativeThemes } from "../packages/design-tokens/src";

const TEXT = ["forest", "charcoal", "muted", "sunriseInk", "danger"] as const;
const FILLS = ["surface", "canvas", "sage", "scheduled", "tabBar"] as const;

describe("native themes", () => {
  it("light is today's colors, untouched", () => {
    for (const [k, v] of Object.entries(colors)) expect(nativeThemes.light[k as keyof typeof colors]).toBe(v);
  });
  it("dark has every light key", () => {
    expect(Object.keys(nativeThemes.dark).sort()).toEqual(Object.keys(nativeThemes.light).sort());
  });
  it("dark matches the spec table", () => {
    expect(nativeThemes.dark).toMatchObject({
      forest: "#FFF7E9", forestDeep: "#E9E3D6", sunrise: "#F47B2A", sunriseInk: "#F5C9A6", cream: "#163D2E",
      charcoal: "#F5F1E8", surface: "#232321", canvas: "#151514", sage: "#2A2D27", scheduled: "#26302A",
      muted: "#B5B2AA", line: "#34332F", fieldBorder: "#7A7872", secondaryBorder: "#4A4944",
      attentionBorder: "#4C3322", danger: "#FF8F80", controlRing: "#8A8780", tabBar: "#1E1E1C",
    });
    expect(nativeThemes.light).toMatchObject({ controlRing: "#858D80", tabBar: "#FFFEFA" });
  });
  for (const theme of ["light", "dark"] as const) {
    const p = nativeThemes[theme];
    it(`${theme}: text roles reach 4.5:1 on every fill`, () => {
      for (const t of TEXT) for (const f of FILLS) expect(contrastRatio(p[t], p[f]), `${t} on ${f}`).toBeGreaterThanOrEqual(4.5);
    });
    it(`${theme}: text on the cream card and cream on forest reach 4.5:1`, () => {
      for (const t of ["forest", "muted", "danger", "sunriseInk"] as const)
        expect(contrastRatio(p[t], p.cream), `${t} on cream`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.cream, p.forest)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${theme}: controlRing reaches 3:1 on surface`, () => {
      expect(contrastRatio(p.controlRing, p.surface)).toBeGreaterThanOrEqual(3);
    });
  }
  it("contrastRatio matches known WCAG values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrastRatio("#60675F", "#FFFEFA")).toBeCloseTo(5.78, 1);
  });
});
