import { describe, expect, it } from "vitest";
import { colors, contrastRatio, nativeMood, nativeThemes } from "../packages/design-tokens/src";

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
      disabledFill: "#34332F", tabIndicator: "#163D2E",
    });
    expect(nativeThemes.light).toMatchObject({
      controlRing: "#858D80", tabBar: "#F2ECDF", disabledFill: "#CFD3C6", tabIndicator: "#CFE3CC",
    });
    // The dark pill is the brand green the dark theme already uses for the inverted cream role.
    expect(nativeThemes.dark.tabIndicator).toBe(nativeThemes.dark.cream);
    // Light keeps the grey it always drew behind a disabled primary button, so no light pixel changes.
    expect(nativeThemes.light.disabledFill).toBe(colors.fieldBorder);
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
    // The disabled label is muted on disabledFill. Dark must reach 4.5:1; light was 3.83:1 before this key existed and is kept as it is.
    it(`${theme}: the disabled label reads on the disabled fill`, () => {
      expect(contrastRatio(p.muted, p.disabledFill)).toBeGreaterThanOrEqual(theme === "dark" ? 4.5 : 3.8);
    });
    it(`${theme}: controlRing reaches 3:1 on surface`, () => {
      expect(contrastRatio(p.controlRing, p.surface)).toBeGreaterThanOrEqual(3);
    });
    // Android draws the selected tab icon (forest) on the indicator pill; the other icons are muted on the bar.
    it(`${theme}: the selected tab icon reaches 3:1 on the tab indicator, the others 3:1 on the bar`, () => {
      expect(contrastRatio(p.forest, p.tabIndicator)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(p.muted, p.tabBar)).toBeGreaterThanOrEqual(3);
    });
  }
  it("contrastRatio matches known WCAG values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrastRatio("#60675F", "#FFFEFA")).toBeCloseTo(5.78, 1);
  });
});

const SHADOW_WARM = "0 10px 28px rgba(107,74,43,0.16)";
const SHADOW_DEEP = "0 10px 28px rgba(0,0,0,0.35)";

describe("native mood", () => {
  it("nativeMood matches the spec", () => {
    expect(nativeMood).toEqual({
      light: {
        siang: {
          header: "#FFEFD9", headerText: "#163D2E", headerMeta: "#6B4A2B", toggleTrack: "#F6DDBE",
          toggleActive: "#9B4309", onToggleActive: "#FFF7E9", arcTrack: "#E2C29C",
          markerActive: "#9B4309", markerIdle: "#9A7A55", todayRing: "#9B4309", hero: "#FFFEFA", heroText: "#163D2E",
          heroMeta: "#60675F", heroShadow: SHADOW_WARM, pattern: null,
        },
        malam: {
          header: "#0B1F16", headerText: "#FFF7E9", headerMeta: "#A9BDB0", toggleTrack: "#1C3A2C",
          toggleActive: "#FFF7E9", onToggleActive: "#0B1F16", arcTrack: "#2C4C3C",
          markerActive: "#FFF7E9", markerIdle: "#6E8C7C", todayRing: "#F5C9A6", hero: "#1C3A2C", heroText: "#FFF7E9",
          heroMeta: "#A9BDB0", heroShadow: SHADOW_DEEP, pattern: "#1A3A2B",
        },
      },
      dark: {
        siang: {
          header: "#3A2617", headerText: "#F5F1E8", headerMeta: "#E6C3A2", toggleTrack: "#4C3322",
          toggleActive: "#F5C9A6", onToggleActive: "#3A1A04", arcTrack: "#6A4A33",
          markerActive: "#F5C9A6", markerIdle: "#A88A6A", todayRing: "#F5C9A6", hero: "#232321", heroText: "#F5F1E8",
          heroMeta: "#B5B2AA", heroShadow: SHADOW_DEEP, pattern: null,
        },
        malam: {
          header: "#163D2E", headerText: "#F5F1E8", headerMeta: "#CFE0D2", toggleTrack: "#25553F",
          toggleActive: "#FFF7E9", onToggleActive: "#163D2E", arcTrack: "#2C5A45",
          markerActive: "#FFF7E9", markerIdle: "#7FA08E", todayRing: "#F5C9A6", hero: "#1C3A2C", heroText: "#F5F1E8",
          heroMeta: "#CFE0D2", heroShadow: SHADOW_DEEP, pattern: "#1F4A38",
        },
      },
    });
  });
  for (const theme of ["light", "dark"] as const) {
    for (const mood of ["siang", "malam"] as const) {
      const m = nativeMood[theme][mood];
      describe(`${theme} ${mood}`, () => {
        it("header text and meta reach 4.5:1 on the header", () => {
          for (const k of ["headerText", "headerMeta"] as const)
            expect(contrastRatio(m[k], m.header), `${k} on header`).toBeGreaterThanOrEqual(4.5);
        });
        it("the idle toggle label (headerMeta) reaches 4.5:1 on the toggle track", () => {
          expect(contrastRatio(m.headerMeta, m.toggleTrack)).toBeGreaterThanOrEqual(4.5);
        });
        it("the active toggle label reaches 4.5:1 on the active pill", () => {
          expect(contrastRatio(m.onToggleActive, m.toggleActive)).toBeGreaterThanOrEqual(4.5);
        });
        it("arc markers reach 3:1 on the header", () => {
          for (const k of ["markerActive", "markerIdle"] as const)
            expect(contrastRatio(m[k], m.header), `${k} on header`).toBeGreaterThanOrEqual(3);
        });
        // The calendar cell sits on the header: the today outline (todayRing) and the selected outline (headerText).
        it("the calendar outlines (todayRing, headerText) reach 3:1 on the header", () => {
          for (const k of ["todayRing", "headerText"] as const)
            expect(contrastRatio(m[k], m.header), `${k} on header`).toBeGreaterThanOrEqual(3);
        });
        it("hero text and meta reach 4.5:1 on the hero", () => {
          for (const k of ["heroText", "heroMeta"] as const)
            expect(contrastRatio(m[k], m.hero), `${k} on hero`).toBeGreaterThanOrEqual(4.5);
        });
      });
    }
  }
  it("light siang hero equals the light surface", () => {
    expect(nativeMood.light.siang.hero).toBe(nativeThemes.light.surface);
  });
  it("dark siang hero equals the dark surface", () => {
    expect(nativeMood.dark.siang.hero).toBe(nativeThemes.dark.surface);
  });
});
