import { Chip } from "@catera/mobile-ui";

/** Jelajah filter and category: the shared Chip, so it takes the layout scale's 34 height (and its 44 hit area) with the rest. */
export function FilterChip(props: { label: string; selected: boolean; onPress: () => void; accessibilityLabel?: string }) {
  return <Chip {...props} />;
}
