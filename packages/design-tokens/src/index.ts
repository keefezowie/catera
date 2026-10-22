export const colors = {
  forest: "#163D2E",
  forestDeep: "#0C2C20",
  sunrise: "#F47B2A",
  sunriseInk: "#9B4309",
  cream: "#FFF7E9",
  charcoal: "#2E2E2E",
  surface: "#FFFEFA",
  canvas: "#FDFAF3",
  sage: "#F0F3E9",
  scheduled: "#EDF1E6",
  muted: "#60675F",
  line: "#E2E3D8",
  /** Text field and grabber outline. */
  fieldBorder: "#CFD3C6",
  /** Secondary button and unselected chip outline. */
  secondaryBorder: "#CDD4C4",
  /** Warm edge of the cream attention card. */
  attentionBorder: "#F3DFC3",
  danger: "#A33024",
} as const;
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  section: 48,
} as const;
export const radii = { control: 10, surface: 16, dialog: 20 } as const;
export const typography = {
  family: "PlusJakartaSans",
  body: 16,
  small: 14,
  title: 24,
  heading: 32,
} as const;

export const motion = {
  duration: 180,
  ease: "cubic-bezier(.16,1,.3,1)",
} as const;
/** Native motion contract: durations match apps/web/src/lib/motion.ts (guarded by tests/native-motion-tokens.test.ts). */
export const nativeMotion = {
  control: 200,
  selection: 340,
  content: 440,
  feature: 680,
  ease: [0.33, 1, 0.68, 1] as const,
  spring: { damping: 22, stiffness: 120 },
} as const;
export const focus = { color: "#B65B13", width: 3, offset: 3 } as const;
export const webVariables = {
  "--forest": colors.forest,
  "--sunrise": colors.sunrise,
  "--sunrise-ink": colors.sunriseInk,
  "--cream": colors.cream,
  "--ink": colors.charcoal,
  "--muted": colors.muted,
  "--line": colors.line,
  "--canvas": colors.canvas,
  "--surface": colors.surface,
  "--soft": colors.sage,
  "--scheduled-bg": colors.scheduled,
  "--danger": colors.danger,
  "--radius": radii.surface + "px",
  "--focus": focus.color,
  "--ease": motion.ease,
  "--space-xs": spacing.xs + "px",
  "--space-sm": spacing.sm + "px",
  "--space-md": spacing.md + "px",
  "--space-lg": spacing.lg + "px",
  "--space-xl": spacing.xl + "px",
  "--space-xxl": spacing.xxl + "px",
  "--space-section": spacing.section + "px",
};

export type PaletteKey =
  | keyof typeof colors
  | "controlRing"
  | "tabBar"
  | "disabledFill"
  | "tabIndicator"
  | "toast"
  | "onToast"
  | "toastAction"
  | "overlayInk"
  | "photoGround";
export type NativePalette = Record<PaletteKey, string>;
export type ThemeName = "light" | "dark";

/**
 * Native palettes, direction K (spec 2.2): today's hues spent with restraint. Neutral ground and bars (a cream tab bar
 * and a warm-grey page in light, charcoal steps in dark); forest fills only the primary button and marks selection, and
 * in dark it is the lifted `#9CCBAE` so it reads on the dark cards. `cream` is the label on a forest button in both.
 * Keys K does not change keep today's value (`sunrise`, `sunriseInk`, `danger`, the field and secondary borders, the
 * toast keys). `forestDeep` is the pressed fill of the forest button: dark has a derived step (the palette script's
 * method, spec 14.4) that keeps the cream label at 4.5:1 and stands 1.36:1 off the resting forest.
 *
 * `tabIndicator` is the Android pill behind the selected tab icon (spec 14.3). K spends no brand fill behind content,
 * so it is a neutral step: the `line` step in light (1.48:1 off the cream bar; the page neutral read as a hole in the
 * bar) and a charcoal step in dark (1.49:1 off the bar), with the forest icon at 7.7:1 and 5.4:1 on it.
 *
 * `overlayInk` is the neutral photo overlay and `photoGround` the failed-photo ground (spec 2.2); both themes use the
 * same two values, so a failed photo and a loaded one carry the same cream text.
 */
export const nativeThemes: Record<ThemeName, NativePalette> = {
  light: {
    ...colors,
    canvas: "#E4DED1",
    line: "#D3CEC1",
    muted: "#555B54",
    controlRing: "#858D80",
    tabBar: "#FFF7E9",
    disabledFill: "#CFD3C6",
    tabIndicator: "#D3CEC1",
    toast: "#2E2E2E",
    onToast: "#FFF7E9",
    toastAction: "#BFD8BB",
    overlayInk: "#1B1B1A",
    photoGround: "#2E2E2E",
  },
  dark: {
    forest: "#9CCBAE",
    forestDeep: "#7FB093",
    sunrise: "#F47B2A",
    sunriseInk: "#F5C9A6",
    cream: "#163D2E",
    charcoal: "#F5F1E8",
    surface: "#292927",
    canvas: "#151514",
    sage: "#2A2D27",
    scheduled: "#26302A",
    muted: "#B5B2AA",
    line: "#3A3A37",
    fieldBorder: "#7A7872",
    secondaryBorder: "#4A4944",
    attentionBorder: "#4C3322",
    danger: "#FF8F80",
    controlRing: "#8A8780",
    tabBar: "#292927",
    disabledFill: "#34332F",
    tabIndicator: "#444441",
    toast: "#F5F1E8",
    onToast: "#2E2E2E",
    toastAction: "#163D2E",
    overlayInk: "#1B1B1A",
    photoGround: "#2E2E2E",
  },
};

export type Mood = "siang" | "malam";
export type MoodKey =
  | "header" | "headerText" | "headerMeta" | "toggleTrack" | "toggleActive" | "onToggleActive"
  | "arcTrack" | "markerActive" | "markerIdle" | "todayRing" | "hero" | "heroText" | "heroMeta" | "heroShadow"
  | "heroWarn" | "heroEdge" | "stopActive";
export type MoodPalette = Record<MoodKey, string> & { pattern: string | null };

/**
 * Mood surfaces only (direction K, spec 2.3): the mood header, the toggle, the day arc and the hero card. A mood is a
 * faint header tint plus the sun or moon mark, so the values differ by `header` alone within a theme (the Siang and
 * Malam headers are cream and pale sage in light, warm and green-grey charcoal in dark). There is no Malam pattern.
 * The hero is the theme surface in both moods, so it reads the same token and cannot drift from it.
 *
 * The selected Siang / Malam segment is a pill in `onToggleActive` (the card colour) drawn with a `toggleActive` (forest)
 * ring and label. `heroWarn` is Gagal diantar on the hero, `heroEdge` the 1.5dp edge of the hero and the Dapur count
 * card (the hero is 1.03:1 on the header, so the edge carries it), `stopActive` the tracker's current stop: the one
 * place Sunrise is spent on a screen (sunrise ink in light, sunrise in dark).
 */
const lightMood = (header: string): MoodPalette => ({
  header,
  headerText: "#2E2E2E",
  headerMeta: "#555B54",
  toggleTrack: "#FFFEFA",
  toggleActive: "#163D2E",
  onToggleActive: "#FFFEFA",
  arcTrack: "#C9C6BA",
  markerActive: "#2E2E2E",
  markerIdle: "#858D80",
  todayRing: "#163D2E",
  hero: nativeThemes.light.surface,
  heroText: "#2E2E2E",
  heroMeta: "#555B54",
  heroShadow: "0 6px 18px rgba(46,46,46,0.10)",
  heroWarn: "#A33024",
  heroEdge: "#C9C6BA",
  stopActive: "#9B4309",
  pattern: null,
});
const darkMood = (header: string): MoodPalette => ({
  header,
  headerText: "#F5F1E8",
  headerMeta: "#B5B2AA",
  toggleTrack: "#292927",
  toggleActive: "#9CCBAE",
  onToggleActive: "#292927",
  arcTrack: "#4E4C47",
  markerActive: "#F5F1E8",
  markerIdle: "#8A8780",
  todayRing: "#9CCBAE",
  hero: nativeThemes.dark.surface,
  heroText: "#F5F1E8",
  heroMeta: "#B5B2AA",
  heroShadow: "0 6px 18px rgba(0,0,0,0.35)",
  heroWarn: "#FF8F80",
  heroEdge: "#4E4C47",
  stopActive: "#F47B2A",
  pattern: null,
});

export const nativeMood: Record<ThemeName, Record<Mood, MoodPalette>> = {
  light: { siang: lightMood("#FFF7E9"), malam: lightMood("#F3F6EF") },
  dark: { siang: darkMood("#2E2B25"), malam: darkMood("#2A2D27") },
};

/**
 * Fixed inks of the code-drawn pieces that sit with the delivered Phase F mascot art (spec 7.1 and `rig.json`). The
 * art is the same file in both themes and every mood, so these never follow the theme or the mood either.
 */
export const nativeArt = {
  /** The success beat's disc. A literal: it was the light Siang header, which direction K changes (spec 2.6). */
  successDisc: "#FFEFD9",
  /** The success disc's 3dp ring. */
  successRing: colors.sunriseInk,
  /** The reading rig's paper-line highlight (`rig.json` `readingRig.paperHighlight.color`). */
  paperHighlight: colors.sunrise,
  /** The success burst and the launch sparkles: Sunrise ink and Sunrise per theme, so the burst reads on either page. */
  sparkles: {
    light: { ink: nativeThemes.light.sunriseInk, sun: nativeThemes.light.sunrise },
    dark: { ink: nativeThemes.dark.sunriseInk, sun: nativeThemes.dark.sunrise },
  },
} as const;

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two `#RRGGBB` colors. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The photo scrim (spec 2.3). A ramp in `overlayInk` from 0 at the top of the photo to `scrimBottomAlpha` at the
 * bottom, so a loaded photo has no straight edge, plus a text block that ramps from 0 to `textBlockAlpha` over
 * `textBlockHeight` dp at the bottom and then holds, so every wrapped line of cream text sits on it. The corner button
 * ("...") sits on its own `cornerButtonAlpha` disc. The flat 0.66 overlay and `scrimSoft` are gone.
 */
export const nativePhoto = {
  scrimBottomAlpha: 0.3,
  textBlockAlpha: 0.72,
  textBlockHeight: 26,
  cornerButtonAlpha: 0.66,
} as const;

/**
 * The native layout scale (customer layout spec, section 2). One source for sizes and spacing; `mobile-ui` reads it
 * through the `LayoutScale` context, so the customer app (`v2`) takes it and Catera Dapur keeps today's geometry
 * until it opts in.
 */
export const nativeLayout = {
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  /** The screen's side margin under `v2`; the classic margin is 20. */
  margin: 16,
  sectionGap: 32,
  headingGap: 12,
  groupGap: 8,
  cardPadding: 16,
  radius: { thumb: 8, control: 12, card: 16, sheet: 24 },
  control: { button: 50, field: 50, search: 44, chip: 34, icon: 44 },
  row: { single: 56, media: 72, keyValue: 40, info: 48 },
  thumb: { sm: 56, md: 64 },
  ratio: { hero: 4 / 3, card: 16 / 10, tile: 4 / 3 },
} as const;
