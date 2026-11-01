import { useEffect, useState } from "react";
import { AppState, StyleSheet, useWindowDimensions, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  FadeOutDown,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { paymentBar, type PaymentBar as Bar } from "@catera/domain";
import { nativeMotion } from "@catera/design-tokens";
import { useData, useMobile } from "@catera/mobile-core";
import { androidTabBarHeight, FadeSwap, fonts, PressableScale, RollingNumber, Text, useColors, useReduced } from "@catera/mobile-ui";
import { customerLink } from "../links";

/** The bar's height and the gap it keeps above the tab bar. */
const HEIGHT = 64;
const GAP = 8;
/** What a tab screen gives up at its foot while the bar shows: the gap, the bar, and the same gap above it. */
export const PAYMENT_BAR_ROOM = GAP + HEIGHT + GAP;
/** iOS's system tab bar (above the home indicator). Unverified on iOS 26's floating bar: no Mac to measure it. */
const IOS_TAB_BAR = 49;
/** Under this much time left the tile turns warm and breathes. */
const WARM_MS = 3 * 60_000;
/** While a payment is open the read is asked again this often, so one paid elsewhere leaves without a tap. */
const REFRESH_MS = 30_000;
/** The warm breath: a 3% swell out and back over two selection beats, then a rest, once every 2 s. */
const SWELL = 1.03;
const BREATH_MS = 2_000;
const BREATH_REST_MS = BREATH_MS - 2 * nativeMotion.selection;
/** One turn of the checking arrow: slow, so it reads as waiting rather than loading fast. */
const SPIN_MS = 1_400;
/** How far below its place the bar starts as it rises in. */
const RISE = 28;

const ease = Easing.bezier(...nativeMotion.ease);

/** The last segment of a tab's own root screen: `(tabs)/(jelajah)/jelajah`; Beranda's root is `(tabs)/(index)`. */
const ROOT_LEAVES = new Set(["index", "jadwal", "jelajah", "akun"]);

/** True on one of the four tab roots (`useSegments`), false on a screen pushed inside a tab or anything above the tabs. */
export function onTabRoot(segments: string[]): boolean {
  if (segments[0] !== "(tabs)") return false;
  return segments.length <= 2 || (segments.length === 3 && ROOT_LEAVES.has(segments[2]));
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * The open checkouts from the action read, as the bar shows them now: a 1 s clock while one is open, so the countdown
 * runs and a hold that ends takes the bar away by itself. The read is asked again on return to the app and every 30 s
 * while a payment is open; any command (paying, Bayar's own checks) reloads it too.
 */
export function usePaymentBar(): { bar: Bar | null; now: number } {
  const { runtime, actor } = useMobile();
  const actorId = actor?.id;
  const feed = useData(`paybar:${actorId ?? ""}`, () =>
    actorId ? runtime.api.customerActions(20) : Promise.resolve(null),
  );
  const [now, setNow] = useState(() => Date.now());
  const bar = actorId ? paymentBar(feed.data?.items, new Date(now)) : null;
  const open = !!bar;
  const reload = feed.reload;
  useEffect(() => {
    if (!open) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const ask = setInterval(() => void reload(), REFRESH_MS);
    return () => {
      clearInterval(tick);
      clearInterval(ask);
    };
  }, [open, reload]);
  useEffect(() => {
    if (!actorId) return;
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") return;
      setNow(Date.now());
      void reload();
    });
    return () => sub.remove();
  }, [actorId, reload]);
  return { bar, now };
}

/**
 * The floating payment bar over the tab bar (canvas KzRYoncGboLLwvvGnRky2n, option B): one 64 tall button that opens
 * Bayar, or Riwayat pembayaran when several are open. It rises in on a spring and sinks out; the countdown digits roll;
 * under 3 minutes the tile warms and breathes; a payment being checked turns a slow arrow instead of a clock. Reduced
 * motion keeps every state and drops the movement.
 */
export function PaymentBarView({ bar, now }: { bar: Bar; now: number }) {
  const { t } = useMobile();
  const c = useColors();
  const reduced = useReduced();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const tabBar = process.env.EXPO_OS === "ios" ? IOS_TAB_BAR : androidTabBarHeight(fontScale);
  const left = Date.parse(bar.deadline) - now;
  const checking = bar.kind === "one" && bar.status === "checking";
  const warm = !checking && left < WARM_MS;
  const time = clock(left);

  const title =
    bar.kind === "many"
      ? t(`${bar.count} pembayaran belum selesai`, `${bar.count} payments not finished`)
      : bar.status === "checking"
        ? t("Pembayaran sedang dicek", "Payment is being checked")
        : bar.status === "choose"
          ? t("Lanjutkan pembayaran", "Continue your payment")
          : warm
            ? t("Segera bayar", "Pay soon")
            : t("Selesaikan pembayaran", "Finish your payment");
  const detail =
    bar.kind === "many"
      ? t(`Yang terdekat habis ${time}`, `The soonest ends in ${time}`)
      : bar.status === "checking"
        ? [t("Jangan bayar lagi", "Don't pay again"), bar.packageName].filter(Boolean).join(" · ")
        : [bar.packageName, bar.status === "choose" ? t("pilih cara bayar", "choose how to pay") : ""].filter(Boolean).join(" · ");
  const verb = bar.kind === "many" ? t("Lihat", "View") : bar.status === "choose" ? t("Lanjut", "Continue") : t("Bayar", "Pay");
  // Read as one button: what it is, the detail, the time left (the "many" detail already says it), then the verb.
  const spoken = checking || bar.kind === "many" ? "" : t(`sisa ${time}`, `${time} left`);
  const label = [title, detail, spoken, checking ? "" : verb].filter(Boolean).join(", ");
  const open = () =>
    router.push((bar.kind === "many" ? "/pembayaran" : customerLink(bar.href)) as never);

  // The tile warms over a selection beat; under 3 minutes it breathes (a 3% swell every 2 s).
  const warmth = useSharedValue(warm ? 1 : 0);
  const swell = useSharedValue(1);
  const spin = useSharedValue(0);
  useEffect(() => {
    warmth.value = reduced ? (warm ? 1 : 0) : withTiming(warm ? 1 : 0, { duration: nativeMotion.selection, easing: ease });
    cancelAnimation(swell);
    swell.value = 1;
    if (warm && !reduced)
      swell.value = withRepeat(
        withSequence(
          withTiming(SWELL, { duration: nativeMotion.selection, easing: ease }),
          withTiming(1, { duration: nativeMotion.selection, easing: ease }),
          withDelay(BREATH_REST_MS, withTiming(1, { duration: 0 })),
        ),
        -1,
      );
  }, [warm, reduced, warmth, swell]);
  useEffect(() => {
    cancelAnimation(spin);
    spin.value = 0;
    if (checking && !reduced) spin.value = withRepeat(withTiming(1, { duration: SPIN_MS, easing: Easing.linear }), -1);
  }, [checking, reduced, spin]);
  const tileStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(warmth.value, [0, 1], [c.forest, c.cream]),
    borderColor: interpolateColor(warmth.value, [0, 1], [c.forest, c.attentionBorder]),
    transform: [{ scale: swell.value }],
  }));
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  // Warm text is charcoal, the urgent ink of direction K (Sunrise stays reserved for its four places).
  const ink = warm ? c.charcoal : c.cream;

  return (
    <Animated.View
      testID="payment-bar"
      pointerEvents="box-none"
      entering={
        reduced
          ? undefined
          : FadeInDown.springify()
              .damping(nativeMotion.spring.damping)
              .stiffness(nativeMotion.spring.stiffness)
              .mass(nativeMotion.spring.mass)
              .withInitialValues({ opacity: 0, transform: [{ translateY: RISE }] })
      }
      exiting={reduced ? undefined : FadeOutDown.duration(nativeMotion.control).easing(ease)}
      style={[styles.lane, { bottom: insets.bottom + tabBar + GAP }]}
    >
      <PressableScale
        testID="payment-bar-button"
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={open}
        style={[
          styles.bar,
          {
            backgroundColor: c.surface,
            borderColor: c.line,
            boxShadow: c.cardBorder ? "0 8px 24px rgba(22, 61, 46, 0.16)" : undefined,
          },
        ]}
      >
        <Animated.View testID="payment-bar-tile" style={[styles.tile, tileStyle]}>
          {checking ? (
            <Animated.View style={spinStyle}>
              <Ionicons name="sync" size={22} color={c.cream} />
            </Animated.View>
          ) : (
            <>
              <RollingNumber value={time} style={[styles.clock, { color: ink }]} accessibilityLabel={time} />
              <Text style={[styles.left, { color: ink }]}>{t("sisa", "left")}</Text>
            </>
          )}
        </Animated.View>
        <FadeSwap swapKey={title} style={styles.text}>
          <Text variant="bodyStrong" numberOfLines={1} style={{ color: c.charcoal }}>
            {title}
          </Text>
          <Text variant="meta" numberOfLines={1} style={styles.figures}>
            {detail}
          </Text>
        </FadeSwap>
        {checking ? (
          <Ionicons name="chevron-forward" size={18} color={c.muted} />
        ) : (
          <View style={[styles.verb, { backgroundColor: c.forest }]}>
            <Text variant="bodyStrong" style={{ color: c.cream, fontSize: 14, lineHeight: 18 }}>
              {verb}
            </Text>
          </View>
        )}
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  lane: { position: "absolute", start: 12, end: 12 },
  bar: {
    height: HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingStart: 9,
    paddingEnd: 12,
    borderRadius: 16,
    borderCurve: "continuous",
    borderWidth: 1,
  },
  tile: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderCurve: "continuous",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  clock: { fontSize: 14, lineHeight: 16, fontFamily: fonts.extrabold, fontVariant: ["tabular-nums"] },
  left: { fontSize: 10, lineHeight: 12 },
  text: { flex: 1, minWidth: 0 },
  figures: { fontVariant: ["tabular-nums"] },
  verb: { height: 36, paddingHorizontal: 16, borderRadius: 18, justifyContent: "center" },
});
