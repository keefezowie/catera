import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { RoundButton, Text } from "./components";
import { useTouchTarget } from "./layoutScale";
import { PressableScale } from "./motion";
import { useColors } from "./theme";
import { fonts } from "./type";

const BADGE = 28;
const PILL_HEIGHT = 20;

/** A stop's place in the run: cooking, out for delivery, or arrived. The Dapur row draws it as a pill under the address. */
export type StopStatus = { label: string; tone: "cooking" | "out" | "arrived" };
/** Under the Dapur geometry (a 48 touch target): the row is 64, and the map and "…" buttons are bare 48 icon buttons in one column. */
const V2_ROW = 64;
const V2_BUTTON = 48;
/** Where a v2 row's text column starts: the 28 badge and the 12 gap. A `ListCard` of these rows insets its hairlines by it. */
export const STOP_ROW_INSET = BADGE + 12;
/** The same with the 24 selection circle and its gap before the badge (Pilih mode). */
export const STOP_ROW_PICKING_INSET = 24 + 12 + STOP_ROW_INSET;

/**
 * One stop on the delivery order: its number, who and what ("Bu Rina  8 porsi siang"), and the address on one line.
 * - The name and the detail share one line of text that wraps; only the address is held to one line, because a long
 *   address would otherwise push the buttons off screen. The full address is in the accessibility label of the text
 *   block (`<testID>-info`), so a screen reader never hears it cut.
 * - `selection` turns the number-and-text block into one checkbox with a circle before it (Dapur's "Pilih" mode); the
 *   map button stays outside it, and the "…" button is hidden while selecting. A `disabled` stop cannot be ticked, and
 *   `note` under the address says why. Without `selection` the row is exactly as before.
 * - `status` (Dapur geometry) is one more line after the note: a pill for cooking, out, or arrived. It is spoken in the row's
 *   label, and an arrived stop's number badge goes muted (`muted` ink on `line`).
 * - The map button opens the stop in a map. The "…" button is the stop's other actions (move a day, report a problem)
 *   and exists only when the caller has some. Both are 48dp round buttons.
 * - Where the root asks for a 48 touch target (Catera Dapur's) the row is 64 (the `TwoLineRow` geometry): the 28 badge,
 *   one `rowTitle` line "name · n porsi" (`portions`), one `meta` line "package · address" (`packageName`; the end of
 *   the address is what gets cut), a delivery `note` as one more `meta` line when there is one, and both buttons as bare
 *   48 icon buttons in one fixed trailing column. A stop with no "…" keeps its room, so the map button stands at the same
 *   place on every row. Without `portions` and `packageName` the title is the name alone and the meta line starts with
 *   `detail`. The whole text, the note too, is in the accessibility label. Under any other target (the customer app's 44,
 *   with or without the `v2` scale) the row is as it was and ignores `portions`, `packageName` and `note`.
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
  portions,
  packageName,
  note,
  status,
  testID = "stop-row",
}: {
  n: number;
  name: string;
  detail: string;
  address: string;
  /** Dapur geometry only: how many portions ("2 porsi"), joined to the name on the title line. */
  portions?: string;
  /** Dapur geometry only: the package, ahead of the address on the meta line. */
  packageName?: string;
  /** Dapur geometry only: the stop's delivery note, one more `meta` line under the address. */
  note?: string;
  /** Dapur geometry only: where the stop's meal is, a pill after the note. An arrived stop's number goes muted. */
  status?: StopStatus;
  onMap: () => void;
  mapLabel: string;
  onMore?: () => void;
  moreLabel?: string;
  selection?: { selected: boolean; disabled?: boolean; onToggle: () => void; note?: string };
  testID?: string;
}) {
  const c = useColors();
  if (useTouchTarget() >= 48) {
    return (
      <StopRowV2
        n={n}
        name={name}
        detail={detail}
        address={address}
        portions={portions}
        packageName={packageName}
        note={note}
        status={status}
        onMap={onMap}
        mapLabel={mapLabel}
        onMore={onMore}
        moreLabel={moreLabel}
        selection={selection}
        testID={testID}
      />
    );
  }
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
              borderCurve: "continuous",
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

/** Cooking is the quiet scheduled family, out is the one attention tint (cream with sunrise ink), arrived is solid forest. */
function pillColors(tone: StopStatus["tone"], c: ReturnType<typeof useColors>) {
  if (tone === "cooking") return { fill: c.scheduled, ink: c.forest, edge: null };
  if (tone === "out") return { fill: c.cream, ink: c.sunriseInk, edge: c.attentionBorder };
  return { fill: c.forest, ink: c.cream, edge: null };
}

function IconButton({ icon, label, onPress, testID }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; testID?: string }) {
  const c = useColors();
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      haptic="tap"
      onPress={onPress}
      style={{ width: V2_BUTTON, height: V2_BUTTON, alignItems: "center", justifyContent: "center" }}
    >
      <Ionicons name={icon} size={22} color={c.forest} />
    </PressableScale>
  );
}

function StopRowV2({
  n,
  name,
  detail,
  address,
  portions,
  packageName,
  note,
  status,
  onMap,
  mapLabel,
  onMore,
  moreLabel,
  selection,
  testID,
}: {
  n: number;
  name: string;
  detail: string;
  address: string;
  portions?: string;
  packageName?: string;
  note?: string;
  status?: StopStatus;
  onMap: () => void;
  mapLabel: string;
  onMore?: () => void;
  moreLabel?: string;
  selection?: { selected: boolean; disabled?: boolean; onToggle: () => void; note?: string };
  testID: string;
}) {
  const c = useColors();
  // A stop that has arrived is done with the kitchen: its number goes quiet so the eye lands on stops still out.
  const done = status?.tone === "arrived";
  const pill = status ? pillColors(status.tone, c) : null;
  const badge = (
    <View
      testID={`${testID}-badge`}
      style={{ width: BADGE, height: BADGE, borderRadius: BADGE / 2, backgroundColor: done ? c.line : c.sage, alignItems: "center", justifyContent: "center" }}
    >
      <Text variant="label" style={{ lineHeight: 16, fontVariant: ["tabular-nums"], ...(done ? { color: c.muted } : null) }}>
        {n}
      </Text>
    </View>
  );
  // Name and portions on the title line; the package ahead of the address on the meta line, so a long address is what
  // gets cut. Callers that pass neither get the name alone over `detail · address`.
  const split = portions !== undefined || packageName !== undefined;
  const meta = (packageName !== undefined ? [packageName, address] : split ? [address] : [detail, address]).filter(Boolean).join(" · ");
  const spoken = `${n}. ${name}, ${detail}, ${address}` + (note ? `, ${note}` : "") + (status ? `, ${status.label}` : "");
  const text = (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text testID={`${testID}-title`} variant="rowTitle" numberOfLines={1}>
        <Text variant="rowTitle">{name}</Text>
        {portions ? <Text variant="meta" style={{ fontVariant: ["tabular-nums"] }}>{` · ${portions}`}</Text> : null}
      </Text>
      <Text testID={`${testID}-meta`} variant="meta" numberOfLines={1}>
        {meta}
      </Text>
      {note ? (
        <Text testID={`${testID}-delivery-note`} variant="meta" numberOfLines={1} style={{ color: c.charcoal }}>
          {note}
        </Text>
      ) : null}
      {status && pill ? (
        <View
          testID={`${testID}-status`}
          style={{
            alignSelf: "flex-start",
            minHeight: PILL_HEIGHT,
            marginTop: 2,
            paddingHorizontal: 8,
            justifyContent: "center",
            borderRadius: PILL_HEIGHT / 2,
            backgroundColor: pill.fill,
            borderWidth: pill.edge ? 1 : 0,
            borderColor: pill.edge ?? "transparent",
          }}
        >
          <Text variant="meta" numberOfLines={1} style={{ color: pill.ink, fontVariant: ["tabular-nums"] }}>
            {status.label}
          </Text>
        </View>
      ) : null}
      {selection?.note ? (
        // One line, cut at the end: the last line of a picking row, after the delivery note and the status pill.
        <Text testID={`${testID}-note`} variant="meta" numberOfLines={1}>
          {selection.note}
        </Text>
      ) : null}
    </View>
  );
  // The "…" is hidden while picking; outside it, a stop without one keeps the room so the map button never shifts.
  const actions = selection ? V2_BUTTON : V2_BUTTON * 2;
  return (
    <View testID={testID} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: V2_ROW, paddingVertical: 8 }}>
      {selection ? (
        <Pressable
          testID={`${testID}-info`}
          accessibilityRole="checkbox"
          accessibilityLabel={spoken + (selection.note ? `, ${selection.note}` : "")}
          accessibilityState={{ checked: selection.selected, disabled: selection.disabled ?? false }}
          disabled={selection.disabled}
          onPress={selection.onToggle}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: V2_ROW - 16 }}
        >
          <View
            testID={`${testID}-circle`}
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              borderCurve: "continuous",
              borderWidth: selection.selected ? 2 : 1.5,
              borderColor: selection.selected ? c.forest : c.muted,
              alignItems: "center",
              justifyContent: "center",
              opacity: selection.disabled ? 0.45 : 1,
            }}
          >
            {selection.selected ? <Ionicons name="checkmark" size={16} color={c.forest} /> : null}
          </View>
          {badge}
          {text}
        </Pressable>
      ) : (
        <View
          testID={`${testID}-info`}
          accessible
          accessibilityLabel={spoken}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}
        >
          {badge}
          {text}
        </View>
      )}
      <View testID={`${testID}-actions`} style={{ width: actions, flexDirection: "row", flexGrow: 0, flexShrink: 0 }}>
        <IconButton icon="map-outline" label={mapLabel} onPress={onMap} />
        {onMore && !selection ? <IconButton icon="ellipsis-horizontal" label={moreLabel ?? "…"} onPress={onMore} /> : null}
      </View>
    </View>
  );
}
