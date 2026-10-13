import { View } from "react-native";
import { Button, Text } from "./components";

/**
 * The one action a screen is for, pinned at the bottom: an optional line of context above a full-width primary button.
 * Callers render it into `Screen`'s `footer`, so the page scrolls above it and it never covers content.
 * - `busy` is the `Button`'s busy state: the spinner after 150 ms, presses ignored until the call settles, the label
 *   kept as the accessible name.
 * - `disabled` blocks presses and greys the button.
 * It adds no chrome: the footer slot already gives the padding, the top border, the 760 cap and the surface fill.
 * `testID` names it; the spinner is `<testID>-spinner`.
 */
export function StickyAction({
  label,
  caption,
  onPress,
  busy = false,
  disabled = false,
  testID = "sticky-action",
}: {
  label: string;
  caption?: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <View testID={testID} style={{ gap: 8 }}>
      {caption ? <Text variant="caption">{caption}</Text> : null}
      <Button label={label} busy={busy} disabled={disabled} onPress={onPress} spinnerTestID={`${testID}-spinner`} />
    </View>
  );
}
