import { View, type DimensionValue } from "react-native";
import { useMobile } from "@catera/mobile-core";
import { Card, CHECK_ROW_INSET, COMPACT_MEDIA_INSET, ListCard, Skeleton, SkeletonGroup, trackLabelLines, useScreenMargin, useTouchTarget } from "@catera/mobile-ui";
import { nativeLayout } from "@catera/design-tokens";
import { useActionPairStacked } from "./layout/useActionPairStacked";
import { CHECK_HEIGHT, FIGURE_GAP, FIGURE_TOP, HEADING_GAP, HEADING_LINE, PACKAGE_HEIGHT, SECTION_GAP } from "./today/rows";

/**
 * Dapur's loading shapes (Phase F task 6). Each one is drawn in the place and roughly the size of what it stands for, so
 * the loaded content replaces it as one block (the screen's `FadeSwap`) without the page jumping. Every block has a fixed
 * height and none draws text: at a larger font scale the loaded layout grows and the skeleton stays at its 1.0 size, so
 * it can be shorter than what replaces it but never taller. The group names the wait for screen readers ("Memuat
 * dapur"); under reduced motion its blocks hold still (`SkeletonGroup`).
 */

/** One text line as a block: the line's own height with the block centred in it, like the glyphs it stands for. */
function Line({ width, block, line, onMood, testID }: { width: DimensionValue; block: number; line: number; onMood?: boolean; testID?: string }) {
  return (
    <View style={{ height: line, justifyContent: "center" }}>
      <Skeleton width={width} height={block} radius={block / 2} onMood={onMood} testID={testID} />
    </View>
  );
}

/** The rantang track's four stop labels (Terjadwal, Dimasak, Diantar, Sampai) and the count under each: centred caption blocks. */
const STOPS = [0, 1, 2, 3] as const;

/**
 * The header's figures while the day loads: the porsi, paket and alamat strip (label and value lines, then the "Antar" subline's room, in the
 * strip's own 12 16 padding) and the compact rantang track (its 40 rail and the stop labels and
 * counts, 8dp apart), 12dp apart under the date like the loaded pair. The track block is as tall as `RantangTrack
 * size="compact"` and the strip as tall as `FigureStrip`, so the header keeps its height when the figures replace it. The
 * blocks take the mood's toggle track, which stands off the header fill in Siang and Malam, light and dark (the strip's
 * surface is not drawn: in light Malam it is nearly the header's colour). The body's `TodaySkeleton` names the wait, so
 * this one is hidden from screen readers.
 */
export function TodayCountSkeleton() {
  // The stop labels take two lines' room in a language where one wraps (English "On the way"), so the block does too.
  const labelLines = trackLabelLines(useMobile().t);
  return (
    <View
      testID="today-count-skeleton"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ gap: FIGURE_GAP, marginTop: FIGURE_TOP }}
    >
      <SkeletonGroup label="">
        <View style={{ gap: FIGURE_GAP }}>
          {/* The strip: three cells (the 13 label line over the 40 figure), then the room of the "Antar" subline (6 and an
              18 line), inside 12 16. Most kitchens have a window, so the header does not grow when the figures land. */}
          <View testID="today-count-strip" style={{ gap: 6, paddingVertical: 12, paddingHorizontal: 16 }}>
            <View style={{ flexDirection: "row", gap: 16 }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ flex: 1 }}>
                  <Line width={i ? 40 : 32} block={10} line={18} onMood testID={`today-count-block-label-${i}`} />
                  {/* The 32/40 lead figure, then the 20/26 siblings in the same 40 line. */}
                  <Line width={i ? 32 : 56} block={i ? 20 : 32} line={40} onMood testID={i ? `today-count-block-value-${i}` : "today-count-block-number"} />
                </View>
              ))}
            </View>
            <Line width={96} block={10} line={18} onMood testID="today-count-block-subline" />
          </View>
          <View testID="today-count-track" style={{ gap: 8 }}>
            {/* The track's rail (stops and line) as one bar through the middle of its 40. */}
            <View testID="today-count-rail" style={{ height: 40, justifyContent: "center" }}>
              <Skeleton height={8} radius={4} onMood testID="today-count-block-track" />
            </View>
            <View style={{ flexDirection: "row" }}>
              {STOPS.map((i) => (
                <View key={i} style={{ flex: 1, alignItems: "center" }}>
                  <Line width={44} block={10} line={18 * labelLines} onMood testID={`today-count-block-stop-${i}`} />
                  <Line width={16} block={10} line={18} onMood testID={`today-count-block-count-${i}`} />
                </View>
              ))}
            </View>
          </View>
        </View>
      </SkeletonGroup>
    </View>
  );
}

/**
 * Hari ini's sections while the day loads: "Daftar masak" with four checklist rows at CheckRow's 56dp (the 48 quantity
 * column, the 40 dish photo, the name and the 48 round tick) and "Per paket" with two package rows at KeyValueRow's 40,
 * each heading 26 tall with 12 under it, 24 between the sections, built from the loaded layout's own constants.
 */
export function TodaySkeleton() {
  const { t } = useMobile();
  return (
    <SkeletonGroup label={t("Memuat dapur", "Loading the kitchen")}>
      <View style={{ gap: SECTION_GAP }}>
        <View>
          <Line width={120} block={14} line={HEADING_LINE} />
          <View style={{ height: HEADING_GAP }} />
          <ListCard inset={CHECK_ROW_INSET}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                testID={`today-skeleton-row-${i}`}
                style={{ height: CHECK_HEIGHT, flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <View style={{ width: 48, alignItems: "flex-end" }}>
                  <Skeleton width={28} height={16} radius={8} />
                </View>
                <Skeleton width={40} height={40} radius={8} />
                <View style={{ flex: 1 }}>
                  <Skeleton width={i % 2 ? "55%" : "70%"} height={14} radius={7} />
                </View>
                <Skeleton width={48} height={48} radius={24} />
              </View>
            ))}
          </ListCard>
        </View>
        <View>
          <Line width={88} block={14} line={HEADING_LINE} />
          <View style={{ height: HEADING_GAP }} />
          <ListCard inset={0}>
            {[0, 1].map((i) => (
              <View
                key={i}
                testID={`today-skeleton-package-${i}`}
                style={{ height: PACKAGE_HEIGHT, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
              >
                <Skeleton width={i ? "40%" : "55%"} height={14} radius={7} />
                <Skeleton width={48} height={14} radius={7} />
              </View>
            ))}
          </ListCard>
        </View>
      </View>
    </SkeletonGroup>
  );
}

/**
 * Menu's day strip while the packages load, in the header: one row of day blocks at the day tiles' height (56) and
 * radius (12), sharing the row evenly as the tiles do, on the mood surface. The days a package delivers are not known
 * yet, so the row shows a working week (five). Hidden from screen readers: the day card names the wait.
 */
export function MenuStripSkeleton({ days = 5, height, gap }: { days?: number; height: number; gap: number }) {
  return (
    <View
      testID="menu-strip-skeleton"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <SkeletonGroup label="">
        <View style={{ flexDirection: "row", gap }}>
          {Array.from({ length: days }, (_, i) => (
            <View key={i} style={{ flex: 1 }}>
              <Skeleton height={height} radius={12} onMood testID={`menu-strip-skeleton-day-${i}`} />
            </View>
          ))}
        </View>
      </SkeletonGroup>
    </View>
  );
}

/**
 * Menu's controls while the packages load, from the loaded controls' constants: a 34 package chip centred in its 48
 * frame, then the 50 pill buttons (radius 25) side by side, or stacked where the loaded pair stacks, Salin minggu lalu only for the owner (the one who can copy), Bagikan menu
 * for both. Hidden from screen readers: the day card names the wait.
 */
export function MenuControlsSkeleton({ owner = false }: { owner?: boolean }) {
  const stacked = useActionPairStacked() && owner;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <SkeletonGroup label="">
        <View style={{ gap: 12 }}>
          <View style={{ height: 48, justifyContent: "center" }}>
            <Skeleton width={168} height={34} radius={17} testID="menu-skeleton-chip" />
          </View>
          <View style={{ flexDirection: stacked ? "column" : "row", gap: 8 }}>
            {owner ? (
              <View style={stacked ? undefined : { flex: 1 }}>
                <Skeleton height={50} radius={25} testID="menu-skeleton-copy" />
              </View>
            ) : null}
            <View style={stacked ? undefined : { flex: 1 }}>
              <Skeleton height={50} radius={25} testID="menu-skeleton-share" />
            </View>
          </View>
        </View>
      </SkeletonGroup>
    </View>
  );
}

/**
 * Menu's day while its week reads ("Memuat menu"): the section header's 26 line, 12 above a group's meta line and a list
 * card of three 64 rows with 48 thumbs, as the loaded day draws them. It sits in its own block below the controls from
 * the first frame, so it waits through the packages' read and the week's in the same place and enters once.
 */
export function MenuWeekSkeleton() {
  const { t } = useMobile();
  return (
    <SkeletonGroup label={t("Memuat menu", "Loading the menu")}>
      <View testID="menu-skeleton-day">
        <View style={{ marginBottom: 12 }}>
          <Line width={132} block={18} line={26} />
        </View>
        <View style={{ gap: 8 }}>
          <Line width={56} block={12} line={18} />
          <ListCard inset={COMPACT_MEDIA_INSET}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Skeleton width={48} height={48} radius={8} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Skeleton width={i === 1 ? "45%" : "60%"} height={14} radius={7} />
                  <Skeleton width="25%" height={10} radius={5} />
                </View>
              </View>
            ))}
          </ListCard>
        </View>
      </View>
    </SkeletonGroup>
  );
}

/**
 * A list of records while it loads, one card per row with a name and two caption lines (a step list). `bare` draws the
 * rows without their own cards, for rows that sit inside a card already (Usaha's packages: a 40dp photo, the name and
 * its price line, at the row's 56dp). `shape="customer"` is Pelanggan's list as it is laid out: the filter chips (34,
 * in a frame as tall as the touch target, 48 in Dapur, running to the screen edge) over one `ListCard` of two-line
 * rows at the loaded row's 64 (a name line, a meta line, the 48 button's place at the right). Every other caller keeps
 * the card-per-row shape. `gap` is the space between the default shape's cards (16; Aktifkan's steps sit 24 apart).
 */
export function ListSkeleton({
  rows,
  label,
  bare = false,
  chips = 0,
  shape = "default",
  gap = 16,
}: {
  rows: number;
  label: string;
  bare?: boolean;
  /** A row of filter chips over the rows (Pelanggan's Aktif, Segera berakhir, Selesai). */
  chips?: number;
  shape?: "default" | "customer";
  gap?: number;
}) {
  const shapes = Array.from({ length: rows }, (_, i) => i);
  const frame = useTouchTarget();
  const margin = useScreenMargin();
  if (shape === "customer") {
    return (
      <SkeletonGroup label={label}>
        <View style={{ gap: 8 }}>
          {chips ? (
            <View
              testID="list-skeleton-chips"
              style={{ height: frame, flexDirection: "row", alignItems: "center", gap: 8, marginRight: -margin }}
            >
              {Array.from({ length: chips }, (_, i) => (
                <Skeleton
                  key={i}
                  width={i === 1 ? 148 : 108}
                  height={nativeLayout.control.chip}
                  radius={nativeLayout.control.chip / 2}
                  testID={`list-skeleton-chip-${i}`}
                />
              ))}
            </View>
          ) : null}
          <ListCard inset={0}>
            {shapes.map((i) => (
              <View
                key={i}
                testID={`list-skeleton-row-${i}`}
                style={{ height: nativeLayout.row.compact, flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <View style={{ flex: 1 }}>
                  {/* rowTitle's 22 line and meta's 18 line, centred in the 64 row as the loaded text is. */}
                  <Line width={i % 2 ? "45%" : "60%"} block={12} line={22} />
                  <Line width={i % 2 ? "70%" : "80%"} block={10} line={18} />
                </View>
                <Skeleton width={24} height={24} radius={12} />
              </View>
            ))}
          </ListCard>
        </View>
      </SkeletonGroup>
    );
  }
  return (
    <SkeletonGroup label={label}>
      <View style={{ gap: bare ? 0 : gap }}>
        {chips ? (
          <View testID="list-skeleton-chips" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {Array.from({ length: chips }, (_, i) => (
              <Skeleton key={i} width={i === 1 ? 148 : 108} height={48} radius={9} testID={`list-skeleton-chip-${i}`} />
            ))}
          </View>
        ) : null}
        {shapes.map((i) =>
          bare ? (
            <View key={i} testID={`list-skeleton-row-${i}`} style={{ height: 56, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Skeleton width={40} height={40} radius={8} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width={i % 2 ? "50%" : "65%"} height={12} radius={6} />
                <Skeleton width="35%" height={10} radius={5} />
              </View>
            </View>
          ) : (
            <Card key={i}>
              <View testID={`list-skeleton-row-${i}`} style={{ gap: 8 }}>
                <Skeleton width={i % 2 ? "45%" : "60%"} height={14} radius={7} />
                <Skeleton width="50%" height={10} radius={5} />
                <Skeleton width="30%" height={10} radius={5} />
              </View>
            </Card>
          ),
        )}
      </View>
    </SkeletonGroup>
  );
}

/**
 * One record's page while it loads (a report, a day's menu, a package): a heading, three text lines and the row its
 * main action takes. `shape="customer"` is the customer's detail as it is laid out: a meta status line, one
 * `ListCard` of five 40 key-value rows, the 50 action row and the 56 address well (24 below the actions, the section gap).
 */
export function DetailSkeleton({ label, shape = "default" }: { label: string; shape?: "default" | "customer" | "package" }) {
  if (shape === "package") {
    // A package's page: the 16:10 photo, two description lines, one card of three 40 key-value rows and the 50 action,
    // 24 apart (the loaded page's section gap). The photo block is drawn always: until the read answers, nothing (not the
    // link, which carries only the id and the name) says whether this package has a photo, so the skeleton is shaped for
    // the usual page and a package without one settles up by a photo's height.
    return (
      <SkeletonGroup label={label}>
        <View style={{ gap: nativeLayout.dense.sectionGap }}>
          <View style={{ gap: nativeLayout.space.lg }}>
            <View testID="detail-skeleton-photo" style={{ aspectRatio: nativeLayout.ratio.card }}>
              <Skeleton aspectRatio={nativeLayout.ratio.card} radius={nativeLayout.radius.card} />
            </View>
            <View>
              <Line width="95%" block={12} line={22} />
              <Line width="70%" block={12} line={22} />
            </View>
          </View>
          <ListCard inset={0}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                testID={`detail-skeleton-kv-${i}`}
                style={{ height: nativeLayout.row.keyValue, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}
              >
                <Skeleton width={i % 2 ? 56 : 72} height={12} radius={6} />
                <Skeleton width={i === 0 ? 144 : 96} height={12} radius={6} />
              </View>
            ))}
          </ListCard>
          <View testID="detail-skeleton-actions" style={{ height: nativeLayout.control.button }}>
            <Skeleton height={nativeLayout.control.button} radius={nativeLayout.radius.control} />
          </View>
        </View>
      </SkeletonGroup>
    );
  }
  if (shape === "customer") {
    return (
      <SkeletonGroup label={label}>
        <View style={{ gap: 16 }}>
          <Line width="55%" block={10} line={18} />
          <ListCard inset={0}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View
                key={i}
                testID={`detail-skeleton-kv-${i}`}
                style={{ height: nativeLayout.row.keyValue, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}
              >
                <Skeleton width={i % 2 ? 56 : 72} height={12} radius={6} />
                <Skeleton width={i === 0 ? 144 : 96} height={12} radius={6} />
              </View>
            ))}
          </ListCard>
          <View testID="detail-skeleton-actions" style={{ height: nativeLayout.control.button }}>
            <Skeleton height={nativeLayout.control.button} radius={nativeLayout.radius.control} />
          </View>
          <View testID="detail-skeleton-address" style={{ height: 56, marginTop: nativeLayout.dense.sectionGap - 16 }}>
            <Skeleton height={56} radius={nativeLayout.radius.control} />
          </View>
        </View>
      </SkeletonGroup>
    );
  }
  return (
    <SkeletonGroup label={label}>
      <Card>
        <Line width="60%" block={18} line={28} />
        <Line width="90%" block={12} line={23} />
        <Line width="75%" block={12} line={23} />
        <Line width="40%" block={10} line={18} />
        <Skeleton height={48} radius={12} />
      </Card>
    </SkeletonGroup>
  );
}

/**
 * Uang while it loads, as the loaded page is laid out: the lead (a meta line, the figure's 40 line, a meta caption), the
 * seven money rows in one card at the key-value row's 40, and the seven explanations as meta lines, 24 between them.
 */
export function UangSkeleton() {
  const { t } = useMobile();
  return (
    <SkeletonGroup label={t("Memuat uang", "Loading money")}>
      <View testID="uang-skeleton-sections" style={{ gap: nativeLayout.dense.sectionGap }}>
        <View testID="uang-skeleton-lead" style={{ gap: nativeLayout.space.xs }}>
          <Line width={180} block={10} line={18} />
          <Line width={200} block={28} line={nativeLayout.figure.leadLine} />
          <Line width={160} block={10} line={18} />
        </View>
        <ListCard inset={0}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <View
              key={i}
              testID={`uang-skeleton-row-${i}`}
              style={{ height: nativeLayout.row.keyValue, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}
            >
              <Skeleton width={i % 2 ? "35%" : "45%"} height={12} radius={6} />
              <Skeleton width={96} height={12} radius={6} />
            </View>
          ))}
        </ListCard>
        <View testID="uang-skeleton-hints" style={{ gap: nativeLayout.groupGap }}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <View key={i} testID={`uang-skeleton-hint-${i}`}>
              <Line width={i % 2 ? "70%" : "85%"} block={10} line={18} />
            </View>
          ))}
        </View>
      </View>
    </SkeletonGroup>
  );
}
