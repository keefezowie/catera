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
