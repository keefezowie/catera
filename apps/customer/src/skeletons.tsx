import { View } from "react-native";
import type { Locale } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { Skeleton, SkeletonGroup, useColors } from "@catera/mobile-ui";
import { MonthFrame } from "./schedule/MonthGrid";
import { HERO_OVERLAP } from "./today/Plate";

/**
 * One skeleton per screen (spec 2.1, 2.2): the data area's shape while its first read is out and nothing is kept on this
 * phone, at the loaded layout's heights at 360dp and font scale 1.0 (at a larger font the loaded page grows past it; the
 * skeleton is never taller). Each is one `SkeletonGroup`, so the blocks pulse together, hold still under reduced
 * motion, and a screen reader meets one progress bar named "Memuat {what}". Chrome (native header, mood header, tab
 * bar) is never part of a skeleton: it renders at once.
 */

/**
 * Beranda's data area: the hero card (photo, dish line, caption), the other meal's row and two Berikutnya rows. Like the
 * loaded hero it rides up over the mood header by `HERO_OVERLAP` (the header leaves its 58 for it), so the skeleton
 * hero sits exactly where the loaded one lands and the swap does not jump. The photo block reads the mood's toggle
 * track: it sits on the header's fill in Siang and Malam alike, where the theme fill would flash in Malam.
 */
export function BerandaSkeleton() {
  const { t } = useMobile();
  return (
    <SkeletonGroup label={t("Memuat beranda", "Loading home")}>
      <View testID="beranda-skeleton" style={{ gap: 16, marginTop: HERO_OVERLAP }}>
        <View style={{ padding: 10, gap: 12 }}>
          <Skeleton onMood height={168} radius={20} />
          <View style={{ gap: 8, paddingHorizontal: 8, paddingBottom: 8 }}>
            <Skeleton width="72%" height={22} />
            <Skeleton width="48%" height={14} />
          </View>
        </View>
        <SkeletonRow />
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

/**
 * Jelajah's data area: the category circles (66 with their name), the two filter chips (48) and three package rows (a
 * 112 square photo beside the name, the caterer line and the price), each row in the loaded row's bordered card.
 */
export function JelajahSkeleton() {
  const { t } = useMobile();
  const c = useColors();
  return (
    <SkeletonGroup label={t("Memuat paket", "Loading packages")}>
      <View testID="jelajah-skeleton" style={{ gap: 16 }}>
        <View style={{ flexDirection: "row", gap: 8, overflow: "hidden" }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ width: 82, alignItems: "center", gap: 6 }}>
              <Skeleton width={66} height={66} radius={33} />
              <Skeleton width={48} height={12} />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Skeleton width={150} height={48} radius={9} />
          <Skeleton width={140} height={48} radius={9} />
        </View>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              borderRadius: 16,
              borderCurve: "continuous",
              overflow: "hidden",
              borderWidth: 1,
              borderColor: c.line,
              backgroundColor: c.surface,
            }}
          >
            <Skeleton width={112} height={112} radius={0} />
            <View style={{ flex: 1, padding: 12, gap: 10 }}>
              <Skeleton width="80%" height={20} />
              <Skeleton width="60%" height={12} />
              <Skeleton width="45%" height={20} />
            </View>
          </View>
        ))}
      </View>
    </SkeletonGroup>
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

/** Disimpan: two of the tall package cards it lists (the 196 photo over the name, the price and the caterer line). */
export function SavedSkeleton() {
  const { t } = useMobile();
  const c = useColors();
  return (
    <SkeletonGroup label={t("Memuat paket tersimpan", "Loading saved packages")}>
      <View testID="saved-skeleton" style={{ gap: 16 }}>
        {[0, 1].map((i) => (
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
            <Skeleton height={196} radius={0} />
            <View style={{ padding: 14, gap: 10 }}>
              <Skeleton width="70%" height={20} />
              <Skeleton width="40%" height={20} />
              <Skeleton width="56%" height={12} />
            </View>
          </View>
        ))}
      </View>
    </SkeletonGroup>
  );
}

/**
 * A plan's detail (Paket): the hero (10 frame, the 168 photo, the plan's name and its kitchen) and five rows of what is
 * left and what comes next. The blocks read the theme fill: the page sits on the canvas, under the native header.
 */
export function PlanSkeleton() {
  const { t } = useMobile();
  return (
    <SkeletonGroup label={t("Memuat paket", "Loading plan")}>
      <View testID="plan-skeleton" style={{ gap: 16 }}>
        <View style={{ padding: 10, gap: 12 }}>
          <Skeleton height={168} radius={20} />
          <View style={{ gap: 8, paddingHorizontal: 8, paddingBottom: 8 }}>
            <Skeleton width="70%" height={30} />
            <Skeleton width="44%" height={16} />
          </View>
        </View>
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
 * Jadwal's month while it loads: the loaded grid's own frame (weekday names, six 52 week rows, so the header keeps one
 * height in every state) with a cell for each day of `month` at the photo cell's size and radius. The cells sit on the
 * mood header, so they read its toggle track. Nothing about the days is drawn: no number, no photo, no ring.
 */
export function JadwalCellsSkeleton({ month, locale }: { month: string; locale: Locale }) {
  const { t } = useMobile();
  return (
    <SkeletonGroup label={t("Memuat jadwal", "Loading schedule")}>
      <MonthFrame
        locale={locale}
        month={month}
        cell={() => <Skeleton testID="jadwal-skeleton-cell" onMood height={52} radius={12} />}
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
