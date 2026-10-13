import { View, type DimensionValue } from "react-native";
import { useMobile } from "@catera/mobile-core";
import { Card, Skeleton, SkeletonGroup } from "@catera/mobile-ui";

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
 * The count card's numbers on the mood surface, for Hari ini's header while the day loads: the portion figure, its
 * caption and the rantang track (its caption, the rail and the stop labels), at the card's padding. The track block is
 * as tall as `RantangTrack` (caption line, rail, stop label and count lines, 8dp apart), so the header keeps its height when the card
 * replaces it. The blocks take the mood's toggle track, which stands off the header fill in Siang and Malam, light and
 * dark (the hero fill is not drawn: in light Malam it is the same colour as the track). The body's `TodaySkeleton`
 * names the wait, so this one is hidden from screen readers.
 */
export function TodayCountSkeleton() {
  return (
    <View
      testID="today-count-skeleton"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ gap: 16, padding: 16 }}
    >
      <SkeletonGroup label="">
        <View style={{ gap: 16 }}>
          <View style={{ gap: 4 }}>
            {/* The 40pt tabular figure, then "porsi siang · n alamat". */}
            <Line width={72} block={36} line={48} onMood testID="today-count-block-number" />
            <Line width={160} block={10} line={18} onMood testID="today-count-block-caption" />
          </View>
          <View testID="today-count-track" style={{ gap: 8 }}>
            <Line width={140} block={12} line={23} onMood testID="today-count-block-track-caption" />
            {/* The track's rail (marker, line and stops) as one bar along its foot. */}
            <View style={{ height: 64, justifyContent: "flex-end", paddingBottom: 14 }}>
              <Skeleton height={8} radius={4} onMood testID="today-count-block-track" />
            </View>
            <View style={{ flexDirection: "row" }}>
              {STOPS.map((i) => (
                <View key={i} style={{ flex: 1, alignItems: "center" }}>
                  <Line width={44} block={10} line={18} onMood testID={`today-count-block-stop-${i}`} />
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
 * Hari ini's session card while the day loads: its meal label, "Daftar masak" and four checklist rows at CheckRow's
 * 56dp, each a dish photo, the dish name and the round tick.
 */
export function TodaySkeleton() {
  const { t } = useMobile();
  return (
    <SkeletonGroup label={t("Memuat dapur", "Loading the kitchen")}>
      <Card>
        <Line width={96} block={12} line={23} />
        <Line width={120} block={12} line={23} />
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            testID={`today-skeleton-row-${i}`}
            style={{ height: 56, flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <Skeleton width={44} height={44} radius={10} />
            <View style={{ flex: 1 }}>
              <Skeleton width={i % 2 ? "55%" : "70%"} height={14} radius={7} />
            </View>
            <Skeleton width={48} height={48} radius={24} />
          </View>
        ))}
      </Card>
    </SkeletonGroup>
  );
}

/**
 * Menu's day strip while the packages load, in the header: one row of day blocks at the day buttons' height, sharing
 * the row evenly as the buttons do, on the mood surface. The days a package delivers are not known yet, so the row
 * shows a working week (five). Hidden from screen readers: the day card names the wait.
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
              <Skeleton height={height} radius={16} onMood testID={`menu-strip-skeleton-day-${i}`} />
            </View>
          ))}
        </View>
      </SkeletonGroup>
    </View>
  );
}

/**
 * Menu's controls while the packages load: the package chip and the buttons under the header, Salin minggu lalu only
 * for the owner (the one who can copy), Bagikan menu for both. Hidden from screen readers: the day card names the wait.
 */
export function MenuControlsSkeleton({ owner = false }: { owner?: boolean }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <SkeletonGroup label="">
        <View style={{ gap: 16 }}>
          <Skeleton width={168} height={40} radius={20} testID="menu-skeleton-chip" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            {owner ? (
              <View style={{ flex: 1 }}>
                <Skeleton height={48} radius={12} testID="menu-skeleton-copy" />
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Skeleton height={48} radius={12} testID="menu-skeleton-share" />
            </View>
          </View>
        </View>
      </SkeletonGroup>
    </View>
  );
}

/**
 * Menu's day card while its week reads ("Memuat menu"). It sits in its own block below the controls from the first
 * frame, so it waits through the packages' read and the week's in the same place and enters once.
 */
export function MenuWeekSkeleton() {
  const { t } = useMobile();
  return (
    <SkeletonGroup label={t("Memuat menu", "Loading the menu")}>
      <View testID="menu-skeleton-day">
        <Card>
          <Line width={132} block={18} line={28} />
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ height: 48, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Skeleton width={48} height={48} radius={12} />
              <Skeleton width={i === 1 ? "45%" : "60%"} height={14} radius={7} />
            </View>
          ))}
        </Card>
      </View>
    </SkeletonGroup>
  );
}

/**
 * A list of records while it loads, one card per row with a name and two caption lines (Pelanggan's customers, a
 * step list). `bare` draws the rows without their own cards, for rows that sit inside a card already (Usaha's packages:
 * a 40dp photo, the name and its price line, at the row's 56dp).
 */
export function ListSkeleton({ rows, label, bare = false }: { rows: number; label: string; bare?: boolean }) {
  const shapes = Array.from({ length: rows }, (_, i) => i);
  return (
    <SkeletonGroup label={label}>
      <View style={{ gap: bare ? 0 : 16 }}>
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
 * One record's page while it loads (a customer, a report, a day's menu, a package): a heading, three text lines and
 * the row its main action takes.
 */
export function DetailSkeleton({ label }: { label: string }) {
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

/** Uang while it loads: the next payout's figure on its card, then the seven money states as rows. */
export function UangSkeleton() {
  const { t } = useMobile();
  return (
    <SkeletonGroup label={t("Memuat uang", "Loading money")}>
      <View style={{ gap: 16 }}>
        <Card>
          <Line width={180} block={12} line={23} />
          <Line width={150} block={36} line={48} />
          <Line width={160} block={10} line={18} />
        </Card>
        <Card>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <View key={i} style={{ paddingVertical: 10, gap: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <Skeleton width="40%" height={12} radius={6} />
                <Skeleton width={72} height={12} radius={6} />
              </View>
              <Skeleton width="60%" height={10} radius={5} />
            </View>
          ))}
        </Card>
      </View>
    </SkeletonGroup>
  );
}
