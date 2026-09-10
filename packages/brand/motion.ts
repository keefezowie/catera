/** Shared normalized timeline. Artwork stays on a registered square canvas. */
export const mascotMotion = {
  duration: 2400,
  delay: 300,
  size: 160,
  rise: 4,
  tilt: 1.5,
  blink: [0.4625, 0.4875, 0.5125, 0.5375],
  halfOpacityTimes: [0, 0.45, 0.4625, 0.525, 0.5375, 1],
  closedOpacityTimes: [0, 0.475, 0.4875, 0.5, 0.5125, 1],
  label: "Menyiapkan Catera untuk Anda…",
} as const;
