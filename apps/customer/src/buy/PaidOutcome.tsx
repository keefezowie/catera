import { useEffect } from "react";
import { Image, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { dayLabel, jakartaDay, pendingMenu, shortDate, type Offer, type PaidSummary } from "@catera/domain";
import { useMobile, useTrack } from "@catera/mobile-core";
import { Button, fontFor, MoodFill, StickyAction, Text, themedStyles, useMoodColors } from "@catera/mobile-ui";
import { photoUri } from "../today/Plate";

const tabular = { fontVariant: ["tabular-nums" as const] };
const HERO_RADIUS = 28;

/** purchase_confirmed_viewed is counted once per checkout id for the life of the app process, however often it opens. */
const confirmedViews = new Set<string>();

/**
 * The hero photo. `paidSummary` takes the first menu's cover, but a menu nobody has set yet (the customer still picks,
 * the caterer has named no dish, an empty slot menu) can carry a template photo; the package photo is the truth then,
 * as on the upcoming rows and the story.
 */
function heroImage(summary: PaidSummary, offer: Offer): string {
  const menu = offer.menus?.[0];
  const named = !!menu?.items?.some((i) => i.name.trim());
  const unset =
    summary.menuChoice ||
    !menu ||
    menu.selectionStatus === "pending" ||
    pendingMenu(menu) ||
    (menu.selectionStatus === "caterer_choice" && !named);
  return unset ? (offer.image ?? "") : summary.image;
}

/**
 * Pembayaran diterima: the food, the package, the first delivery and the reserved days. Only a checkout that is paid
 * and has its booking reaches here (`paidSummary` is null otherwise, and the screen keeps checking).
 */
export function PaidOutcome({ checkoutId, summary, offer }: { checkoutId: string; summary: PaidSummary; offer: Offer }) {
  const { runtime, t, locale } = useMobile();
  const track = useTrack();
  const moodColors = useMoodColors();
  const styles = useStyles();
  const image = heroImage(summary, offer);

  useEffect(() => {
    if (confirmedViews.has(checkoutId)) return;
    confirmedViews.add(checkoutId);
    track("purchase_confirmed_viewed");
  }, [checkoutId, track]);

  const first = summary.firstDate ? dayLabel(summary.firstDate, jakartaDay(new Date()), locale) : "";
  const more = summary.more;
  return (
    <>
      {/* The one mood surface on this screen; everything below it reads the theme. Not clipped, so the shadow shows. */}
      <View testID="paid-hero" style={styles.hero}>
        <MoodFill surface="hero" testID="paid-hero-fill" radius={HERO_RADIUS} heroShadow />
        {image ? (
          // The photo says nothing the name below does not, so screen readers skip it.
          <View testID="paid-photo" style={styles.photo} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Image
              testID="paid-photo-image"
              accessibilityIgnoresInvertColors
              source={{ uri: photoUri(image, runtime.apiBase) }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          </View>
        ) : null}
        <View style={{ paddingHorizontal: 8, paddingTop: 12, paddingBottom: 8, gap: 2 }}>
          <Text variant="heading" selectable style={{ color: moodColors.heroText }}>
            {summary.offerName}
          </Text>
          <Text selectable style={{ color: moodColors.heroMeta }}>
            {summary.caterer}
          </Text>
          {first ? (
            <Text selectable style={[{ color: moodColors.heroText, fontFamily: fontFor("700"), marginTop: 6 }, tabular]}>
              {t(`Antar pertama ${first}`, `First delivery ${first}`)}
            </Text>
          ) : null}
        </View>
      </View>

      <Text>{t("Jadwal antar Anda sudah tersimpan.", "Your deliveries are booked.")}</Text>
      {/* Read-only tags, not chips: a quiet fill and regular body ink, never an outline or a 48dp control. They wrap,
          so a long plan never scrolls sideways. */}
      {summary.dates.length ? (
        <View testID="paid-dates" style={styles.dates}>
          {summary.dates.map((date) => (
            <View key={date} testID="paid-date-tag" style={styles.tag}>
              <Text testID="paid-date" selectable style={tabular}>
                {shortDate(date, locale)}
              </Text>
            </View>
          ))}
          {more > 0 ? (
            <Text style={tabular}>{t(`dan ${more} hari lainnya`, `and ${more} more ${more === 1 ? "day" : "days"}`)}</Text>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

/** The paid footer (Ruling D7): see the schedule, choose the menus when the customer picks them, or go home. Every
 * one replaces this screen, so back from where it leads never returns to a payment. */
export function PaidActions({ summary }: { summary: PaidSummary }) {
  const { t } = useMobile();
  return (
    <View style={{ gap: 8 }}>
      <StickyAction testID="paid-action" label={t("Lihat jadwal", "See schedule")} onPress={() => router.replace("/jadwal" as never)} />
      {summary.menuChoice ? (
        <Button
          variant="secondary"
          label={t("Pilih menu", "Choose menu")}
          onPress={() => router.replace(`/subscriptions/${encodeURIComponent(summary.subscriptionId)}/menu` as never)}
        />
      ) : null}
      <Button variant="text" label={t("Ke Beranda", "Go to Beranda")} onPress={() => router.replace("/" as never)} />
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  hero: { padding: 10, borderRadius: HERO_RADIUS, borderCurve: "continuous" },
  photo: {
    aspectRatio: 1.65,
    borderRadius: 20,
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: c.sage,
  },
  dates: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  // A plain tag: the sage quiet fill, no border, so it never reads as the outlined chip control.
  tag: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 8, borderCurve: "continuous", backgroundColor: c.sage },
}));
