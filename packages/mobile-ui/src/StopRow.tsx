import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { RoundButton, Text } from "./components";
import { useColors } from "./theme";
import { fonts } from "./type";

const BADGE = 28;

/**
 * One stop on the delivery order: its number, who and what ("Bu Rina  8 porsi siang"), and the address on one line.
 * - The name and the detail share one line of text that wraps; only the address is held to one line, because a long
 *   address would otherwise push the buttons off screen. The full address is in the accessibility label of the text
 *   block (`<testID>-info`), so a screen reader never hears it cut.
 * - `selection` turns the number-and-text block into one checkbox with a circle before it (Dapur's "Pilih" mode); the
 *   map button stays outside it, and the "…" button is hidden while selecting. A `disabled` stop cannot be ticked, and
 *   `note` under the address says why. Without `selection` the row is exactly as before.
 * - The map button opens the stop in a map. The "…" button is the stop's other actions (move a day, report a problem)
 *   and exists only when the caller has some. Both are 48dp round buttons.
 */
export function StopRow({
  n,
  name,
  detail,
  address,
  onMap,
  mapLabel,
  onMore,
  moreLabel,
  selection,
  testID = "stop-row",
}: {
  n: number;
  name: string;
  detail: string;
  address: string;
  onMap: () => void;
  mapLabel: string;
  onMore?: () => void;
  moreLabel?: string;
  selection?: { selected: boolean; disabled?: boolean; onToggle: () => void; note?: string };
  testID?: string;
}) {
  const c = useColors();
  return (
    <View testID={testID} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 }}>
      {selection ? (
        <Pressable
          testID={`${testID}-info`}
          accessibilityRole="checkbox"
          accessibilityLabel={selection ? `${n}. ${name}, ${detail}, ${address}` + (selection.note ? `, ${selection.note}` : "") : undefined}
          accessibilityState={{ checked: selection?.selected ?? false, disabled: selection?.disabled ?? false }}
          disabled={selection?.disabled}
          onPress={selection?.onToggle}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 }}
        >
          <View
            testID={`${testID}-circle`}
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              borderWidth: selection?.selected ? 2 : 1.5,
              borderColor: selection?.selected ? c.forest : c.muted,
              alignItems: "center",
              justifyContent: "center",
              opacity: selection?.disabled ? 0.45 : 1,
            }}
          >
            {selection?.selected ? <Ionicons name="checkmark" size={16} color={c.forest} /> : null}
          </View>
          <View
            testID={`${testID}-badge`}
            style={{
              width: BADGE,
              height: BADGE,
              borderRadius: BADGE / 2,
              backgroundColor: c.sage,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text variant="label" style={{ lineHeight: 16, fontVariant: ["tabular-nums"] }}>
              {n}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text testID={`${testID}-title`}>
              <Text style={{ fontFamily: fonts.bold }}>{name}</Text>
              <Text>{`  ${detail}`}</Text>
            </Text>
            <Text numberOfLines={1} style={{ color: c.muted }}>
              {address}
            </Text>
            {selection?.note ? (
              <Text testID={`${testID}-note`} variant="caption">
                {selection.note}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ) : (
        <View
          testID={`${testID}-info`}
          accessible
          accessibilityLabel={`${n}. ${name}, ${detail}, ${address}`}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}
        >
          <View
            testID={`${testID}-badge`}
            style={{
              width: BADGE,
              height: BADGE,
              borderRadius: BADGE / 2,
              backgroundColor: c.sage,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text variant="label" style={{ lineHeight: 16, fontVariant: ["tabular-nums"] }}>
              {n}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text testID={`${testID}-title`}>
              <Text style={{ fontFamily: fonts.bold }}>{name}</Text>
              <Text>{`  ${detail}`}</Text>
            </Text>
            <Text numberOfLines={1} style={{ color: c.muted }}>
              {address}
            </Text>
          </View>
        </View>
      )}
      <RoundButton icon="map-outline" label={mapLabel} onPress={onMap} />
      {onMore && !selection ? <RoundButton icon="ellipsis-horizontal" label={moreLabel ?? "…"} onPress={onMore} /> : null}
    </View>
  );
}
