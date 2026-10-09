import { View } from "react-native";
import { RoundButton, Text } from "./components";
import { useColors } from "./theme";
import { fonts } from "./type";

const BADGE = 28;

/**
 * One stop on the delivery order: its number, who and what ("Bu Rina  8 porsi siang"), and the address on one line.
 * - The name and the detail share one line of text that wraps; only the address is held to one line, because a long
 *   address would otherwise push the buttons off screen. The full address is in the accessibility label of the text
 *   block (`<testID>-info`), so a screen reader never hears it cut.
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
  testID?: string;
}) {
  const c = useColors();
  return (
    <View testID={testID} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 }}>
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
      <RoundButton icon="map-outline" label={mapLabel} onPress={onMap} />
      {onMore ? <RoundButton icon="ellipsis-horizontal" label={moreLabel ?? "…"} onPress={onMore} /> : null}
    </View>
  );
}
