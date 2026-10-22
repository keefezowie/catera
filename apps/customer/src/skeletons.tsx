import type { ReactNode, Ref } from "react";
import { useWindowDimensions, View, type DimensionValue, type ViewStyle } from "react-native";
import type { Locale } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { nativeLayout } from "@catera/design-tokens";
import { MoodFill, sheetSidePadding, Skeleton, SkeletonGroup, useColors } from "@catera/mobile-ui";
import {
  ACTION_CIRCLE,
  DAY_ACTION_GAP,
  DAY_ACTIONS_PAD,
  DAY_GAP,
  DAY_HERO_LINE,
  DAY_MEAL_GAP,
  DAY_META_LINE,
  DAY_PHOTO_RADIUS,
  DAY_PHOTO_RATIO,
  DAY_WELL_MIN,
  DAY_WELL_RADIUS,
} from "./schedule/dayMetrics";
import { DAY_CIRCLE, MonthFrame } from "./schedule/MonthGrid";
import { ChipRowFrame } from "./discover/ChipRow";
import { MealSegment } from "./discover/MealSegment";
import { PackageGrid, useGridCell } from "./discover/PackageGrid";
import { planPhotoFrame } from "./plan/heroFrame";
import { HERO_BAND_RISE } from "./today/heroBand";
import { TILE_MIN_HEIGHT } from "./account/AkunTiles";
import { BREAKDOWN_PAD, BREAKDOWN_ROW, BREAKDOWN_SKELETON_ROWS, FIELDS_HEIGHT, SUMMARY_HEIGHT } from "./buy/metrics";
import { SECTION_LEAD } from "./today/sectionGap";
import { HERO_RADIUS as BERANDA_HERO_RADIUS, heroPhotoFrame } from "./today/Plate";
import { STATUS_HALO, STATUS_LABEL_LINE, STATUS_META_LINE, STATUS_ROW } from "./today/StatusStops";

/**
 * One skeleton per screen (spec 2.1, 2.2): the data area's shape while its first read is out and nothing is kept on this
 * phone, at the loaded layout's heights at 360dp and font scale 1.0 (at a larger font the loaded page grows past it; the
 * skeleton is never taller). Each is one `SkeletonGroup`, so the blocks pulse together, hold still under reduced
 * motion, and a screen reader meets one progress bar named "Memuat {what}". Chrome (native header, mood header, tab
 * bar) is never part of a skeleton: it renders at once.
 */

/**
 * The Beranda hero card while it loads, in the loaded hero's own frame: the 16 radius card with its mood fill and shadow
 * (Siang, with Malam fading over it), the photo at 4:3 inside the 1.5 edge, and the body's 16 padding and 12 gap. The
 * blocks read the hero's track (`onHero`), so they show on that fill in both themes and both moods.
 */
function BerandaHeroFrame({ children }: { children: ReactNode }) {
  return (
    <View testID="beranda-skeleton-hero" style={{ borderRadius: BERANDA_HERO_RADIUS, borderCurve: "continuous" }}>
      <MoodFill surface="hero" testID="beranda-skeleton-hero-fill" radius={BERANDA_HERO_RADIUS} heroShadow />
      {children}
    </View>
  );
}

/** One stop of the status line: the dot's halo box beside the label line over the state line, at the loaded heights. */
function StopPlaceholder() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: nativeLayout.space.sm, width: "36%" }}>
      <View style={{ width: STATUS_HALO, height: STATUS_HALO, alignItems: "center", justifyContent: "center" }}>
        <Skeleton onHero width={12} height={12} radius={6} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ height: STATUS_LABEL_LINE, justifyContent: "center" }}>
          <Skeleton onHero width="86%" height={14} />
        </View>
        <View style={{ height: STATUS_META_LINE, justifyContent: "center" }}>
          <Skeleton onHero width="60%" height={12} />
        </View>
      </View>
    </View>
  );
}

/**
 * Beranda's data area: the hero card (photo, meal line, dish line, the two-stop status line and the detail line) and two
 * Berikutnya rows. Like the loaded hero it rides up over the mood band by `HERO_BAND_RISE` (the band leaves its 104
 * for it), so the skeleton hero sits exactly where the loaded one lands and the swap does not jump. The hero is the
 * loaded hero's card, fill and shadow included, so only its contents change when the page arrives.
 */
export function BerandaSkeleton() {
  const { t } = useMobile();
  return (
    <SkeletonGroup label={t("Memuat beranda", "Loading home")}>
      <View testID="beranda-skeleton" style={{ gap: 16, marginTop: HERO_BAND_RISE }}>
        <BerandaHeroFrame>
          <View testID="beranda-skeleton-photo" style={heroPhotoFrame}>
            <Skeleton onHero aspectRatio={nativeLayout.ratio.hero} radius={0} />
          </View>
          <View testID="beranda-skeleton-body" style={{ padding: nativeLayout.cardPadding, gap: nativeLayout.space.md }}>
            {/* The meal line and the dish are one group, 2 apart, as in the loaded hero. */}
            <View style={{ gap: 2 }}>
              <View style={{ height: 18, justifyContent: "center" }}>
                <Skeleton onHero width="46%" height={12} />
              </View>
              <View style={{ height: 30, justifyContent: "center" }}>
                <Skeleton onHero width="72%" height={22} />
              </View>
            </View>
            <View
              testID="beranda-skeleton-stops"
              style={{ height: STATUS_ROW, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
            >
              <StopPlaceholder />
              <StopPlaceholder />
            </View>
            <View style={{ height: 18, justifyContent: "center" }}>
              <Skeleton onHero width="52%" height={12} />
            </View>
          </View>
        </BerandaHeroFrame>
        {/* Below the hero: the live slot (a 72 row card) and Berikutnya (its heading line over a card of 72 rows), each
            leading by the 16 the page body's gap does not give, as the loaded blocks do. */}
        <ListCardFrame testID="beranda-skeleton-live" style={{ marginTop: SECTION_LEAD, minHeight: nativeLayout.row.media }}>
          <MediaPlaceholder glyph />
        </ListCardFrame>
        <View testID="beranda-skeleton-days" style={{ marginTop: SECTION_LEAD }}>
          <View testID="beranda-skeleton-days-heading" style={{ height: 26, marginBottom: nativeLayout.headingGap, justifyContent: "center" }}>
            <Skeleton width="38%" height={18} />
          </View>
          <ListCardFrame>
            <MediaPlaceholder />
            <MediaPlaceholder />
          </ListCardFrame>
        </View>
      </View>
    </SkeletonGroup>
  );
}

/** A surface card of skeleton rows, the shape of `ListCard` (rows are 72, so the page does not move when it lands). */
function ListCardFrame({ children, testID, style }: { children: ReactNode; testID?: string; style?: ViewStyle }) {
  const c = useColors();
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: c.surface,
          borderRadius: nativeLayout.radius.card,
          paddingHorizontal: nativeLayout.cardPadding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** A 72 row: a 56 thumb (or the live slot's 40 glyph circle) and two lines, the shape of `MediaRow` and the waiting rows. */
function MediaPlaceholder({ glyph = false, testID = "beranda-skeleton-row" }: { glyph?: boolean; testID?: string }) {
  return (
    <View
      testID={testID}
      style={{
        minHeight: nativeLayout.row.media,
        flexDirection: "row",
        alignItems: "center",
        gap: nativeLayout.space.md,
        paddingVertical: nativeLayout.space.sm,
      }}
    >
      {glyph ? (
        <Skeleton width={40} height={40} radius={20} />
      ) : (
        <View testID="beranda-skeleton-thumb" style={{ width: 56, height: 56, borderRadius: nativeLayout.radius.thumb, overflow: "hidden" }}>
          <Skeleton width={56} height={56} radius={nativeLayout.radius.thumb} />
        </View>
      )}
      <View style={{ flex: 1, gap: nativeLayout.space.sm }}>
        <Skeleton width="64%" height={16} />
        <Skeleton width="40%" height={12} />
      </View>
    </View>
  );
}

/**
 * "Perlu kamu urus" while it loads: a card of 72 rows, each a 40 glyph circle and two lines, the shape of the loaded
 * waiting rows.
 */
export function WaitingSkeleton({ rows = 3 }: { rows?: number }) {
  const { t } = useMobile();
  return (
    <SkeletonGroup label={t("Memuat daftar", "Loading list")}>
      <View testID="waiting-skeleton">
        <ListCardFrame>
          {Array.from({ length: rows }, (_, i) => (
            <MediaPlaceholder key={i} glyph testID="waiting-skeleton-row" />
          ))}
        </ListCardFrame>
      </View>
    </SkeletonGroup>
  );
}

/** One package tile while it loads: the 4:3 photo over the name, caterer and price lines. */
function TileSkeleton({ testID }: { testID: string }) {
  const cell = useGridCell();
  return (
    <View testID={testID} style={cell}>
      <Skeleton aspectRatio={nativeLayout.ratio.tile} radius={nativeLayout.radius.control} />
      <View style={{ paddingTop: nativeLayout.space.sm, gap: nativeLayout.space.sm }}>
        <Skeleton width="85%" height={16} />
        <Skeleton width="55%" height={12} />
        <Skeleton width="45%" height={16} />
        <Skeleton width="70%" height={12} />
      </View>
    </View>
  );
}

/** Skeleton tiles in a grid skeleton (Jelajah, Disimpan): four, the 2 by 2 that fills the first screen (at one column they stack). */
const GRID_SKELETON_TILES = 4;

/**
 * Jelajah's data area: the chip row (the live meal segment and two placeholder chips, 34 tall in a 44 row) and the tile grid, each tile a 4:3
 * photo over the name, caterer and price lines. It reads the loaded grid's own constants (the layout scale, the grid's
 * gaps and cell), so it is the shape of the loaded page.
 */
export function JelajahSkeleton() {
  const { t } = useMobile();
  const chip = nativeLayout.control.chip;
  return (
    <View testID="jelajah-skeleton" style={{ gap: 16 }}>
      {/* The meal segment is the real control (it is the mood, which needs no data), so it works from the first frame;
          only the chips that need the catalogue are placeholders. The row has the loaded row's frame and 44 height. */}
      <ChipRowFrame>
        <View
          testID="jelajah-skeleton-chips"
          style={{ flexDirection: "row", alignItems: "center", gap: nativeLayout.space.sm, height: nativeLayout.control.icon }}
        >
          <MealSegment />
          <SkeletonGroup>
            <Skeleton width={132} height={chip} radius={chip / 2} />
            <Skeleton width={112} height={chip} radius={chip / 2} />
          </SkeletonGroup>
        </View>
      </ChipRowFrame>
      <SkeletonGroup label={t("Memuat paket", "Loading packages")}>
        <PackageGrid testID="jelajah-skeleton-grid">
          {Array.from({ length: GRID_SKELETON_TILES }, (_, i) => (
            <TileSkeleton key={i} testID="jelajah-skeleton-tile" />
          ))}
        </PackageGrid>
      </SkeletonGroup>
    </View>
  );
}

/** Beranda with no running package: its three suggested packages (the 150 photo over the name and the price line). */
export function OffersSkeleton() {
  const { t } = useMobile();
  const c = useColors();
  return (
    <SkeletonGroup label={t("Memuat paket", "Loading packages")}>
      <View testID="offers-skeleton" style={{ gap: 16 }}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              borderRadius: 16,
              borderCurve: "continuous",
              overflow: "hidden",
              borderWidth: 1,
              borderColor: c.line,
              backgroundColor: c.surface,
            }}
          >
            <Skeleton height={150} radius={0} />
            <View style={{ padding: 14, gap: 8 }}>
              <Skeleton width="66%" height={20} />
              <Skeleton width="52%" height={12} />
            </View>
          </View>
        ))}
      </View>
    </SkeletonGroup>
  );
}

/** Disimpan: the first four tiles of the saved grid, the loaded list's own two column grid (4:3 photo, name, caterer, price). */
export function SavedSkeleton() {
  const { t } = useMobile();
  return (
    <SkeletonGroup label={t("Memuat paket tersimpan", "Loading saved packages")}>
      <View testID="saved-skeleton" style={{ gap: 16 }}>
        <PackageGrid testID="saved-skeleton-grid">
          {Array.from({ length: GRID_SKELETON_TILES }, (_, i) => (
            <TileSkeleton key={i} testID="saved-skeleton-tile" />
          ))}
        </PackageGrid>
      </View>
    </SkeletonGroup>
  );
}

/**
 * A plan's detail (Paket): the hero card (Beranda's card and fill with the 16:10 photo inside its edge, then the body's
 * 16 padding: the meal line, the heading line and the dates line) and, 32 below, the "Berikutnya" heading's 26 line over
 * one card of three 72 rows with 56 thumbs. The heading and the rows sit on the canvas and read the theme; the hero's
 * blocks read its track.
 */
export function PlanSkeleton() {
  const { t } = useMobile();
  const c = useColors();
  return (
    <SkeletonGroup label={t("Memuat paket", "Loading plan")}>
      <View testID="plan-skeleton" style={{ gap: nativeLayout.sectionGap }}>
        <View testID="plan-skeleton-hero" style={{ borderRadius: BERANDA_HERO_RADIUS, borderCurve: "continuous" }}>
          <MoodFill surface="hero" testID="plan-skeleton-hero-fill" radius={BERANDA_HERO_RADIUS} heroShadow />
          <View testID="plan-skeleton-photo" style={planPhotoFrame}>
            <Skeleton onHero aspectRatio={nativeLayout.ratio.card} radius={0} />
          </View>
          <View testID="plan-skeleton-body" style={{ padding: nativeLayout.cardPadding, gap: nativeLayout.space.xs }}>
            <View style={{ height: 18, justifyContent: "center" }}>
              <Skeleton onHero width="46%" height={12} />
            </View>
            <View style={{ height: 30, justifyContent: "center" }}>
              <Skeleton onHero width="40%" height={22} />
            </View>
            <View style={{ height: 18, justifyContent: "center" }}>
              <Skeleton onHero width="64%" height={12} />
            </View>
          </View>
        </View>
        <View>
          <View testID="plan-skeleton-heading" style={{ height: 26, justifyContent: "center", marginBottom: nativeLayout.headingGap }}>
            <Skeleton width="34%" height={18} />
          </View>
          <View
            testID="plan-skeleton-card"
            style={{
              backgroundColor: c.surface,
              borderRadius: nativeLayout.radius.card,
              paddingHorizontal: nativeLayout.cardPadding,
              overflow: "hidden",
            }}
          >
            {Array.from({ length: 3 }, (_, i) => (
              <View
                key={i}
                testID="plan-skeleton-row"
                style={{ minHeight: nativeLayout.row.media, flexDirection: "row", alignItems: "center", gap: nativeLayout.space.md }}
              >
                <View testID="plan-skeleton-thumb" style={{ width: nativeLayout.thumb.sm, height: nativeLayout.thumb.sm, borderRadius: nativeLayout.radius.thumb, overflow: "hidden" }}>
                  <Skeleton width={nativeLayout.thumb.sm} height={nativeLayout.thumb.sm} radius={nativeLayout.radius.thumb} />
                </View>
                <View style={{ flex: 1, gap: nativeLayout.space.sm }}>
                  <Skeleton width={i % 2 ? "46%" : "58%"} height={16} />
                  <Skeleton width="82%" height={12} />
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    </SkeletonGroup>
  );
}

/**
 * Paket saya's data area: the "Aktif" heading (the section's 26 line) over a card of two 72 rows with their 56 photo.
 * It reads the loaded page's own constants (section gap, heading gap, card radius and padding, row and thumb sizes).
 */
export function PlanListSkeleton() {
  const { t } = useMobile();
  const c = useColors();
  return (
    <SkeletonGroup label={t("Memuat paket", "Loading plans")}>
      <View testID="plan-list-skeleton">
        <View style={{ height: 26, justifyContent: "center", marginBottom: nativeLayout.headingGap }}>
          <Skeleton width={72} height={18} />
        </View>
        <View
          style={{
            backgroundColor: c.surface,
            borderRadius: nativeLayout.radius.card,
            paddingHorizontal: nativeLayout.cardPadding,
            overflow: "hidden",
          }}
        >
          {[0, 1].map((i) => (
            <View key={i}>
              {i > 0 ? <View style={{ height: 1, backgroundColor: c.line, marginLeft: nativeLayout.thumb.sm + nativeLayout.space.md }} /> : null}
              <View
                testID="plan-list-skeleton-row"
                style={{
                  minHeight: nativeLayout.row.media,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: nativeLayout.space.md,
                  paddingVertical: nativeLayout.space.sm,
                }}
              >
                <Skeleton width={nativeLayout.thumb.sm} height={nativeLayout.thumb.sm} radius={nativeLayout.radius.thumb} />
                <View style={{ flex: 1, gap: nativeLayout.space.sm }}>
                  <Skeleton width={i % 2 ? "52%" : "64%"} height={16} />
                  <Skeleton width={i % 2 ? "38%" : "46%"} height={12} />
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
    </SkeletonGroup>
  );
}

/**
 * Akun's body while the session is not yet known: the three shortcut tiles (96 tall, gap 8), the card of four 56 rows
 * and Pengaturan's card of one, at the loaded sections' own gaps (32 between the tiles and the cards, 16 between the
 * cards). The header (avatar and name) is chrome and renders at once.
 */
export function AkunSkeleton() {
  const { t } = useMobile();
  const c = useColors();
  const card = {
    backgroundColor: c.surface,
    borderRadius: nativeLayout.radius.card,
    paddingHorizontal: nativeLayout.cardPadding,
    overflow: "hidden" as const,
  };
  const row = (key: number, first: boolean) => (
    <View key={key}>
      {first ? null : <View style={{ height: 1, backgroundColor: c.line, marginLeft: 20 + nativeLayout.space.md }} />}
      <View
        testID="akun-skeleton-row"
        style={{ minHeight: nativeLayout.row.single, flexDirection: "row", alignItems: "center", gap: nativeLayout.space.md, paddingVertical: nativeLayout.space.sm }}
      >
        <Skeleton width={20} height={20} radius={10} />
        <Skeleton width={key % 2 ? "42%" : "56%"} height={16} />
      </View>
    </View>
  );
  return (
    <SkeletonGroup label={t("Memuat akun", "Loading account")}>
      <View testID="akun-skeleton" style={{ gap: nativeLayout.sectionGap }}>
        <View testID="akun-skeleton-tiles" style={{ flexDirection: "row", gap: nativeLayout.groupGap }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ flex: 1 }}>
              <Skeleton height={TILE_MIN_HEIGHT} radius={nativeLayout.radius.card} />
            </View>
          ))}
        </View>
        <View style={{ gap: nativeLayout.space.lg }}>
          <View style={card}>{[0, 1, 2, 3].map((i) => row(i, i === 0))}</View>
          <View style={card}>{row(0, true)}</View>
        </View>
      </View>
    </SkeletonGroup>
  );
}

/**
 * A list's rows (Alamat, Riwayat pembayaran, Bantuan, Notifikasi): `rows` rows at the shared `Row`'s 52
 * minimum, a bold line over a caption, with the loaded list's dividers. `label` names what loads ("Memuat riwayat").
 */
export function ListSkeleton({ rows, label }: { rows: number; label?: string }) {
  const { t } = useMobile();
  return (
    <SkeletonGroup label={label ?? t("Memuat daftar", "Loading list")}>
      <View testID="list-skeleton">
        <Rows count={rows} />
      </View>
    </SkeletonGroup>
  );
}

function Rows({ count }: { count: number }) {
  const c = useColors();
  return (
    <View>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          testID="list-skeleton-row"
          style={[
            { minHeight: 52, justifyContent: "center", gap: 8, paddingVertical: 10 },
            i > 0 && { borderTopWidth: 1, borderTopColor: c.line },
          ]}
        >
          <Skeleton width={i % 2 ? "52%" : "64%"} height={16} />
          <Skeleton width={i % 2 ? "38%" : "30%"} height={12} />
        </View>
      ))}
    </View>
  );
}

/**
 * One delivery day while it loads (Hari, a sheet body under its handle): the 16:10 photo, the meal's meta line, the
 * dish's hero title line, the state line, the 56 address well and a row of 56 action circles with their labels. Every
 * size reads `dayMetrics` or the layout scale, as the loaded sheet does.
 * The sheet has no title row, so the skeleton's meta line is the screen reader's header from the first frame: with
 * `header` (the day the link carried, or "Hari") it is a header that takes `focus`, as the loaded day's line does
 * once the day lands. The progress bar names the wait for the photo's block; the blocks after it only pulse with it.
 */
export function DaySkeleton({ header, focus }: { header?: string; focus?: Ref<View> } = {}) {
  const { t } = useMobile();
  const { width } = useWindowDimensions();
  const photo = Math.round((width - 2 * sheetSidePadding()) / DAY_PHOTO_RATIO);
  /** A skeleton bar centred in the line box the loaded text occupies. */
  const line = (box: number, bar: number, w: DimensionValue) => (
    <View style={{ height: box, justifyContent: "center" }}>
      <Skeleton width={w} height={bar} />
    </View>
  );
  return (
    <View testID="day-skeleton" style={{ gap: DAY_GAP }}>
      <SkeletonGroup label={t("Memuat pengantaran", "Loading delivery")}>
        <Skeleton testID="day-skeleton-photo" height={photo} radius={DAY_PHOTO_RADIUS} />
      </SkeletonGroup>
      <SkeletonGroup>
        <View testID="day-skeleton-meal" style={{ gap: DAY_MEAL_GAP }}>
          <View
            testID="day-skeleton-header"
            ref={focus}
            accessible={header !== undefined}
            accessibilityRole={header !== undefined ? "header" : undefined}
            accessibilityLabel={header}
            style={{ height: DAY_META_LINE, justifyContent: "center" }}
          >
            <Skeleton width="62%" height={12} />
          </View>
          {line(DAY_HERO_LINE, 22, "68%")}
          {line(DAY_META_LINE, 12, "74%")}
        </View>
        <Skeleton testID="day-skeleton-address" height={DAY_WELL_MIN} radius={DAY_WELL_RADIUS} />
        <View testID="day-skeleton-actions" style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: DAY_ACTIONS_PAD }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ alignItems: "center", gap: DAY_ACTION_GAP }}>
              <Skeleton width={ACTION_CIRCLE} height={ACTION_CIRCLE} radius={ACTION_CIRCLE / 2} />
              {line(DAY_META_LINE, 12, 56)}
            </View>
          ))}
        </View>
      </SkeletonGroup>
    </View>
  );
}

/** Pilih menu: the month line, the strip of dates, then the dish choices as rows. */
export function ChooseMenuSkeleton() {
  const { t } = useMobile();
  return (
    <SkeletonGroup label={t("Memuat menu", "Loading menus")}>
      <View testID="choose-menu-skeleton" style={{ gap: 16 }}>
        <Skeleton width="50%" height={28} />
        <View style={{ flexDirection: "row", gap: 8, overflow: "hidden" }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} width={64} height={64} radius={12} />
          ))}
        </View>
        <Rows count={4} />
      </View>
    </SkeletonGroup>
  );
}

/**
 * Jadwal's month while it loads: the loaded grid's own frame (weekday names, the month's week rows at `MONTH_CELL`, so
 * the header keeps one height in every state) with a `DAY_CIRCLE` circle for each day of `month`, the size of the
 * circle the loaded day draws. The circles sit on the mood header, so they read its toggle track. Nothing about the
 * days is drawn: no number, no dot, no ring.
 */
export function JadwalCellsSkeleton({ month, locale }: { month: string; locale: Locale }) {
  const { t } = useMobile();
  return (
    <SkeletonGroup label={t("Memuat jadwal", "Loading schedule")}>
      <MonthFrame
        locale={locale}
        month={month}
        cell={() => <Skeleton testID="jadwal-skeleton-cell" onMood width={DAY_CIRCLE} height={DAY_CIRCLE} radius={DAY_CIRCLE / 2} />}
      />
    </SkeletonGroup>
  );
}

/**
 * A package before its photo can lead the page (Paket opened from a link), in the loaded page's own geometry: the 4:3
 * photo, the name and caterer lines, the 76 stat strip (card padding, the 26 number and the 18 label), then the
 * "Isi paket" heading and its one card of two 72 rows, with the sections 32 apart.
 */
export function PackageSkeleton() {
  const { t } = useMobile();
  const card = nativeLayout.radius.card;
  const strip = nativeLayout.cardPadding * 2 + 26 + 18;
  return (
    <SkeletonGroup label={t("Memuat paket", "Loading package")}>
      <View testID="package-skeleton" style={{ gap: nativeLayout.space.lg }}>
        <Skeleton testID="package-skeleton-hero" aspectRatio={nativeLayout.ratio.hero} radius={card} />
        <View style={{ gap: nativeLayout.space.xs }}>
          <Skeleton width="64%" height={30} />
          <Skeleton width="48%" height={18} />
        </View>
        <Skeleton testID="package-skeleton-strip" height={strip} radius={card} />
        <View style={{ gap: nativeLayout.headingGap, marginTop: nativeLayout.space.lg }}>
          <Skeleton width="36%" height={26} />
          <Skeleton testID="package-skeleton-rows" height={nativeLayout.row.media * 2} radius={card} />
        </View>
      </View>
    </SkeletonGroup>
  );
}

/**
 * Rincian's card while the price is worked out: three rows of 40 inside the card's 8 and 16 padding, a label line at the
 * left and an amount at the right, as the loaded rows lay out.
 */
function BreakdownCard({ testID }: { testID?: string }) {
  const c = useColors();
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: c.surface,
        borderRadius: nativeLayout.radius.card,
        paddingHorizontal: nativeLayout.cardPadding,
        paddingVertical: BREAKDOWN_PAD,
      }}
    >
      {Array.from({ length: BREAKDOWN_SKELETON_ROWS }, (_, i) => (
        <View
          key={i}
          testID="breakdown-skeleton-row"
          style={{ minHeight: BREAKDOWN_ROW, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: nativeLayout.space.md }}
        >
          <Skeleton width={i === 0 ? "52%" : "34%"} height={15} />
          <Skeleton width="24%" height={15} />
        </View>
      ))}
    </View>
  );
}

/**
 * Beli and Perpanjang: the summary card (a 64 photo in 12 padding, 88 tall), the choices card (Mulai 72, Lama paket 56,
 * Porsi 56, Diantar ke 72 and the separators between them), then Rincian's heading and rows. Every size reads Buy's own
 * metrics, so the page lands where the skeleton stood.
 */
export function BuySkeleton() {
  const { t } = useMobile();
  const card = nativeLayout.radius.card;
  return (
    <SkeletonGroup label={t("Memuat paket", "Loading package")}>
      <View testID="buy-skeleton" style={{ gap: nativeLayout.sectionGap }}>
        <View style={{ gap: nativeLayout.space.xl }}>
          <Skeleton testID="buy-skeleton-summary" height={SUMMARY_HEIGHT} radius={card} />
          <Skeleton testID="buy-skeleton-fields" height={FIELDS_HEIGHT} radius={card} />
        </View>
        <View>
          <View style={{ marginBottom: nativeLayout.headingGap }}>
            <Skeleton width="30%" height={26} />
          </View>
          <BreakdownCard />
        </View>
      </View>
    </SkeletonGroup>
  );
}

/** The price breakdown while the server prices the first choice: Rincian's card of three rows. */
export function BreakdownSkeleton() {
  const { t } = useMobile();
  return (
    <SkeletonGroup label={t("Menghitung harga", "Working out the price")}>
      <BreakdownCard testID="breakdown-skeleton" />
    </SkeletonGroup>
  );
}
