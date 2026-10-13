import { describe, expect, it } from "vitest";
import { colors, contrastRatio, nativeArt, nativeMood, nativePhoto, nativeThemes, type Mood, type ThemeName } from "../packages/design-tokens/src";

// Direction K (spec 2.1 to 2.6). Hex values are asserted exactly; the pairs per look are computed from the token
// objects, with the same rules as output/native-review/phase-g/scripts/palette-directions-v2.cjs.
const TEXT = 4.5;
const NONTEXT = 3;
const SURFACE = 1.2;
const EDGE_TOKEN = 1.5;
const CREAM = "#FFF7E9";

const LOOKS: { look: string; theme: ThemeName; mood: Mood }[] = [
  { look: "light-siang", theme: "light", mood: "siang" },
  { look: "light-malam", theme: "light", mood: "malam" },
  { look: "dark-siang", theme: "dark", mood: "siang" },
  { look: "dark-malam", theme: "dark", mood: "malam" },
];

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const over = (fg: string, alpha: number, bg: string) => {
  const f = rgb(fg);
  const out = rgb(bg).map((v, k) => Math.round(f[k] * alpha + v * (1 - alpha)));
  return "#" + out.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
};
const r2 = (a: string, b: string) => Math.round(contrastRatio(a, b) * 100) / 100;

describe("direction K theme tokens", () => {
  it("light keeps today's colours except the K keys", () => {
    const changed = ["canvas", "line", "muted"];
    for (const [k, v] of Object.entries(colors)) {
      if (!changed.includes(k)) expect(nativeThemes.light[k as keyof typeof colors], k).toBe(v);
    }
    expect(nativeThemes.light).toMatchObject({
      canvas: "#E4DED1", surface: "#FFFEFA", sage: "#F0F3E9", line: "#D3CEC1", tabBar: "#FFF7E9",
      charcoal: "#2E2E2E", muted: "#555B54", forest: "#163D2E", cream: "#FFF7E9",
      sunrise: "#F47B2A", sunriseInk: "#9B4309", danger: "#A33024",
      overlayInk: "#1B1B1A", photoGround: "#2E2E2E",
    });
  });
  it("dark has every light key and the K values", () => {
    expect(Object.keys(nativeThemes.dark).sort()).toEqual(Object.keys(nativeThemes.light).sort());
    expect(nativeThemes.dark).toMatchObject({
      canvas: "#151514", surface: "#292927", sage: "#2A2D27", line: "#3A3A37", tabBar: "#292927",
      charcoal: "#F5F1E8", muted: "#B5B2AA", forest: "#9CCBAE", cream: "#163D2E",
      sunrise: "#F47B2A", sunriseInk: "#F5C9A6", scheduled: "#26302A", fieldBorder: "#7A7872",
      secondaryBorder: "#4A4944", attentionBorder: "#4C3322", danger: "#FF8F80", controlRing: "#8A8780",
      disabledFill: "#34332F", toast: "#F5F1E8", onToast: "#2E2E2E", toastAction: "#163D2E",
      overlayInk: "#1B1B1A", photoGround: "#2E2E2E",
    });
    expect(nativeThemes.light).toMatchObject({
      controlRing: "#858D80", disabledFill: "#CFD3C6", toast: "#2E2E2E", onToast: "#FFF7E9", toastAction: "#BFD8BB",
    });
    // The light Android tab pill is the line step, 1.48:1 off the cream bar; dark keeps its charcoal step.
    expect(nativeThemes.light.tabIndicator).toBe("#D3CEC1");
    expect(nativeThemes.light.tabIndicator).toBe(nativeThemes.light.line);
    expect(nativeThemes.dark.tabIndicator).toBe("#444441");
  });
  it("the success disc is a literal, not the Siang header", () => {
    expect(nativeArt.successDisc).toBe("#FFEFD9");
    expect(nativeMood.light.siang.header).not.toBe(nativeArt.successDisc);
  });
  it("the scrim numbers are the K ramp", () => {
    expect(nativePhoto).toEqual({ scrimBottomAlpha: 0.3, textBlockAlpha: 0.72, textBlockHeight: 26, cornerButtonAlpha: 0.66 });
  });
});

describe("direction K mood tokens", () => {
  const lightShadow = "0 6px 18px rgba(46,46,46,0.10)";
  const darkShadow = "0 6px 18px rgba(0,0,0,0.35)";
  const light = {
    headerText: "#2E2E2E", headerMeta: "#555B54", toggleTrack: "#FFFEFA", toggleActive: "#163D2E",
    onToggleActive: "#FFFEFA", arcTrack: "#C9C6BA", markerActive: "#2E2E2E", markerIdle: "#858D80",
    todayRing: "#163D2E", hero: "#FFFEFA", heroText: "#2E2E2E", heroMeta: "#555B54", heroShadow: lightShadow,
    heroWarn: "#A33024", heroEdge: "#C9C6BA", stopActive: "#9B4309", pattern: null,
  };
  const dark = {
    headerText: "#F5F1E8", headerMeta: "#B5B2AA", toggleTrack: "#292927", toggleActive: "#9CCBAE",
    onToggleActive: "#292927", arcTrack: "#4E4C47", markerActive: "#F5F1E8", markerIdle: "#8A8780",
    todayRing: "#9CCBAE", hero: "#292927", heroText: "#F5F1E8", heroMeta: "#B5B2AA", heroShadow: darkShadow,
    heroWarn: "#FF8F80", heroEdge: "#4E4C47", stopActive: "#F47B2A", pattern: null,
  };
  it("nativeMood matches spec 2.3", () => {
    expect(nativeMood).toEqual({
      light: { siang: { header: "#FFF7E9", ...light }, malam: { header: "#F3F6EF", ...light } },
      dark: { siang: { header: "#2E2B25", ...dark }, malam: { header: "#2A2D27", ...dark } },
    });
  });
  it("the hero is the theme surface and there is no Malam pattern", () => {
    for (const t of ["light", "dark"] as const)
      for (const m of ["siang", "malam"] as const) {
        expect(nativeMood[t][m].hero).toBe(nativeThemes[t].surface);
        expect(nativeMood[t][m].pattern).toBeNull();
      }
  });
});

// The pairs per look. `kind`: surface (adjacent, or carried by a named edge), text, nontext.
type Pair = { id: string; kind: "surface" | "text" | "nontext"; a: string; b: string; edge?: string };
function pairs(theme: ThemeName, mood: Mood): Pair[] {
  const t = nativeThemes[theme];
  const m = nativeMood[theme][mood];
  const list: Pair[] = [
    { id: "mood header vs canvas", kind: "surface", a: m.header, b: t.canvas },
    { id: "hero vs mood header", kind: "surface", a: m.hero, b: m.header, edge: m.heroEdge },
    { id: "hero vs canvas", kind: "surface", a: m.hero, b: t.canvas, edge: m.heroEdge },
    { id: "card vs canvas", kind: "surface", a: t.surface, b: t.canvas },
    { id: "tab bar vs canvas", kind: "surface", a: t.tabBar, b: t.canvas },
    { id: "demo strip vs mood header", kind: "surface", a: t.canvas, b: m.header },
    { id: "search field boundary vs mood header", kind: "nontext", a: m.markerIdle, b: m.header },
    { id: "Siang/Malam track boundary vs mood header", kind: "nontext", a: m.markerIdle, b: m.header },
    { id: "markerIdle vs header", kind: "nontext", a: m.markerIdle, b: m.header },
    { id: "todayRing vs header", kind: "nontext", a: m.todayRing, b: m.header },
    { id: "headerText (selected outline) vs header", kind: "nontext", a: m.headerText, b: m.header },
    { id: "markerActive disc vs header", kind: "nontext", a: m.markerActive, b: m.header },
    { id: "toggleActive ring vs toggleTrack", kind: "nontext", a: m.toggleActive, b: m.toggleTrack },
    { id: "hero button fill vs hero", kind: "nontext", a: t.forest, b: m.hero },
    { id: "hero button label on fill", kind: "text", a: t.cream, b: t.forest },
    { id: "Belum outline (heroText) vs hero", kind: "nontext", a: m.heroText, b: m.hero },
    { id: "Gagal diantar stop (heroWarn) vs hero", kind: "nontext", a: m.heroWarn, b: m.hero },
    { id: "headerText on header", kind: "text", a: m.headerText, b: m.header },
    { id: "headerMeta on header", kind: "text", a: m.headerMeta, b: m.header },
    { id: "heroText on hero", kind: "text", a: m.heroText, b: m.hero },
    { id: "heroMeta on hero", kind: "text", a: m.heroMeta, b: m.hero },
    { id: "selected segment label on its pill", kind: "text", a: m.toggleActive, b: m.onToggleActive },
    { id: "headerText on toggleTrack (idle tab label)", kind: "text", a: m.headerText, b: m.toggleTrack },
    { id: "search placeholder on field fill", kind: "text", a: t.muted, b: t.surface },
    { id: "demo strip text on strip", kind: "text", a: t.muted, b: t.canvas },
    { id: "charcoal on card surface", kind: "text", a: t.charcoal, b: t.surface },
    { id: "muted on card surface", kind: "text", a: t.muted, b: t.surface },
    { id: "muted on canvas", kind: "text", a: t.muted, b: t.canvas },
    { id: "muted on tab bar", kind: "text", a: t.muted, b: t.tabBar },
    { id: "forest label on tab bar", kind: "text", a: t.forest, b: t.tabBar },
    { id: "charcoal on canvas", kind: "text", a: t.charcoal, b: t.canvas },
    { id: "forest (selected and headings) on canvas", kind: "text", a: t.forest, b: t.canvas },
    { id: "page button fill vs canvas (StickyAction)", kind: "nontext", a: t.forest, b: t.canvas },
    { id: "page button label on fill (StickyAction)", kind: "text", a: t.cream, b: t.forest },
  ];
  // The photo overlay pairs: cream text over the K ramp on a white photo (worst case) and over the failed-photo ground.
  const ink = t.overlayInk;
  const scrim = over(ink, nativePhoto.scrimBottomAlpha, "#FFFFFF");
  const onWhite = over(ink, nativePhoto.textBlockAlpha, scrim);
  const onFailed = over(ink, nativePhoto.textBlockAlpha, over(ink, nativePhoto.scrimBottomAlpha, t.photoGround));
  list.push(
    { id: "cream text on the overlay, white photo", kind: "text", a: CREAM, b: onWhite },
    { id: "cream corner button on its disc, white photo", kind: "nontext", a: CREAM, b: over(ink, nativePhoto.cornerButtonAlpha, "#FFFFFF") },
    { id: "cream text on the overlay, failed photo", kind: "text", a: CREAM, b: onFailed },
  );
  return list;
}

describe("direction K: the pairs per look", () => {
  for (const { look, theme, mood } of LOOKS) {
    describe(look, () => {
      const list = pairs(theme, mood);
      // Spec 2.5 counts 39 per look: these 37 ratio pairs, the failed-photo band (the last test in this block) and the
      // scrim edge, which is not a ratio and is pinned by "the scrim numbers are the K ramp" above.
      it("runs 37 ratio pairs; the failed-photo band and the scrim ramp are checked on their own", () => {
        expect(list).toHaveLength(37);
      });
      for (const p of list) {
        it(p.id, () => {
          const r = contrastRatio(p.a, p.b);
          if (p.kind === "text") expect(r, p.id).toBeGreaterThanOrEqual(TEXT);
          else if (p.kind === "nontext") expect(r, p.id).toBeGreaterThanOrEqual(NONTEXT);
          else if (r < SURFACE) {
            expect(p.edge, `${p.id} needs a named edge`).toBeDefined();
            expect(contrastRatio(p.edge as string, p.b), `${p.id} edge`).toBeGreaterThanOrEqual(EDGE_TOKEN);
          }
        });
      }
      it("the failed-photo band differs from the overlay by at most 2:1", () => {
        const t = nativeThemes[theme];
        // The ramp starts at 0 at the top of the photo, so the top of a failed photo is the bare ground.
        const band = t.photoGround;
        const overlay = over(t.overlayInk, nativePhoto.textBlockAlpha, over(t.overlayInk, nativePhoto.scrimBottomAlpha, t.photoGround));
        expect(r2(band, overlay)).toBeLessThanOrEqual(2);
      });
    });
  }
});

describe("derived steps and component rules", () => {
  for (const { look, theme, mood } of LOOKS) {
    const t = nativeThemes[theme];
    const m = nativeMood[theme][mood];
    it(`${look}: the active tracker stop is at least 3:1 on the meal card`, () => {
      expect(contrastRatio(m.stopActive, m.hero)).toBeGreaterThanOrEqual(3);
    });
    it(`${look}: a bold charcoal price is at least 4.5:1 on the card, the canvas and the hero`, () => {
      for (const ground of [t.surface, t.canvas, m.hero]) expect(contrastRatio(t.charcoal, ground)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${look}: danger and heroWarn read as text on their grounds`, () => {
      expect(contrastRatio(t.danger, t.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.danger, t.canvas)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(m.heroWarn, m.hero)).toBeGreaterThanOrEqual(4.5);
    });
  }
  for (const theme of ["light", "dark"] as const) {
    const p = nativeThemes[theme];
    // The pressed forest button keeps its cream label and stays visibly different from the resting fill.
    it(`${theme}: forestDeep carries the cream label at 4.5:1 and is a step off forest`, () => {
      expect(contrastRatio(p.cream, p.forestDeep)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.forestDeep, p.forest)).toBeGreaterThanOrEqual(1.2);
      expect(contrastRatio(p.forestDeep, p.canvas)).toBeGreaterThanOrEqual(3);
    });
    // Android: the selected icon (forest) on the pill, the pill standing off the bar, the others muted on the bar. The
    // pill is a neutral step, never the page colour (a pill in the canvas reads as a hole punched in the bar).
    it(`${theme}: the tab indicator pill holds the forest icon at 3:1 and stands 1.4:1 off the bar`, () => {
      expect(contrastRatio(p.forest, p.tabIndicator)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(p.tabIndicator, p.tabBar)).toBeGreaterThanOrEqual(1.4);
      expect(p.tabIndicator).not.toBe(p.canvas);
      expect(contrastRatio(p.muted, p.tabBar)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.forest, p.tabBar)).toBeGreaterThanOrEqual(4.5);
    });
    // PhotoRing (rule 3): forest is the selected ring; the meal cue is neutral, dinner in ink and lunch in controlRing.
    // The two meals stay 3:1 apart (charcoal on forest was 1.13:1 in light), and the dinner ring reads on its grounds.
    it(`${theme}: the lunch and dinner rings are 3:1 apart and neither is forest`, () => {
      expect(contrastRatio(p.charcoal, p.controlRing)).toBeGreaterThanOrEqual(3);
      expect([p.charcoal, p.controlRing]).not.toContain(p.forest);
      for (const ground of [p.surface, p.canvas]) expect(contrastRatio(p.charcoal, ground)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(p.forest, p.canvas), "selected ring on the page").toBeGreaterThanOrEqual(3);
    });
    it(`${theme}: the disabled label reads on the disabled fill`, () => {
      expect(contrastRatio(p.muted, p.disabledFill)).toBeGreaterThanOrEqual(theme === "dark" ? 4.5 : 3.8);
    });
    it(`${theme}: controlRing reaches 3:1 on surface`, () => {
      expect(contrastRatio(p.controlRing, p.surface)).toBeGreaterThanOrEqual(3);
    });
    it(`${theme}: the danger confirm button reaches 4.5:1 and its icon 3:1 on the circle`, () => {
      expect(contrastRatio(p.cream, p.danger), "cream on danger").toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.danger, p.sage), "danger icon on sage").toBeGreaterThanOrEqual(3);
    });
    it(`${theme}: toast text and its action reach 4.5:1 on the toast`, () => {
      expect(contrastRatio(p.onToast, p.toast)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.toastAction, p.toast)).toBeGreaterThanOrEqual(4.5);
    });
    // Dark forest is now a light green: its consumers (headings, links, selected labels) must read on every fill.
    it(`${theme}: forest, charcoal, muted and danger read on every fill`, () => {
      for (const t of ["forest", "charcoal", "muted", "danger"] as const)
        for (const f of ["surface", "canvas", "sage", "scheduled", "tabBar"] as const)
          expect(contrastRatio(p[t], p[f]), `${t} on ${f}`).toBeGreaterThanOrEqual(4.5);
    });
    // The attention card is `cream`: text on it (and the card's own forest button label) must still read.
    it(`${theme}: text on the cream card reaches 4.5:1`, () => {
      for (const t of ["forest", "muted", "danger"] as const)
        expect(contrastRatio(p[t], p.cream), `${t} on cream`).toBeGreaterThanOrEqual(4.5);
    });
  }
  it("contrastRatio matches known WCAG values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrastRatio("#60675F", "#FFFEFA")).toBeCloseTo(5.78, 1);
  });
});
