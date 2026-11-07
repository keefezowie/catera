import { createContext, use, useEffect, useState } from "react";
import { AppState, Platform, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  FadeOutDown,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { paymentBar, type PaymentBar as Bar } from "@catera/domain";
import { nativeMotion, urgentCard } from "@catera/design-tokens";
import { useData, useMobile } from "@catera/mobile-core";
import { androidTabBarHeight, FadeSwap, fonts, PressableScale, RollingNumber, Text, useColors, useHaptic, useReduced } from "@catera/mobile-ui";
import { customerLink } from "../links";

/** The card's height, and the gap it keeps from the tab bar and from the page above it. */
const HEIGHT = 60;
const GAP = 8;
/** The card's distance from the screen's sides. */
const SIDE = 16;
/** The card's height is fixed, so its two lines stop growing here: at 1.5 they still fit it. */
const LINE_CAP = 1.5;
/** What a tab screen gives up at its foot while the bar shows: the bar and a gap on each side of it. */
export const PAYMENT_BAR_ROOM = HEIGHT + 2 * GAP;
/** iOS 26 has the system's bottom accessory: above the full tab bar, and beside it once it has shrunk. */
export const usesTabAccessory = () => Platform.OS === "ios" && Number.parseInt(String(Platform.Version), 10) >= 26;
/** iOS's system tab bar (above the home indicator). Unverified on iOS 26's floating bar: no Mac to measure it. */
const IOS_TAB_BAR = 49;
/** Under this much time left the strip turns warm. */
const WARM_MS = 3 * 60_000;
/** In those last minutes the bar nudges this often: a shake and a vibration, to hurry the person along. */
const NUDGE_MS = 15_000;
/** The shake, in points either side of its place, dying away. */
const NUDGE_STEPS = [-6, 6, -5, 5, -3, 3, 0];
const NUDGE_STEP_MS = 55;
/** While a payment is open the read is asked again this often, so one paid elsewhere leaves without a tap. */
const REFRESH_MS = 30_000;
/** One turn of the checking arrow: slow, so it reads as waiting rather than loading fast. */
const SPIN_MS = 1_400;
/** How far below its place the strip starts as it rises in. */
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

/** The 1 s clock of a countdown. It lives in the leaf that draws the time, so the tabs around it don't redraw every second. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  return now;
}

/**
 * The open checkouts from the action read, as the bar shows them now: a hold that ends takes the bar away by itself
 * (the soonest deadline is what changes it, so nothing re-renders before then). The read is asked again on return to
 * the app and every 30 s while a payment is open; any command (paying, Bayar's own checks) reloads it too.
 */
export function usePaymentBar(): { bar: Bar | null } {
  const { runtime, actor } = useMobile();
  const actorId = actor?.id;
  const feed = useData(`paybar:${actorId ?? ""}`, () =>
    actorId ? runtime.api.customerActions(20) : Promise.resolve(null),
  );
  const [now, setNow] = useState(() => Date.now());
  const bar = actorId ? paymentBar(feed.data?.items, new Date(now)) : null;
  const deadline = bar ? Date.parse(bar.deadline) : null;
  const reload = feed.reload;
  useEffect(() => {
    if (deadline === null) return;
    const ended = setInterval(() => {
      if (Date.now() >= deadline) setNow(Date.now());
    }, 1000);
    const ask = setInterval(() => void reload(), REFRESH_MS);
    return () => {
      clearInterval(ended);
      clearInterval(ask);
    };
  }, [deadline, reload]);
  useEffect(() => {
    if (!actorId) return;
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") return;
      setNow(Date.now());
      void reload();
    });
    return () => sub.remove();
  }, [actorId, reload]);
  return { bar };
}

/** Which nudge of the last minutes this moment belongs to; null while none is due (a payment being checked, or time to spare). */
function nudgeBeat(bar: Bar, now: number): number | null {
  const left = Date.parse(bar.deadline) - now;
  const checking = bar.kind === "one" && bar.status === "checking";
  return !checking && left < WARM_MS ? Math.floor(left / NUDGE_MS) : null;
}

/** The shake of each nudge. iOS draws the accessory twice, so this runs per copy and the vibration does not (`usePaymentVibration`). Reduced motion stays still. */
function useNudge(bar: Bar, now: number) {
  const reduced = useReduced();
  const beat = nudgeBeat(bar, now);
  const x = useSharedValue(0);
  useEffect(() => {
    if (beat === null || reduced) return;
    x.value = withSequence(...NUDGE_STEPS.map((step) => withTiming(step, { duration: NUDGE_STEP_MS })));
  }, [beat, reduced, x]);
  return useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
}

/** One vibration per nudge while the bar shows and the app is open. Reduced motion keeps it: nothing moves. */
export function usePaymentVibration(bar: Bar | null, now: number) {
  const haptic = useHaptic();
  const beat = bar ? nudgeBeat(bar, now) : null;
  useEffect(() => {
    if (beat !== null && AppState.currentState === "active") haptic.warning();
  }, [beat, haptic]);
}

/** The vibration on its own clock, drawing nothing: iOS draws the accessory twice, and this stays once. */
export function PaymentVibration({ bar }: { bar: Bar }) {
  usePaymentVibration(bar, useNow());
  return null;
}

/** The words and the action of a bar, shared by the floating card and the iOS 26 accessory. */
function useBarCopy(bar: Bar, now: number) {
  const { t } = useMobile();
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
  // The countdown sits at the end edge; "many" already says its time in the detail, and a check has no clock.
  const countdown = !checking && bar.kind !== "many";
  // Read as one button: what it is, the detail, the time left, then what a tap does.
  const spoken = countdown ? t(`sisa ${time}`, `${time} left`) : "";
  const label = [title, detail, spoken, checking ? "" : verb].filter(Boolean).join(", ");
  const open = () =>
    router.push((bar.kind === "many" ? "/pembayaran" : customerLink(bar.href)) as never);
  return { checking, warm, time, title, detail, countdown, label, open };
}

/** The bar's state for the accessory, which iOS draws twice (one per placement): both copies read this one value. */
export const PaymentBarContext = createContext<Bar | null>(null);

/**
 * The bar inside iOS 26's bottom accessory (canvas 4buPTjzp9cz2gadUBmRDaG). The system draws the glass capsule and moves
 * it between its two places; each place holds its own copy of this, and iOS cross-fades them. Beside the shrunken tab bar
 * there is only room for the clock and the time.
 */
export function PaymentAccessory() {
  const bar = use(PaymentBarContext);
  const placement = NativeTabs.BottomAccessory.usePlacement();
  return bar ? <AccessoryContent bar={bar} inline={placement === "inline"} /> : null;
}

function AccessoryContent({ bar, inline }: { bar: Bar; inline: boolean }) {
  const { t } = useMobile();
  const c = useColors();
  const now = useNow();
  const { checking, warm, time, title, detail, countdown, label, open } = useBarCopy(bar, now);
  const nudge = useNudge(bar, now);
  // The system owns the glass, so the words carry the urgency, in the red that reads on this theme's glass.
  const ink = warm ? c.danger : c.forest;
  const short = checking ? t("Sedang dicek", "Being checked") : warm ? title : t("Bayar", "Pay");
  return (
    <Pressable testID="payment-accessory" accessibilityRole="button" accessibilityLabel={label} onPress={open} style={styles.accessoryPress}>
      <Animated.View style={[styles.accessory, nudge]}>
      <Ionicons name={checking ? "sync" : "timer-outline"} size={20} color={ink} />
      <View style={styles.text}>
        <Text numberOfLines={1} style={[styles.accessoryTitle, { color: warm ? ink : c.charcoal }]}>
          {inline ? short : title}
        </Text>
        {inline ? null : (
          <Text numberOfLines={1} style={[styles.accessoryDetail, { color: c.muted }]}>
            {detail}
          </Text>
        )}
      </View>
      {countdown ? <Text style={[styles.accessoryClock, { color: ink }]}>{time}</Text> : null}
      {inline ? null : <Ionicons name="chevron-forward" size={16} color={c.muted} />}
      </Animated.View>
    </Pressable>
  );
}

/**
 * The payment card floating above the tab bar on Android and before iOS 26 (canvas 4buPTjzp9cz2gadUBmRDaG): one 60 tall
 * button, apart from the bar, that opens Bayar, or Riwayat pembayaran when several are open. A clock, what to do, the
 * package, and the countdown at the end edge; no button inside the button. It rises in on a spring and sinks out; the
 * digits roll; under 3 minutes the ground turns deep green, the words coral and the card nudges; a payment being checked turns a slow arrow and
 * drops the countdown. Reduced motion keeps every state and drops the movement. Android draws it as a Material elevated card: no
 * border, the level 3 shadow, a ripple for the press and no chevron.
 */
export function PaymentBarView({ bar, os = process.env.EXPO_OS }: { bar: Bar; os?: string }) {
  const android = os === "android";
  const c = useColors();
  const now = useNow();
  const reduced = useReduced();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const tabBar = process.env.EXPO_OS === "ios" ? IOS_TAB_BAR : androidTabBarHeight(fontScale);
  const { checking, warm, time, title, detail, countdown, label, open } = useBarCopy(bar, now);

  const nudge = useNudge(bar, now);
  // The ground turns over a selection beat.
  const warmth = useSharedValue(warm ? 1 : 0);
  const spin = useSharedValue(0);
  useEffect(() => {
    warmth.value = reduced ? (warm ? 1 : 0) : withTiming(warm ? 1 : 0, { duration: nativeMotion.selection, easing: ease });
  }, [warm, reduced, warmth]);
  useEffect(() => {
    cancelAnimation(spin);
    spin.value = 0;
    if (checking && !reduced) spin.value = withRepeat(withTiming(1, { duration: SPIN_MS, easing: Easing.linear }), -1);
  }, [checking, reduced, spin]);
  const groundStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(warmth.value, [0, 1], [c.scheduled, urgentCard.ground]),
    borderColor: interpolateColor(warmth.value, [0, 1], [c.secondaryBorder, urgentCard.ground]),
  }));
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const ink = warm ? urgentCard.ink : c.forest;

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
      <Animated.View testID="payment-bar-ground" style={[styles.ground, android ? styles.groundAndroid : styles.groundIos, groundStyle, nudge]}>
        <PressableScale
          testID="payment-bar-button"
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={open}
          pressFeedback={!android}
          android_ripple={android ? { color: warm ? urgentCard.ripple : c.line } : undefined}
          style={styles.bar}
        >
          {checking ? (
            <Animated.View style={spinStyle}>
              <Ionicons name="sync" size={22} color={ink} />
            </Animated.View>
          ) : (
            <Ionicons name="timer-outline" size={22} color={ink} />
          )}
          <FadeSwap swapKey={title} style={styles.text}>
            <Text variant="bodyStrong" numberOfLines={1} maxFontSizeMultiplier={LINE_CAP} style={{ color: warm ? urgentCard.ink : c.charcoal }}>
              {title}
            </Text>
            <Text variant="meta" numberOfLines={1} maxFontSizeMultiplier={LINE_CAP} style={warm ? [styles.figures, { color: urgentCard.soft }] : styles.figures}>
              {detail}
            </Text>
          </FadeSwap>
          {countdown ? (
            <RollingNumber testID="payment-bar-clock" value={time} style={[styles.clock, { color: ink }]} accessibilityLabel={time} />
          ) : null}
          {android ? null : <Ionicons testID="payment-bar-chevron" name="chevron-forward" size={18} color={warm ? urgentCard.soft : c.muted} />}
        </PressableScale>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  lane: { position: "absolute", start: SIDE, end: SIDE },
  ground: {
    borderRadius: 16,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  groundIos: { borderWidth: 1, boxShadow: "0 6px 20px rgba(0, 0, 0, 0.3)" },
  /** Material's elevation level 3. */
  groundAndroid: { boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3), 0 4px 8px 3px rgba(0, 0, 0, 0.15)" },
  accessoryPress: { flex: 1 },
  accessory: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14 },
  accessoryTitle: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18 },
  accessoryDetail: { fontSize: 12, lineHeight: 15, fontVariant: ["tabular-nums"] },
  accessoryClock: { fontFamily: fonts.extrabold, fontSize: 15, lineHeight: 20, fontVariant: ["tabular-nums"] },
  bar: {
    height: HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: SIDE,
  },
  clock: { fontSize: 17, lineHeight: 22, fontFamily: fonts.extrabold, fontVariant: ["tabular-nums"] },
  text: { flex: 1, minWidth: 0 },
  figures: { fontVariant: ["tabular-nums"] },
});
