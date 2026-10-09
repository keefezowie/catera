import { ActivityIndicator, View } from "react-native";
import { Button, Text } from "./components";
import { useColors } from "./theme";

/**
 * The one action a screen is for, pinned at the bottom: an optional line of context above a full-width primary button.
 * Callers render it into `Screen`'s `footer`, so the page scrolls above it and it never covers content.
 * - `busy` swaps the label for a spinner and blocks presses until the call settles (the button keeps its label as its
 *   accessible name, and reads as disabled).
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
  const c = useColors();
  return (
    <View testID={testID} style={{ gap: 8 }}>
      {caption ? <Text variant="caption">{caption}</Text> : null}
      <View>
        <Button
          label={busy ? "" : label}
          accessibilityLabel={label}
          disabled={disabled || busy}
          onPress={onPress}
        />
        {busy ? (
          <View
            pointerEvents="none"
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" }}
          >
            <ActivityIndicator testID={`${testID}-spinner`} color={c.muted} />
          </View>
        ) : null}
      </View>
    </View>
  );
}
