import type { ReactNode } from "react";
import { View } from "react-native";
import { fontFor, PressableRow, Text, themedStyles, useColors } from "@catera/mobile-ui";
import { DecorativeIcon, rowLabel } from "../layout";

/** A payment's state on its row: Lunas, Menunggu, Diproses or Kedaluwarsa. */
export type RowStatus = { label: string; tone: "paid" | "waiting" | "checking" | "expired" };

/**
 * A read-only status tag: the grey `fill` ground, no border (it is not a chip control), the ink by outcome: forest for
 * paid, danger for expired, charcoal while it waits. It never shrinks its label; the line it sits on wraps instead.
 */
function StatusTag({ status }: { status: RowStatus }) {
  const c = useColors();
  const ink = status.tone === "paid" ? c.forest : status.tone === "expired" ? c.danger : c.charcoal;
  return (
    <View
      testID="payment-status"
      style={{ backgroundColor: c.fill, borderRadius: 8, borderCurve: "continuous", paddingHorizontal: 8, paddingVertical: 2 }}
    >
      <Text variant="caption" style={{ color: ink, fontFamily: fontFor("600") }}>
        {status.label}
      </Text>
    </View>
  );
}

/** One plain list row (52pt tall): a label, an optional status tag and value, and a chevron when it opens something. */
export function Row({
  label,
  caption,
  value,
  status,
  onPress,
  first,
  testID,
  children,
}: {
  label: string;
  caption?: string;
  value?: string;
  status?: RowStatus;
  onPress?: () => void;
  first?: boolean;
  testID?: string;
  children?: ReactNode;
}) {
  const c = useColors();
  const styles = useStyles();
  const captionText = caption ? (
    <Text variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
      {caption}
    </Text>
  ) : null;
  const body = (
    <>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fontFor("700") }}>{label}</Text>
        {status ? (
          // The tag leads the caption; at a larger text size the caption drops under it rather than squeezing either.
          <View testID="payment-status-line" style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 8, rowGap: 4 }}>
            <StatusTag status={status} />
            {captionText}
          </View>
        ) : (
          captionText
        )}
      </View>
      {value ? (
        <Text variant="caption" selectable={!onPress} style={{ color: c.charcoal, fontVariant: ["tabular-nums"] }}>
          {value}
        </Text>
      ) : null}
      {children}
      {onPress && process.env.EXPO_OS === "ios" ? <DecorativeIcon name="chevron-forward" size={18} color={c.muted} /> : null}
    </>
  );
  if (!onPress)
    return (
      <View testID={testID} style={[styles.row, !first && styles.divider]}>
        {body}
      </View>
    );
  return (
    <PressableRow
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={rowLabel(label, status?.label, value)}
      onPress={onPress}
      style={[styles.row, !first && styles.divider]}
    >
      {body}
    </PressableRow>
  );
}

/** A small forest heading above a group of rows. */
export function SectionLabel({ children }: { children: string }) {
  return (
    <Text variant="label" style={{ marginTop: 4 }}>
      {children}
    </Text>
  );
}

const useStyles = themedStyles((c) => ({
  row: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: c.line },
}));
