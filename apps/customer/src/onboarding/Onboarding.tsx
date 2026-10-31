import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BackHandler, ScrollView, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { nativeMotion } from "@catera/design-tokens";
import { areaOptions } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  ChoiceList,
  fonts,
  PolishArt,
  PressableScale,
  SheetFitBody,
  SheetHeader,
  Skeleton,
  SkeletonGroup,
  StepHeader,
  StickyAction,
  Text,
  useColors,
  useReduced,
  useTopInsetOwned,
  withAlpha,
  type PolishArtName,
} from "@catera/mobile-ui";
import { chooseArea, useStoredArea } from "../discover/area";
import { goToTab, type Tab } from "../nav";
import { finishOnboarding } from "./gate";
import { LAUK_PREFS, LAUK_SORTS_JELAJAH, laukName, MAX_LAUK, readLaukPrefs, saveLaukPrefs, toggleLauk, type LaukPref } from "./prefs";

// Measurements: the 20 side gutter and the 44+ targets are the phone rules of design-taste-frontend's app screens
// (16-20 margins, 44 minimum target); type comes from the DESIGN.md variants; expo-native-ui sets the insets (both edges
// paid) and flexbox over fixed heights, so 1.3x text grows the page instead of clipping it.
const GUTTER = 20;

/** Leaves onboarding for good: the flag first, then the tab, which closes the onboarding modal above the tabs. */
function useLeave() {
  const { runtime } = useMobile();
  return useCallback(
    (tab: Tab) => {
      void finishOnboarding(runtime).then(() => goToTab(tab));
    },
    [runtime],
  );
}

/** The status-bar inset this screen pays: none while the demo strip above it already pays it. */
function useTop() {
  const insets = useSafeAreaInsets();
  return useTopInsetOwned() ? 0 : insets.top;
}

/**
 * Android's back on the welcome screen, which has nowhere to go back to inside onboarding, skips it like "Lewati".
 * Only while Welcome is in front: it stays mounted under the steps, whose back must go back one step.
 */
function useBackSkips(skip: () => void) {
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        skip();
        return true;
      });
      return () => sub.remove();
    }, [skip]),
  );
}

/** `/mulai`: the welcome photo, the promise in two lines and "Mulai". "Lewati" sits on the photo. */
export function Welcome() {
  const { t } = useMobile();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const top = useTop();
  const leave = useLeave();
  const skip = useCallback(() => leave("index"), [leave]);
  useBackSkips(skip);
  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      {/* The photo takes whatever the words leave: flex, not a fixed share, so large text keeps its room. */}
      <View style={{ flex: 1, minHeight: 200 }}>
        <PolishArt name="welcome-meja" width={undefined} height={undefined} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <View
          style={{
            position: "absolute",
            top: top + 12,
            left: GUTTER,
            right: GUTTER,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: c.forest, justifyContent: "center" }}>
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 16, lineHeight: 20, color: c.cream }}>Catera</Text>
          </View>
          <PressableScale
            testID="mulai-lewati"
            accessibilityRole="button"
            accessibilityLabel={t("Lewati", "Skip")}
            onPress={skip}
            style={{ minHeight: 44, paddingHorizontal: 18, borderRadius: 22, borderCurve: "continuous", backgroundColor: withAlpha(c.surface, 0.92), justifyContent: "center" }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: c.charcoal }}>{t("Lewati", "Skip")}</Text>
          </PressableScale>
        </View>
      </View>
      <View style={{ gap: 8, paddingHorizontal: GUTTER, paddingTop: 24, paddingBottom: insets.bottom + 16 }}>
        <Text variant="outcome" accessibilityRole="header">
          {t("Masakan rumahan, diantar tiap hari", "Home cooking, delivered every day")}
        </Text>
        <Text variant="bodyL" style={{ color: c.muted }}>
          {t(
            "Pilih katering dekat rumah, langganan seminggu, lalu tunggu rantangnya datang.",
            "Pick a caterer near home, subscribe for a week, then wait for the rantang to arrive.",
          )}
        </Text>
        <View style={{ paddingTop: 16 }}>
          <Button label={t("Cari katering", "Find caterers")} onPress={() => router.push("/mulai/area" as never)} />
        </View>
      </View>
    </View>
  );
}

/** A step's frame: StepHeader with "Lewati" after it, the page scrolling under it, and the action pinned below. */
function StepFrame({ step, footer, children }: { step: number; footer: ReactNode; children: ReactNode }) {
  const { t } = useMobile();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const top = useTop();
  const leave = useLeave();
  return (
    <View style={{ flex: 1, backgroundColor: c.canvas, paddingTop: top }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingStart: GUTTER - 4, paddingEnd: GUTTER - 8 }}>
        <View style={{ flex: 1 }}>
          <StepHeader step={step} total={2} onBack={() => router.back()} />
        </View>
        <Button variant="text" label={t("Lewati", "Skip")} onPress={() => leave("index")} />
      </View>
      <ScrollView contentInsetAdjustmentBehavior="never" contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: 24, gap: 24 }}>
        {children}
      </ScrollView>
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: insets.bottom + 16 }}>{footer}</View>
    </View>
  );
}

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  const c = useColors();
  return (
    <View style={{ gap: 8 }}>
      <Text variant="outcome" accessibilityRole="header">
        {title}
      </Text>
      <Text variant="bodyL" style={{ color: c.muted }}>
        {subtitle}
      </Text>
    </View>
  );
}

/** `/mulai/area`, step 1 of 2: the area art, the promise and "Pilih area" (the area sheet). A chosen area shows here. */
export function AreaStep() {
  const { t } = useMobile();
  const c = useColors();
  const stored = useStoredArea();
  const covered = useCoveredAreas();
  // An area picked earlier in Jelajah only carries over when a caterer still delivers there.
  const area = stored && (!covered || covered.includes(stored)) ? stored : "";
  const { width, height } = useWindowDimensions();
  // Large on a tall phone (the art carries transparent margins), never wider than the gutters, and under 40% of the
  // height so the words and the action stay on the first screen.
  const art = Math.round(Math.min(width - GUTTER * 2, 320, height * 0.38));
  const pick = () => router.push("/mulai/area-pilih" as never);
  return (
    <StepFrame
      step={1}
      footer={
        area ? (
          <View style={{ gap: 12 }}>
            <Button label={t("Lanjut", "Continue")} onPress={() => router.push("/mulai/lauk" as never)} />
            <Button variant="secondary" label={t("Ganti area", "Change area")} onPress={pick} />
          </View>
        ) : (
          <Button label={t("Pilih area", "Choose area")} onPress={pick} />
        )
      }
    >
      <View style={{ alignItems: "center" }}>
        <PolishArt name="primer-area" size={art} />
      </View>
      <Heading
        title={t("Katering di dekatmu", "Caterers near you")}
        subtitle={t(
          "Pilih areamu, nanti yang muncul cuma katering yang bisa antar ke rumahmu.",
          "Choose your area and you'll only see caterers that deliver to your home.",
        )}
      />
      {area ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="location" size={20} color={c.forest} accessible={false} importantForAccessibility="no" />
          <Text variant="bodyStrong" testID="area-chosen" selectable>
            {area}
          </Text>
        </View>
      ) : null}
    </StepFrame>
  );
}

/**
 * The areas a caterer delivers to now, read from the same catalog Jelajah filters on (each package's own areas), in
 * the app's area order. Null while it loads. A failed read, or a catalog naming none, offers every area: better a
 * choice that may come up empty than no choice at all.
 */
function useCoveredAreas(): string[] | null {
  const { runtime } = useMobile();
  const catalog = useData<{ items: { areas?: string[] }[] }>("mulai:areas", () => runtime.api.catalog("?limit=100") as never);
  if (catalog.loading && !catalog.data) return null;
  const items = catalog.data?.items ?? [];
  const covered = areaOptions.filter((a) => items.some((o) => (o.areas ?? []).includes(a)));
  return covered.length ? covered : [...areaOptions];
}

/**
 * `/mulai/area-pilih`: the areas that have a caterer, as a choice sheet, so the step keeps its promise. Onboarding asks
 * for one area, so "Semua area" is not offered.
 */
export function AreaPick() {
  const { t } = useMobile();
  const area = useStoredArea();
  const covered = useCoveredAreas();
  const title = t("Area pengantaran", "Delivery area");
  return (
    <SheetFitBody header={<SheetHeader title={title} closeLabel={t("Tutup", "Close")} />}>
      {covered === null ? (
        <SkeletonGroup label={t("Memuat area", "Loading areas")}>
          <View style={{ gap: 12, paddingHorizontal: 24, paddingVertical: 8 }}>
            {areaOptions.map((value) => (
              <Skeleton key={value} height={32} radius={8} />
            ))}
          </View>
        </SkeletonGroup>
      ) : (
        <ChoiceList
          label={title}
          options={covered.map((value) => ({ value, label: value }))}
          value={area || null}
          onChange={(next) => {
            chooseArea(next);
            router.back();
          }}
        />
      )}
    </SheetFitBody>
  );
}

const PLATE: Record<LaukPref, PolishArtName> = {
  ayam: "plate-ayam",
  ikan: "plate-ikan",
  daging: "plate-daging",
  sayur: "plate-sayur",
  pedas: "plate-pedas",
  "tanpa-santan": "plate-tanpa-santan",
};
/** An unpicked plate sits smaller, as drawn (104 against 150). It only dims once three are picked and it is off. */
const RESTING = 0.72;

function Plate({ pref, picked, full, size, onPress }: { pref: LaukPref; picked: boolean; full: boolean; size: number; onPress: () => void }) {
  const { t } = useMobile();
  const c = useColors();
  const reduced = useReduced();
  const grow = useSharedValue(picked ? 1 : RESTING);
  useEffect(() => {
    const to = picked ? 1 : RESTING;
    grow.value = reduced ? to : withTiming(to, { duration: nativeMotion.selection, easing: Easing.bezier(...nativeMotion.ease) });
  }, [picked, reduced, grow]);
  // The box itself grows (not a scale transform), so the label stays right under the plate at either size.
  const art = useAnimatedStyle(() => ({ width: size * grow.value, height: size * grow.value }));
  const off = full && !picked;
  const name = laukName(pref, t);
  return (
    <PressableScale
      testID={`lauk-${pref}`}
      haptic="select"
      accessibilityRole="checkbox"
      accessibilityLabel={name}
      accessibilityState={{ checked: picked, disabled: full && !picked }}
      onPress={onPress}
      style={{ alignItems: "center", gap: 4 }}
    >
      <Animated.View testID={`lauk-${pref}-art`} style={[{ opacity: off ? 0.45 : 1 }, art]}>
        <PolishArt name={PLATE[pref]} style={{ width: "100%", height: "100%" }} />
      </Animated.View>
      {picked ? (
        <View
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 28,
            height: 28,
            borderRadius: 14,
            borderWidth: 2,
            borderColor: c.canvas,
            backgroundColor: c.forest,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="checkmark" size={16} color={c.cream} />
        </View>
      ) : null}
      {/* The label keeps full ink even when off (only the art dims): dimmed text would fail contrast. */}
      <Text style={{ fontFamily: picked ? fonts.extrabold : fonts.semibold, fontSize: 15, lineHeight: 20, color: c.charcoal }}>
        {name}
      </Text>
    </PressableScale>
  );
}

/** `/mulai/lauk`, step 2 of 2: six plates, up to three picked, kept on the phone; "Lanjut" opens the loader. */
export function LaukStep() {
  const { t } = useMobile();
  const c = useColors();
  const { width } = useWindowDimensions();
  const [picked, setPicked] = useState<LaukPref[]>([]);
  useEffect(() => {
    let live = true;
    void readLaukPrefs().then((kept) => live && kept.length && setPicked(kept));
    return () => {
      live = false;
    };
  }, []);
  const full = picked.length >= MAX_LAUK;
  // Two staggered columns echo the drawn scatter in flexbox: the right column starts lower.
  const column = (width - GUTTER * 2 - 16) / 2;
  const size = Math.round(Math.min(column - 8, 150));
  const left = LAUK_PREFS.filter((_, i) => i % 2 === 0);
  const right = LAUK_PREFS.filter((_, i) => i % 2 === 1);
  const plate = (pref: LaukPref) => (
    <Plate key={pref} pref={pref} picked={picked.includes(pref)} full={full} size={size} onPress={() => setPicked((now) => toggleLauk(now, pref))} />
  );
  const next = () => {
    void saveLaukPrefs(picked).then(() => router.push("/mulai/mencari" as never));
  };
  return (
    <StepFrame
      step={2}
      footer={
        <View testID="lauk-footer" style={{ gap: 8 }}>
          {/* The limit sits on the action, where the eye is when a fourth tap does nothing, never below the fold. */}
          {full ? (
            <Text variant="meta" testID="lauk-full" accessibilityLiveRegion="polite" style={{ color: c.muted }}>
              {t("Sudah 3. Lepas satu kalau mau ganti.", "That's 3. Deselect one to swap.")}
            </Text>
          ) : null}
          <StickyAction
            testID="lauk-next"
            label={picked.length ? t(`Lanjut · ${picked.length} dipilih`, `Continue · ${picked.length} picked`) : t("Lanjut", "Continue")}
            disabled={!picked.length}
            hint={t("Pilih satu lauk dulu, atau lewati.", "Pick one dish first, or skip.")}
            onPress={next}
          />
        </View>
      }
    >
      <Heading
        title={t("Lauk favoritmu?", "Your favourite dishes?")}
        subtitle={
          LAUK_SORTS_JELAJAH
            ? t("Pilih sampai 3. Paket di Jelajah kami urutkan dari pilihanmu.", "Pick up to 3. We sort Jelajah's packages by your picks.")
            : t("Pilih sampai 3. Kami ingat pilihanmu.", "Pick up to 3. We'll remember your picks.")
        }
      />
      <View style={{ flexDirection: "row", gap: 16 }}>
        <View style={{ flex: 1, gap: 12, alignItems: "center" }}>{left.map(plate)}</View>
        <View style={{ flex: 1, gap: 12, alignItems: "center", paddingTop: Math.round(size * 0.4) }}>{right.map(plate)}</View>
      </View>
    </StepFrame>
  );
}

/** How long the loader stays up: long enough to read its two lines. */
export const MENCARI_MS = 1600;

/** `/mulai/mencari`: the picked plates, "Mencari katering untukmu…" and what was chosen, then Jelajah. */
export function Mencari() {
  const { t } = useMobile();
  const c = useColors();
  const reduced = useReduced();
  const area = useStoredArea();
  const leave = useLeave();
  const top = useTop();
  const [picked, setPicked] = useState<LaukPref[] | null>(null);
  const progress = useSharedValue(0);
  useEffect(() => {
    let live = true;
    void readLaukPrefs().then((kept) => live && setPicked(kept));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    progress.value = reduced ? 1 : withTiming(1, { duration: MENCARI_MS, easing: Easing.linear });
    const timer = setTimeout(() => leave("jelajah"), MENCARI_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once; leave reads a stable runtime
  }, []);
  const bar = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const names = (picked ?? []).map((p, i) => (i ? laukName(p, t).toLowerCase() : laukName(p, t)));
  const line = [names.length ? `${names.join(", ")}.` : "", area ? t(`Antar ke ${area}.`, `Delivering to ${area}.`) : ""]
    .filter(Boolean)
    .join(" ");
  const shown = picked ?? [];
  const turn = shown.length === 1 ? [0] : shown.length === 2 ? [-6, 7] : [-6, 0, 7];
  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <Animated.View
        accessibilityRole="progressbar"
        accessibilityLabel={t("Mencari katering", "Finding caterers")}
        style={[{ position: "absolute", top, left: 0, height: 3, backgroundColor: c.forest }, bar]}
      />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 24, paddingHorizontal: 28 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {shown.map((pref, i) => {
            // The middle plate is the largest and overlaps its neighbours, as drawn.
            const middle = shown.length === 3 && i === 1;
            return (
              <View key={pref} style={{ marginHorizontal: middle ? -14 : 0, zIndex: middle ? 1 : 0, transform: [{ rotate: `${turn[i]}deg` }] }}>
                <PolishArt name={PLATE[pref]} size={middle ? 120 : 108} />
              </View>
            );
          })}
        </View>
        <View style={{ gap: 8 }}>
          <Text variant="heroTitle" accessibilityRole="header" style={{ textAlign: "center" }}>
            {t("Mencari katering untukmu…", "Finding caterers for you…")}
          </Text>
          {line ? (
            <Text variant="bodyL" testID="mencari-line" style={{ color: c.muted, textAlign: "center" }}>
              {line}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
