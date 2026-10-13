import { Children, Fragment, isValidElement, type ReactNode } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, Pressable, Switch, Text as RNText, View } from "react-native";
import { useHaptic } from "../motion";
import { Skeleton, SkeletonGroup } from "../Skeleton";
import { useColors } from "../theme";
import { fonts } from "../type";

/**
 * Pengaturan's grouped list, one look per platform (spec 4.2, canvas `Settings`):
 * - iOS: inset grouped sections. A muted section label sits over a `surface` card with a 1dp `line` edge and a 16
 *   radius; rows are 52pt or taller, divided by a hairline from their text edge, and pressing one tints it `sage`.
 * - Android: Material list rows. The section label is the M3 list subheader (14 bold, forest); rows run edge to edge
 *   with the ripple, 56dp for one line and 72dp with a supporting line, and a row's value is its supporting line.
 * Rows only set minimum heights and never cut a line, so they grow with the phone's text size.
 * `os` defaults to the running platform everywhere here.
 */

/** The body inset of `Screen`; Android rows reach past it so their ripple and dividers run edge to edge. */
const BODY_INSET = 20;

export function SettingsSection({
  title,
  children,
  os = process.env.EXPO_OS,
}: {
  /** The section label; a section without one (Keluar) stands on its own. */
  title?: string;
  children: ReactNode;
  os?: string;
}) {
  const palette = useColors();
  const ios = os === "ios";
  const rows = Children.toArray(children).filter(isValidElement);
  const label = title ? (
    <RNText
      accessibilityRole="header"
      style={
        ios
          ? { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: palette.muted, paddingHorizontal: 16 }
          : { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: palette.charcoal, paddingHorizontal: BODY_INSET, paddingTop: 8, paddingBottom: 4 }
      }
    >
      {title}
    </RNText>
  ) : null;

  if (ios)
    return (
      <View testID="settings-section" style={{ gap: 6 }}>
        {label}
        <View
          style={{
            backgroundColor: palette.surface,
            borderRadius: 16,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: palette.line,
            overflow: "hidden",
          }}
        >
          {rows.map((row, i) => (
            <Fragment key={row.key ?? i}>
              {i > 0 ? <View style={{ height: 1, marginStart: 16, backgroundColor: palette.line }} /> : null}
              {row}
            </Fragment>
          ))}
        </View>
      </View>
    );

  return (
    <View testID="settings-section" style={{ marginHorizontal: -BODY_INSET }}>
      {/* A section with no label of its own is set apart by a divider instead. */}
      {title ? label : <View style={{ height: 1, backgroundColor: palette.line, marginBottom: 8 }} />}
      {rows}
    </View>
  );
}

/** The row's text column: its label, then an optional supporting line. */
function RowText({
  label,
  supporting,
  tone,
  centred,
  selectable,
}: {
  label: string;
  supporting?: string;
  tone?: "danger";
  centred: boolean;
  selectable?: boolean;
}) {
  const palette = useColors();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <RNText
        testID="settings-label"
        style={{
          fontFamily: tone === "danger" ? fonts.semibold : fonts.medium,
          fontSize: 16,
          lineHeight: 22,
          color: tone === "danger" ? palette.danger : palette.charcoal,
          textAlign: centred ? "center" : "left",
        }}
      >
        {label}
      </RNText>
      {supporting ? (
        <RNText
          selectable={selectable}
          style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: palette.muted, fontVariant: ["tabular-nums"] }}
        >
          {supporting}
        </RNText>
      ) : null}
    </View>
  );
}

/**
 * One row: its label and current value ("Bahasa", "Indonesia"). With `onPress` it opens something: on iOS the value
 * sits at the trailing edge before a chevron, on Android it is the supporting line. Without `onPress` it only informs
 * ("Versi aplikasi"); `selectable` lets the value be copied. `tone="danger"` is Keluar: the danger ink, centred in its
 * own card on iOS.
 *
 * `busy` is a row whose action is still running (Keluar while sign-out lets go of this phone's push token): it ignores
 * presses, fades its text the way a disabled quiet button does (0.45), keeps its label as its name, reads as
 * `{ busy, disabled }` and shows the busy tier's small inline indicator at the trailing edge (no mascot: an inline wait,
 * not a screen). On a centred iOS row the indicator sits over the trailing padding, so the label stays centred.
 */
export function SettingsRow({
  label,
  value,
  supporting,
  onPress,
  tone,
  selectable,
  busy = false,
  os = process.env.EXPO_OS,
}: {
  label: string;
  value?: string;
  supporting?: string;
  onPress?: () => void;
  tone?: "danger";
  selectable?: boolean;
  busy?: boolean;
  os?: string;
}) {
  const palette = useColors();
  const ios = os === "ios";
  const lines = [supporting, ios ? undefined : value].filter(Boolean).join("\n") || undefined;
  const centred = ios && tone === "danger" && !value;
  const inset = ios ? 16 : BODY_INSET;
  const body = (
    <View
      testID="settings-row-body"
      style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, opacity: busy ? 0.45 : 1 }}
    >
      <RowText label={label} supporting={lines} tone={tone} centred={centred} selectable={selectable} />
      {ios && value ? (
        <RNText
          selectable={selectable}
          style={{
            flexShrink: 1,
            maxWidth: "55%",
            fontFamily: fonts.regular,
            fontSize: 16,
            lineHeight: 22,
            color: palette.muted,
            textAlign: "right",
            fontVariant: ["tabular-nums"],
          }}
        >
          {value}
        </RNText>
      ) : null}
      {ios && onPress && tone !== "danger" ? <Ionicons name="chevron-forward" size={16} color={palette.controlRing} /> : null}
    </View>
  );
  const indicator = busy ? (
    <View
      pointerEvents="none"
      style={centred ? { position: "absolute", top: 0, bottom: 0, right: inset, justifyContent: "center" } : null}
    >
      <ActivityIndicator testID="settings-row-busy" size="small" color={palette.muted} />
    </View>
  ) : null;
  const frame = {
    minHeight: ios ? 52 : lines ? 72 : 56,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    paddingHorizontal: inset,
    paddingVertical: ios ? 12 : 8,
  };
  if (!onPress)
    return (
      <View testID="settings-row" style={frame}>
        {body}
      </View>
    );
  return (
    <Pressable
      testID="settings-row"
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityState={busy ? { busy: true, disabled: true } : undefined}
      disabled={busy}
      onPress={onPress}
      android_ripple={{ color: palette.line }}
      style={({ pressed }) => [frame, ios && pressed ? { backgroundColor: palette.sage } : null]}
    >
      {body}
      {indicator}
    </Pressable>
  );
}

/**
 * A row with the platform's own switch (Pengaturan's "Notifikasi di ponsel ini"). The track is `forest` when on; on
 * Android the thumb is `cream` on it, the M3 on-primary handle. `loading` holds the switch's place with a skeleton block
 * until the first read answers, so the switch never flips by itself on open. `notice` is a line under the row that
 * explains a state ("Izinkan notifikasi di Pengaturan ponsel"), and `action` the one button that resolves it.
 */
export function SettingsSwitchRow({
  label,
  supporting,
  value,
  disabled = false,
  loading = false,
  loadingLabel = "",
  notice,
  action,
  onValueChange,
  os = process.env.EXPO_OS,
}: {
  label: string;
  supporting: string;
  value: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** The spoken name of the wait while `loading` ("Memuat"); this package has no i18n. */
  loadingLabel?: string;
  notice?: string;
  action?: { label: string; onPress: () => void };
  onValueChange: (next: boolean) => void;
  os?: string;
}) {
  const palette = useColors();
  const ios = os === "ios";
  const inset = ios ? 16 : BODY_INSET;
  return (
    <View testID="settings-switch-row" style={{ minHeight: ios ? 52 : 72, paddingVertical: ios ? 12 : 8, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: inset, minHeight: 48 }}>
        <RowText label={label} supporting={supporting} centred={false} />
        {loading ? (
          <SkeletonGroup label={loadingLabel}>
            <Skeleton width={52} height={32} radius={16} />
          </SkeletonGroup>
        ) : (
          <Switch
            accessible
            accessibilityLabel={label}
            accessibilityHint={supporting}
            accessibilityState={{ checked: value, disabled }}
            value={value}
            disabled={disabled}
            onValueChange={onValueChange}
            trackColor={{ true: palette.forest, false: ios ? undefined : palette.disabledFill }}
            // Android: the M3 handle, on-primary when on and the outline tone when off. iOS keeps its own white thumb
            // and system off track.
            thumbColor={ios ? undefined : value ? palette.cream : palette.controlRing}
          />
        )}
      </View>
      {notice ? (
        <View style={{ paddingHorizontal: inset, gap: 4, alignItems: "flex-start" }}>
          <RNText selectable style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: palette.charcoal }}>
            {notice}
          </RNText>
          {action ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={action.onPress}
              android_ripple={{ color: palette.line }}
              hitSlop={4}
              style={({ pressed }) => ({ minHeight: ios ? 44 : 48, justifyContent: "center", opacity: ios && pressed ? 0.5 : 1 })}
            >
              <RNText style={{ fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: palette.forest }}>{action.label}</RNText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * A single choice as a list (the Bahasa sheet): a `radiogroup` named `label`, one `radio` per option. iOS marks the
 * chosen row with a trailing checkmark; Android leads each row with the Material radio button. Choosing gives the
 * selection haptic and calls `onChange`, also for the option already chosen, so a sheet can close on any choice.
 * An option's `detail` is a muted supporting line under its label (an address's street); a row with one is at least
 * 72dp on Android, Material's two-line list item. `value` may be null when nothing is chosen yet.
 */
export function ChoiceList<T extends string>({
  label,
  options,
  value,
  onChange,
  os = process.env.EXPO_OS,
}: {
  label: string;
  options: { value: T; label: string; detail?: string }[];
  value: T | null | undefined;
  onChange: (next: T) => void;
  os?: string;
}) {
  const palette = useColors();
  const haptic = useHaptic();
  const ios = os === "ios";
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option, i) => {
        const chosen = option.value === value;
        return (
          <Fragment key={option.value}>
            {ios && i > 0 ? <View style={{ height: 1, marginStart: 20, backgroundColor: palette.line }} /> : null}
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel={option.detail ? `${option.label}, ${option.detail}` : option.label}
              accessibilityState={{ checked: chosen }}
              onPress={() => {
                haptic.select();
                onChange(option.value);
              }}
              android_ripple={{ color: palette.line }}
              style={({ pressed }) => [
                {
                  minHeight: ios ? 52 : option.detail ? 72 : 56,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 16,
                  paddingHorizontal: ios ? 20 : 24,
                  paddingVertical: 8,
                },
                ios && pressed ? { backgroundColor: palette.sage } : null,
              ]}
            >
              {ios ? null : (
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: chosen ? palette.forest : palette.controlRing,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {chosen ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: palette.forest }} /> : null}
                </View>
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <RNText
                  style={{
                    fontFamily: chosen ? fonts.semibold : fonts.regular,
                    fontSize: ios ? 17 : 16,
                    lineHeight: 22,
                    color: palette.charcoal,
                  }}
                >
                  {option.label}
                </RNText>
                {option.detail ? (
                  <RNText style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: palette.muted }}>
                    {option.detail}
                  </RNText>
                ) : null}
              </View>
              {ios && chosen ? <Ionicons name="checkmark" size={20} color={palette.forest} /> : null}
            </Pressable>
          </Fragment>
        );
      })}
    </View>
  );
}
