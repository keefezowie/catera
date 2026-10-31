import { useEffect, useLayoutEffect, useRef } from "react";
import { AccessibilityInfo, useWindowDimensions, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import {
  dayLabel,
  jakartaDay,
  pendingMenu,
  type CustomerState,
  type Offer,
  type PaidSummary,
  type Subscription,
} from "@catera/domain";
import { nativeLayout, nativeMotion } from "@catera/design-tokens";
import { useMobile, useTrack } from "@catera/mobile-core";
import {
  Button,
  cardEdge,
  cardEdgeWidth,
  fontFor,
  PolishArt,
  StickyAction,
  Text,
  themedStyles,
  useHaptic,
  useReduced,
} from "@catera/mobile-ui";
import { Thumb } from "../layout";
import { goToTab, leaveFor } from "../nav";
import { photoUri } from "../today/photoUri";
import { fullDayRange } from "./Breakdown";
import { PushPrimerTrigger } from "./PushPrimer";

const tabular = { fontVariant: ["tabular-nums" as const] };
/** The moment art's largest side; a short phone gives it 28% of the window height (expo-native-ui: size by height). */
const ART_MAX = 240;
const ART_SHARE = 0.28;
/** The art settles from 92% over `feature`; the words follow from about a third of the way in. */
const ART_FROM = 0.92;
const WORDS_AT = 240;
const WORDS_RISE = 8;
const ease = Easing.bezier(...nativeMotion.ease);

/** purchase_confirmed_viewed is counted once per checkout id for the life of the app process, however often it opens. */
const confirmedViews = new Set<string>();

/**
 * The first menu's main dish, with its photo, when the caterer has set it. A menu nobody has set yet (the customer
 * still picks, the caterer has named no dish, an empty slot menu) has no dish to promise, so the row is left out.
 */
function firstDish(summary: PaidSummary, offer: Offer): { name: string; image: string } | null {
  const menu = offer.menus?.[0];
  const name = menu?.items?.find((i) => i.name.trim())?.name.trim();
  if (summary.menuChoice || !menu || !name || menu.selectionStatus === "pending" || pendingMenu(menu)) return null;
  return { name, image: summary.image };
}

/** "Siang 11.00–13.00", "Malam 18.00–20.00" or "Siang dan malam": the package's meal and its window. */
function mealLine(offer: Offer, t: (id: string, en: string) => string): string {
  if (offer.meal === "both") return t("Siang dan malam", "Lunch and dinner");
  const word = offer.meal === "dinner" ? t("Malam", "Dinner") : t("Siang", "Lunch");
  const window = offer.windows?.[offer.meal] ?? "";
  return window ? `${word} ${window}` : word;
}

/**
 * "Langganan aktif" (canvas Lunas): the moment-langganan-aktif art, the outcome, and one card with the plan, its
 * kitchen, days and meal, the first delivery and how many follow, and the first dish when the caterer has set it.
 * Only a checkout that is paid and has its booking reaches here (`paidSummary` is null otherwise). `play` is the
 * transition into paid while Bayar is open: one success haptic, the title announced, and the art settling in before
 * the words (not under reduced motion). Without it the screen is drawn at rest.
 */
export function PaidOutcome({
  checkoutId,
  summary,
  offer,
  play = false,
}: {
  checkoutId: string;
  summary: PaidSummary;
  offer: Offer;
  play?: boolean;
}) {
  const { runtime, t, locale } = useMobile();
  const track = useTrack();
  const styles = useStyles();
  const reduced = useReduced();
  const haptic = useHaptic();
  const { height } = useWindowDimensions();
  const art = Math.round(Math.min(ART_MAX, height * ART_SHARE));
  const title = t("Langganan aktif", "Subscription active");

  useEffect(() => {
    if (confirmedViews.has(checkoutId)) return;
    confirmedViews.add(checkoutId);
    track("purchase_confirmed_viewed");
  }, [checkoutId, track]);

  const moving = play && !reduced;
  const settle = useSharedValue(moving ? 0 : 1);
  const words = useSharedValue(moving ? 0 : 1);
  const success = useRef(haptic.success);
  success.current = haptic.success;
  const said = useRef(title);
  said.current = title;
  // A layout effect, so a play never paints its resting frame first. The haptic and the announcement stay under reduced
  // motion; only the travel goes.
  useLayoutEffect(() => {
    if (!play) return;
    success.current();
    AccessibilityInfo.announceForAccessibility(said.current);
    if (reduced) {
      settle.value = 1;
      words.value = 1;
      return;
    }
    settle.value = 0;
    words.value = 0;
    settle.value = withTiming(1, { duration: nativeMotion.feature, easing: ease });
    words.value = withDelay(WORDS_AT, withTiming(1, { duration: nativeMotion.content, easing: ease }));
    // A play is keyed on `play` alone; the shared values are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);
  const artStyle = useAnimatedStyle(() => ({
    opacity: settle.value,
    transform: [{ scale: ART_FROM + (1 - ART_FROM) * settle.value }],
  }));
  const wordsStyle = useAnimatedStyle(() => ({
    opacity: words.value,
    transform: [{ translateY: (1 - words.value) * WORDS_RISE }],
  }));

  const first = summary.firstDate ? dayLabel(summary.firstDate, jakartaDay(new Date()), locale) : "";
  const rest = summary.dates.length + summary.more - 1;
  const firstLine = !first
    ? ""
    : rest > 0
      ? t(`Antar pertama ${first} dan ${rest} hari lainnya`, `First delivery ${first}, then ${rest} more ${rest === 1 ? "day" : "days"}`)
      : t(`Antar pertama ${first}`, `First delivery ${first}`);
  const detail = [summary.caterer, offer.weekdays?.length ? fullDayRange(offer.weekdays, locale) : "", mealLine(offer, t)]
    .filter(Boolean)
    .join(" · ");
  const dish = firstDish(summary, offer);

  return (
    <View testID="paid-outcome" style={styles.stack}>
      <Animated.View testID="paid-art" style={[styles.art, artStyle]}>
        <PolishArt name="moment-langganan-aktif" size={art} />
      </Animated.View>
      <Animated.View style={[styles.stack, wordsStyle]}>
        <View style={{ gap: nativeLayout.space.xs }}>
          <Text variant="outcome" accessibilityRole="header">
            {title}
          </Text>
          <Text variant="bodyL">
            {t("Pembayaran diterima. Jadwal antar sudah kami simpan.", "Payment received. Your deliveries are booked.")}
          </Text>
        </View>
        <View testID="paid-summary" style={styles.card}>
          <View style={[styles.cardBlock, dish ? styles.divided : null]}>
            <Text variant="rowTitle" selectable>
              {summary.offerName}
            </Text>
            <Text variant="meta" selectable style={tabular}>
              {detail}
            </Text>
            {firstLine ? (
              <Text testID="paid-first" variant="meta" selectable style={[styles.first, tabular]}>
                {firstLine}
              </Text>
            ) : null}
          </View>
          {dish ? (
            <View testID="paid-dish" style={styles.dish}>
              <Thumb uri={dish.image ? photoUri(dish.image, runtime.apiBase) : null} testID="paid-dish-photo" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="meta" style={tabular}>
                  {t(`Berikutnya · ${first}`, `Next · ${first}`)}
                </Text>
                <Text variant="rowTitle">{dish.name}</Text>
              </View>
            </View>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

/**
 * Whether this checkout pays for the customer's first paid plan, from the customer read: true when no other plan of
 * theirs carries a checkout (a plan the caterer recorded outside Catera has none and is not a paid plan). Null when
 * the read has not answered, so a first that cannot be told gets no push primer.
 */
export function firstPaidPlan(state: CustomerState | null | undefined, checkoutId: string): boolean | null {
  if (!state) return null;
  return !(state.subscriptions as (Subscription & { checkout_id?: string | null })[]).some(
    (s) => !!s.checkout_id && s.checkout_id !== checkoutId,
  );
}

/**
 * The paid body. `play` is true only when the payment turned paid while Bayar was open (ruling D8); reopening a paid
 * checkout shows the resting frame with no haptic. `confetti` is the first paid plan: with `play` it is the moment the
 * push primer may follow (once per phone, only while the phone was never asked).
 */
export function PaidBeat({
  checkoutId,
  summary,
  offer,
  play,
  confetti,
}: {
  checkoutId: string;
  summary: PaidSummary;
  offer: Offer;
  play: boolean;
  confetti: boolean;
}) {
  return (
    <>
      <PaidOutcome checkoutId={checkoutId} summary={summary} offer={offer} play={play} />
      <PushPrimerTrigger eligible={play && confetti} />
    </>
  );
}

/** The paid footer (Ruling D7, canvas Lunas): Pilih menu first when the customer picks the menus, then the schedule,
 * then home. Each one dismisses Bayar and everything above the tabs, so back from there never returns to a payment.
 * Jadwal and Beranda are selected as tabs; Pilih menu opens in the current tab, above the screen that opened the purchase. */
export function PaidActions({ summary }: { summary: PaidSummary }) {
  const { t } = useMobile();
  const schedule = t("Lihat jadwal", "See schedule");
  const pick = () => leaveFor(`/subscriptions/${encodeURIComponent(summary.subscriptionId)}/menu`);
  return (
    <View style={{ gap: nativeLayout.space.sm }}>
      {summary.menuChoice ? (
        <>
          <StickyAction testID="paid-action" label={t("Pilih menu", "Choose menu")} onPress={pick} />
          <Button variant="secondary" label={schedule} onPress={() => goToTab("jadwal")} />
        </>
      ) : (
        <StickyAction testID="paid-action" label={schedule} onPress={() => goToTab("jadwal")} />
      )}
      <Button variant="text" label={t("Ke Beranda", "Go to Home")} onPress={() => goToTab("index")} />
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  // expo-native-ui: one flex gap per stack; 20 between the art, the words and the card (DESIGN.md space ladder).
  stack: { gap: 20 },
  art: { alignItems: "center" },
  card: {
    backgroundColor: c.surface,
    borderRadius: nativeLayout.radius.card,
    borderCurve: "continuous",
    ...cardEdge(c),
  },
  cardBlock: { padding: nativeLayout.cardPadding - cardEdgeWidth(c), gap: 2 },
  divided: { borderBottomWidth: cardEdgeWidth(c) || 1, borderBottomColor: c.line },
  // The canvas drew this line in forest; Direction K keeps data in charcoal, so the weight carries it.
  first: { color: c.charcoal, fontFamily: fontFor("700") },
  dish: {
    flexDirection: "row",
    alignItems: "center",
    gap: nativeLayout.space.md,
    paddingHorizontal: nativeLayout.cardPadding - cardEdgeWidth(c),
    paddingVertical: nativeLayout.space.md,
  },
}));
