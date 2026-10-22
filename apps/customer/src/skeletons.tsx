import type { ReactNode } from "react";
import { View } from "react-native";
import type { Locale } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { nativeLayout } from "@catera/design-tokens";
import { MoodFill, Skeleton, SkeletonGroup, useColors } from "@catera/mobile-ui";
import { DAY_CIRCLE, MonthFrame } from "./schedule/MonthGrid";
import { MealSegment } from "./discover/MealSegment";
import { PackageGrid, useGridCell } from "./discover/PackageGrid";
import { HERO_BAND_RISE } from "./today/heroBand";
import { HERO_RADIUS as BERANDA_HERO_RADIUS, heroPhotoFrame } from "./today/Plate";
import { STATUS_LABEL_LINE, STATUS_META_LINE, STATUS_STRIP } from "./today/StatusStops";

/**
 * One skeleton per screen (spec 2.1, 2.2): the data area's shape while its first read is out and nothing is kept on this
 * phone, at the loaded layout's heights at 360dp and font scale 1.0 (at a larger font the loaded page grows past it; the
 * skeleton is never taller). Each is one `SkeletonGroup`, so the blocks pulse together, hold still under reduced
 * motion, and a screen reader meets one progress bar named "Memuat {what}". Chrome (native header, mood header, tab
 * bar) is never part of a skeleton: it renders at once.
 */

const HERO_RADIUS = 28;

/**
 * A raised hero card while it loads, in the loaded hero's own frame: 10 padding, the 28 radius, the mood's hero fill
 * with its shadow (Siang, with Malam fading over it). The blocks inside read the hero's track (`onHero`), so they show
 * on that fill in both themes and both moods.
 */
function HeroFrame({ testID, children }: { testID: string; children: ReactNode }) {
  return (
    <View testID={testID} style={{ padding: 10, borderRadius: HERO_RADIUS, borderCurve: "continuous" }}>
      <MoodFill surface="hero" testID={`${testID}-fill`} radius={HERO_RADIUS} heroShadow />
      {children}
    </View>
  );
}

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

/** One stop of the status line: the dot in its strip, the label line and the state line, at the loaded heights. */
function StopPlaceholder() {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ height: STATUS_STRIP, justifyContent: "center" }}>
        <Skeleton onHero width={12} height={12} radius={6} />
      </View>
      <View style={{ height: STATUS_LABEL_LINE, justifyContent: "center" }}>
        <Skeleton onHero width="62%" height={14} />
      </View>
      <View style={{ height: STATUS_META_LINE, justifyContent: "center" }}>
        <Skeleton onHero width="44%" height={12} />
      </View>
    </View>
  );
}

/**
 * Beranda's data area: the hero card (photo, meal line, dish line, the two-stop status line and the state line) and two
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
            <View style={{ height: 18, justifyContent: "center" }}>
              <Skeleton onHero width="46%" height={12} />
            </View>
            <View style={{ height: 30, justifyContent: "center" }}>
              <Skeleton onHero width="72%" height={22} />
            </View>
            <View testID="beranda-skeleton-stops" style={{ flexDirection: "row" }}>
              <StopPlaceholder />
              <StopPlaceholder />
            </View>
            <View style={{ height: 22, justifyContent: "center" }}>
              <Skeleton onHero width="52%" height={14} />
            </View>
          </View>
        </BerandaHeroFrame>
        <View style={{ gap: 10 }}>
          <SkeletonRow />
          <SkeletonRow />
        </View>
      </View>
    </SkeletonGroup>
  );
}

/** A 60dp row: a 54dp round photo and two lines, the shape of the other-meal row and a Berikutnya day. */
function SkeletonRow() {
  return (
    <View style={{ minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Skeleton width={54} height={54} radius={27} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="40%" height={12} />
        <Skeleton width="64%" height={16} />
      </View>
    </View>
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
  const slop = (nativeLayout.control.icon - chip) / 2;
  return (
    <View testID="jelajah-skeleton" style={{ gap: 16 }}>
      {/* The meal segment is the real control (it is the mood, which needs no data), so it works from the first frame;
          only the chips that need the catalogue are placeholders. The row has the loaded row's 44 height and margins. */}
      <View
        testID="jelajah-skeleton-chips"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: nativeLayout.space.sm,
          minHeight: nativeLayout.control.icon,
          marginVertical: -slop,
        }}
      >
        <MealSegment />
        <SkeletonGroup>
          <Skeleton width={132} height={chip} radius={chip / 2} />
          <Skeleton width={112} height={chip} radius={chip / 2} />
        </SkeletonGroup>
      </View>
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
 * A plan's detail (Paket): the kitchen's line above the hero (its body line, pulled up 8 like the loaded one), the hero
 * card (the loaded hero's frame and fill, the 168 photo, the headline's 39 line and the dates' 23 line) and five rows of
 * what comes next. The kitchen line and the rows sit on the canvas and read the theme; the hero's blocks read its track.
 */
export function PlanSkeleton() {
  const { t } = useMobile();
  return (
    <SkeletonGroup label={t("Memuat paket", "Loading plan")}>
      <View testID="plan-skeleton" style={{ gap: 16 }}>
        <View testID="plan-skeleton-caterer" style={{ height: 23, marginTop: -8, justifyContent: "center" }}>
          <Skeleton width="40%" height={14} />
        </View>
        <HeroFrame testID="plan-skeleton-hero">
          <Skeleton onHero height={168} radius={20} />
          <View style={{ gap: 2, paddingHorizontal: 8, paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ height: 39, justifyContent: "center" }}>
              <Skeleton onHero width="70%" height={28} />
            </View>
            <View style={{ height: 23, justifyContent: "center" }}>
              <Skeleton onHero width="44%" height={14} />
            </View>
          </View>
        </HeroFrame>
        <Rows count={5} />
      </View>
    </SkeletonGroup>
  );
}

/**
 * A list's rows (Paket aktif, Alamat, Riwayat pembayaran, Bantuan, Notifikasi): `rows` rows at the shared `Row`'s 52
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
 * One delivery day (Hari, and Ada masalah before its day is known): the 180 photo, the package line, a card per meal
 * (two) and the address. The bar title is chrome and keeps the day the link carried.
 */
export function DaySkeleton() {
  const { t } = useMobile();
  return (
    <SkeletonGroup label={t("Memuat pengantaran", "Loading delivery")}>
      <View testID="day-skeleton" style={{ gap: 16 }}>
        <Skeleton height={180} radius={16} />
        <Skeleton width="58%" height={14} />
        <Skeleton height={72} radius={16} />
        <Skeleton height={72} radius={16} />
        <View style={{ gap: 8 }}>
          <Skeleton width="30%" height={12} />
          <Skeleton width="76%" height={16} />
        </View>
      </View>
    </SkeletonGroup>
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
 * A package before its photo can lead the page (Paket opened from a link): the photo, the name and caterer, the price
 * and three lines of what the package holds.
 */
export function PackageSkeleton() {
  const { t } = useMobile();
  return (
    <SkeletonGroup label={t("Memuat paket", "Loading package")}>
      <View testID="package-skeleton" style={{ gap: 16 }}>
        <Skeleton height={196} radius={16} />
        <View style={{ gap: 8 }}>
          <Skeleton width="76%" height={28} />
          <Skeleton width="48%" height={16} />
        </View>
        <Skeleton width="36%" height={24} />
        <Rows count={3} />
      </View>
    </SkeletonGroup>
  );
}

/** Beli and Perpanjang: the package's line, then the choices (address, portions, start, length) as rows. */
export function BuySkeleton() {
  const { t } = useMobile();
  return (
    <SkeletonGroup label={t("Memuat paket", "Loading package")}>
      <View testID="buy-skeleton" style={{ gap: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Skeleton width={64} height={64} radius={12} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="70%" height={20} />
            <Skeleton width="44%" height={12} />
          </View>
        </View>
        <Rows count={4} />
      </View>
    </SkeletonGroup>
  );
}

/** The price breakdown while the server prices the first choice: a line per charge, then the total. */
export function BreakdownSkeleton() {
  const { t } = useMobile();
  return (
    <SkeletonGroup label={t("Menghitung harga", "Working out the price")}>
      <View testID="breakdown-skeleton" style={{ gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Skeleton width="44%" height={14} />
            <Skeleton width="24%" height={14} />
          </View>
        ))}
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Skeleton width="30%" height={20} />
          <Skeleton width="34%" height={20} />
        </View>
      </View>
    </SkeletonGroup>
  );
}
