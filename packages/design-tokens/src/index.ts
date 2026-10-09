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
  control: 120,
  selection: 180,
  content: 220,
  feature: 320,
  ease: [0.16, 1, 0.3, 1] as const,
  spring: { damping: 18, stiffness: 260 },
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

export type PaletteKey = keyof typeof colors | "controlRing" | "tabBar" | "disabledFill";
export type NativePalette = Record<PaletteKey, string>;
export type ThemeName = "light" | "dark";

/** Native palettes. Light is the web palette plus the native control ring and tab bar; dark follows the native visual identity spec. */
export const nativeThemes: Record<ThemeName, NativePalette> = {
  light: { ...colors, controlRing: "#858D80", tabBar: "#FFFEFA", disabledFill: "#CFD3C6" },
  dark: {
    forest: "#FFF7E9",
    forestDeep: "#E9E3D6",
    sunrise: "#F47B2A",
    sunriseInk: "#F5C9A6",
    cream: "#163D2E",
    charcoal: "#F5F1E8",
    surface: "#232321",
    canvas: "#151514",
    sage: "#2A2D27",
    scheduled: "#26302A",
    muted: "#B5B2AA",
    line: "#34332F",
    fieldBorder: "#7A7872",
    secondaryBorder: "#4A4944",
    attentionBorder: "#4C3322",
    danger: "#FF8F80",
    controlRing: "#8A8780",
    tabBar: "#1E1E1C",
    disabledFill: "#34332F",
  },
};

export type Mood = "siang" | "malam";
export type MoodKey =
  | "header" | "headerText" | "headerMeta" | "toggleTrack" | "toggleActive" | "onToggleActive"
  | "arcTrack" | "markerActive" | "markerIdle" | "hero" | "heroText" | "heroMeta" | "heroShadow";
export type MoodPalette = Record<MoodKey, string> & { pattern: string | null };

const warmShadow = "0 10px 28px rgba(107,74,43,0.16)";
const deepShadow = "0 10px 28px rgba(0,0,0,0.35)";

/**
 * Mood surfaces only: the mood header, the toggle, the day arc, the Malam pattern and the hero card.
 * A Siang hero is the theme surface, so it reads the same token and cannot drift from it.
 */
export const nativeMood: Record<ThemeName, Record<Mood, MoodPalette>> = {
  light: {
    siang: {
      header: "#FFEFD9",
      headerText: "#163D2E",
      headerMeta: "#6B4A2B",
      toggleTrack: "#F6DDBE",
      toggleActive: "#9B4309",
      onToggleActive: "#FFF7E9",
      arcTrack: "#E2C29C",
      markerActive: "#9B4309",
      markerIdle: "#9A7A55",
      hero: nativeThemes.light.surface,
      heroText: "#163D2E",
      heroMeta: "#60675F",
      heroShadow: warmShadow,
      pattern: null,
    },
    malam: {
      header: "#0B1F16",
      headerText: "#FFF7E9",
      headerMeta: "#A9BDB0",
      toggleTrack: "#1C3A2C",
      toggleActive: "#FFF7E9",
      onToggleActive: "#0B1F16",
      arcTrack: "#2C4C3C",
      markerActive: "#FFF7E9",
      markerIdle: "#6E8C7C",
      hero: "#1C3A2C",
      heroText: "#FFF7E9",
      heroMeta: "#A9BDB0",
      heroShadow: deepShadow,
      pattern: "#1A3A2B",
    },
  },
  dark: {
    siang: {
      header: "#3A2617",
      headerText: "#F5F1E8",
      headerMeta: "#E6C3A2",
      toggleTrack: "#4C3322",
      toggleActive: "#F5C9A6",
      onToggleActive: "#3A1A04",
      arcTrack: "#6A4A33",
      markerActive: "#F5C9A6",
      markerIdle: "#A88A6A",
      hero: nativeThemes.dark.surface,
      heroText: "#F5F1E8",
      heroMeta: "#B5B2AA",
      heroShadow: deepShadow,
      pattern: null,
    },
    malam: {
      header: "#163D2E",
      headerText: "#F5F1E8",
      headerMeta: "#CFE0D2",
      toggleTrack: "#25553F",
      toggleActive: "#FFF7E9",
      onToggleActive: "#163D2E",
      arcTrack: "#2C5A45",
      markerActive: "#FFF7E9",
      markerIdle: "#7FA08E",
      hero: "#1C3A2C",
      heroText: "#F5F1E8",
      heroMeta: "#CFE0D2",
      heroShadow: deepShadow,
      pattern: "#1F4A38",
    },
  },
};

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
