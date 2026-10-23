import type { ComponentProps } from "react";
import { View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { nativeLayout } from "@catera/design-tokens";
import { useMobile } from "@catera/mobile-core";
import { PressableRow, Skeleton, SkeletonGroup, Text, themedStyles, useColors, useStackedLayout, cardEdge, cardEdgeWidth } from "@catera/mobile-ui";
import { DecorativeIcon, rowLabel } from "../layout";

/** A shortcut tile is at least this tall (spec 3.5); its words push it taller rather than being cut. */
export const TILE_MIN_HEIGHT = 96;
/** The tile's inner padding. */
export const TILE_PADDING = nativeLayout.space.md;
/** The count line under a tile's label is one `meta` line high (13/18), reserved while the count loads. */
export const TILE_COUNT_LINE = 18;
/**
 * The effective width (`width / fontScale`) under which the tiles stack in one column. A third of the row at 316 (412dp
 * at font scale 1.3) leaves about 90dp, where "Pembayaran" broke mid-word; 360dp at 277 is worse. 412dp and 360dp at
 * font scale 1.0 (412 and 360) keep three columns.
 */
export const TILES_STACK_BELOW = 340;

type Glyph = ComponentProps<typeof Ionicons>["name"];

/** What a tile says under its label: a count, nothing yet (the read is out), or nothing (the read failed). */
type Count = { kind: "text"; text: string } | { kind: "loading" } | { kind: "none" };

/**
 * One shortcut tile: the glyph over a `bodyStrong` label and a `meta` count, on a 16 radius surface at least 96 tall.
 * Every word wraps; nothing is held to one line.
 */
function Tile({
  testID,
  glyph,
  label,
  count,
  href,
  stacked,
}: {
  testID: string;
  glyph: Glyph;
  label: string;
  count: Count;
  href: string;
  stacked: boolean;
}) {
  const c = useColors();
  const styles = useStyles();
  const text = count.kind === "text" ? count.text : "";
  return (
    <PressableRow
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={rowLabel(label, text)}
      onPress={() => router.push(href as never)}
      style={[styles.tile, stacked ? styles.tileStacked : styles.tileColumn]}
    >
      <DecorativeIcon name={glyph} size={24} color={c.charcoal} />
      <View style={styles.words}>
        <Text variant="bodyStrong">{label}</Text>
        {count.kind === "text" ? <Text variant="meta">{count.text}</Text> : null}
        {count.kind === "loading" ? (
          <View testID={`${testID}-count-wait`} style={styles.wait}>
            <SkeletonGroup>
              <Skeleton width={56} height={12} />
            </SkeletonGroup>
          </View>
        ) : null}
      </View>
    </PressableRow>
  );
}

/**
 * Akun's three shortcut tiles (gap 8): Paket saya with its running plans, Alamat with the saved addresses, Riwayat
 * (the payments). A count is only drawn once it is read: while the read is out the line holds its place, and a failed
 * read leaves the label alone (the tile still opens). At large text on a narrow phone the tiles stack in one column.
 */
export function AkunTiles({
  plans,
  addresses,
  loading,
}: {
  /** Running plans and saved addresses, or null while unknown (the read is out or failed). */
  plans: number | null;
  addresses: number | null;
  loading: boolean;
}) {
  const { t } = useMobile();
  const stacked = useStackedLayout(TILES_STACK_BELOW);
  const styles = useStyles();
  const counted = (n: number | null, said: (n: number) => string): Count =>
    n === null ? (loading ? { kind: "loading" } : { kind: "none" }) : { kind: "text", text: n === 0 ? t("Tidak ada", "None") : said(n) };
  return (
    <View testID="akun-tiles" style={[styles.row, { flexDirection: stacked ? "column" : "row" }]}>
      <Tile
        testID="akun-tile-paket"
        glyph="restaurant-outline"
        label={t("Paket saya", "My plans")}
        count={counted(plans, (n) => t(`${n} aktif`, `${n} active`))}
        href="/paket-saya"
        stacked={stacked}
      />
      <Tile
        testID="akun-tile-alamat"
        glyph="location-outline"
        label={t("Alamat", "Addresses")}
        count={counted(addresses, (n) => t(`${n} tersimpan`, `${n} saved`))}
        href="/alamat"
        stacked={stacked}
      />
      <Tile
        testID="akun-tile-riwayat"
        glyph="receipt-outline"
        label={t("Riwayat", "History")}
        count={{ kind: "text", text: t("Pembayaran", "Payments") }}
        href="/pembayaran"
        stacked={stacked}
      />
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  row: { columnGap: nativeLayout.groupGap, rowGap: nativeLayout.groupGap },
  tile: {
    minHeight: TILE_MIN_HEIGHT,
    padding: TILE_PADDING - cardEdgeWidth(c),
    borderRadius: nativeLayout.radius.card,
    borderCurve: "continuous",
    backgroundColor: c.surface,
    ...cardEdge(c),
  },
  // Three columns share the row equally; the glyph sits over the words, which sit at the tile's foot.
  tileColumn: { flex: 1, flexBasis: 0, justifyContent: "space-between", gap: nativeLayout.space.sm },
  // One column: the glyph beside the words, a 72 row (a tile of three columns is 96 tall for its glyph over its words).
  tileStacked: { flexDirection: "row", alignItems: "center", gap: nativeLayout.space.md, minHeight: nativeLayout.row.media },
  words: { flexShrink: 1, minWidth: 0 },
  wait: { height: TILE_COUNT_LINE, justifyContent: "center" },
}));
