import { View } from "react-native";
import { nativeLayout } from "@catera/design-tokens";
import { Text } from "../components";
import { themedStyles } from "../theme";
import { rowLabel } from "./rowLabel";

/**
 * A label and its value on one 40 row (Per paket, Uang, a customer's subscription): the label `bodyL` in `muted` at the
 * left, wrapping onto more lines when it is long (the row grows), and the value `bodyStrong` in tabular figures at the
 * right. The value never shrinks or truncates, so every value in one `ListCard` ends on the card's right edge and an
 * amount like "Rp 12.345.000" shows whole at large text. A screen reader hears the row as one line.
 */
export function KeyValueRow({ label, value, testID }: { label: string; value: string; testID?: string }) {
  const styles = useStyles();
  return (
    <View testID={testID} accessible accessibilityLabel={rowLabel(label, value)} style={styles.row}>
      <Text variant="bodyL" style={styles.label}>
        {label}
      </Text>
      <Text variant="bodyStrong" selectable style={styles.value}>
        {value}
      </Text>
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: nativeLayout.space.md,
    minHeight: nativeLayout.row.keyValue,
    paddingVertical: nativeLayout.space.sm,
  },
  label: { flex: 1, minWidth: 0, color: c.muted },
  value: { flexShrink: 0, textAlign: "right", fontVariant: ["tabular-nums"] },
}));
