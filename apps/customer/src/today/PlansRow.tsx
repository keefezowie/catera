import { Image, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useMobile } from "@catera/mobile-core";
import { fonts, PressableRow, Text, themedStyles, useColors } from "@catera/mobile-ui";
import { photoUri } from "./Plate";

const THUMB = 34;

/**
 * The last thing on Beranda: one bordered row for every running plan, with up to three overlapping package photos,
 * "{n} paket aktif" and the kitchens. It opens Paket saya, where each plan has its own row.
 */
export function PlansRow({
  count,
  caterers,
  images,
  apiBase,
}: {
  count: number;
  caterers: string[];
  images: string[];
  apiBase: string;
}) {
  const { t } = useMobile();
  const c = useColors();
  const styles = useStyles();
  if (!count) return null;
  const title = t(`${count} paket aktif`, count === 1 ? "1 active plan" : `${count} active plans`);
  const kitchens = caterers.join(", ");
  return (
    <PressableRow
      testID="plans-row"
      accessibilityRole="button"
      accessibilityLabel={kitchens ? `${title}, ${kitchens}` : title}
      onPress={() => router.push("/paket-saya" as never)}
      style={styles.card}
    >
      {images.length ? (
        <View style={styles.thumbs} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {images.slice(0, 3).map((src, i) => (
            <View key={src} testID="plans-thumb" style={[styles.thumb, i > 0 && { marginLeft: -10 }]}>
              <Image
                accessibilityIgnoresInvertColors
                source={{ uri: photoUri(src, apiBase) }}
                resizeMode="cover"
                style={{ width: THUMB - 4, height: THUMB - 4, borderRadius: (THUMB - 4) / 2 }}
              />
            </View>
          ))}
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title}>{title}</Text>
        {kitchens ? (
          <Text variant="caption" style={styles.caterers}>
            {kitchens}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.muted} />
    </PressableRow>
  );
}

const useStyles = themedStyles((c) => ({
  // A body card on theme colours, like the waiting list: a border, no shadow.
  card: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  thumbs: { flexDirection: "row", alignItems: "center" },
  // A 2dp ring in the card's own colour keeps the overlapping photos apart.
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    padding: 2,
    backgroundColor: c.surface,
    overflow: "hidden",
  },
  // "8 paket aktif" is a count, so its digits are tabular.
  title: { fontSize: 15, lineHeight: 20, fontFamily: fonts.bold, color: c.charcoal, fontVariant: ["tabular-nums"] },
  caterers: { fontSize: 12, lineHeight: 16 },
}));
