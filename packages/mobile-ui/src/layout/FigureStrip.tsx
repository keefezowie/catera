import { Fragment } from "react";
import { useWindowDimensions, View, type StyleProp, type ViewStyle } from "react-native";
import { nativeLayout } from "@catera/design-tokens";
import { Text } from "../components";
import { isNarrow } from "../stackedLayout";
import { themedStyles } from "../theme";
import { fontFor } from "../type";

/** Below this effective width (`width / fontScale`) the strip's cells no longer share one row. */
export const FIGURE_STRIP_NARROW = 340;
/** The subline sits this far under the cells (board HariIni-Masak: the 106 strip). */
const SUBLINE_GAP = 6;

export type FigureCell = { label: string; value: string };

/**
 * A few headline figures in one container (Hari ini's porsi, paket, alamat): a surface card, radius 16, padding 12 16,
 * split into equal cells by 1px hairlines, each a `meta` label over its value. With `lead` the first value is the
 * screen's answer in `figure` (32/40) and the others are `section` at 800; without it every value is `section` at 800.
 * All figures are tabular. `subline` is one `meta` line under the cells ("Antar 10.30"). In dark, where the palette
 * draws no card border and the surface is one step from the band, the strip gets a 1px `line` edge (padding compensated).
 *
 * Below 340 effective width (360dp at font scale 1.3 is 277) the cells become a 2-column grid: the lead takes the
 * full width and the rest pair up beside each other; an odd last cell takes the full width.
 */
export function FigureStrip({
  cells,
  lead = false,
  subline,
  testID,
}: {
  cells: FigureCell[];
  lead?: boolean;
  subline?: string;
  testID?: string;
}) {
  const styles = useStyles();
  const narrow = isNarrow(useWindowDimensions(), FIGURE_STRIP_NARROW);
  const id = (part: string) => (testID ? `${testID}-${part}` : undefined);

  const cell = (index: number, style: StyleProp<ViewStyle>) => {
    const { label, value } = cells[index];
    const isLead = lead && index === 0;
    return (
      <View testID={id(`cell-${index}`)} accessible accessibilityLabel={`${value} ${label}`} style={[styles.cell, style]}>
        <Text variant="meta">{label}</Text>
        {isLead ? (
          <Text variant="figure" selectable>
            {value}
          </Text>
        ) : (
          <Text variant="section" accessibilityRole="text" selectable style={styles.sibling}>
            {value}
          </Text>
        )}
      </View>
    );
  };
  const across = <View testID={id("hairline")} style={styles.across} />;
  const between = <View testID={id("hairline")} style={styles.between} />;

  let body;
  if (!narrow) {
    body = (
      <View style={styles.line}>
        {cells.map((_, i) => (
          <Fragment key={i}>
            {i > 0 ? between : null}
            {cell(i, styles.share)}
          </Fragment>
        ))}
      </View>
    );
  } else {
    // The lead alone on the first line, then the rest two to a line.
    const lines: number[][] = lead && cells.length > 0 ? [[0]] : [];
    for (let i = lines.length; i < cells.length; i += 2) lines.push(i + 1 < cells.length ? [i, i + 1] : [i]);
    body = (
      <View testID={id("grid")}>
        {lines.map((line, n) => (
          <Fragment key={n}>
            {n > 0 ? across : null}
            <View style={styles.line}>
              {line.length === 1 ? (
                cell(line[0], styles.full)
              ) : (
                <>
                  {cell(line[0], styles.share)}
                  {between}
                  {cell(line[1], styles.share)}
                </>
              )}
            </View>
          </Fragment>
        ))}
      </View>
    );
  }

  return (
    <View testID={testID} style={styles.strip}>
      {body}
      {subline ? (
        <Text variant="meta" style={styles.subline}>
          {subline}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  strip: {
    backgroundColor: c.surface,
    borderRadius: nativeLayout.radius.card,
    borderCurve: "continuous",
    // Dark draws no card border and the strip's surface is one step from the band it sits on: a 1px `line` edge, its
    // pixel taken off the padding so the cells still sit 12 / 16 in.
    ...(c.cardBorder === ""
      ? {
          borderWidth: 1,
          borderColor: c.line,
          paddingVertical: nativeLayout.space.md - 1,
          paddingHorizontal: nativeLayout.cardPadding - 1,
        }
      : { paddingVertical: nativeLayout.space.md, paddingHorizontal: nativeLayout.cardPadding }),
  },
  line: { flexDirection: "row" },
  cell: { minWidth: 0, justifyContent: "space-between" },
  share: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  full: { width: "100%" },
  sibling: { fontFamily: fontFor("800"), fontVariant: ["tabular-nums"] },
  between: { width: 1, alignSelf: "stretch", marginHorizontal: nativeLayout.space.md, backgroundColor: c.line },
  across: { height: 1, marginVertical: nativeLayout.space.md, backgroundColor: c.line },
  subline: { marginTop: SUBLINE_GAP },
}));
