import { useEffect, useState } from "react";
import { AccessibilityInfo, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import {
  activePlans,
  dayLabel,
  jakartaDay,
  mealPlates,
  recapCandidates,
  todayPlates,
  upcomingDays,
  type CustomerState,
  type Plate as PlateData,
} from "@catera/domain";
import { useData, useMobile, type MobileRuntime } from "@catera/mobile-core";
import {
  Button,
  FadeSwap,
  fontFor,
  HeroPager,
  MoodHeader,
  PhotoRing,
  PressableScale,
  Screen,
  Text,
  themedStyles,
  useColors,
  useMood,
  useMoodColors,
} from "@catera/mobile-ui";
import { EmptyHome } from "./EmptyHome";
import { HERO_OVERLAP, jakartaClock, photoUri, Plate, sentences } from "./Plate";
import { RecapCard } from "./RecapCard";
import { WaitingList } from "./WaitingList";
import { UpcomingDays } from "./UpcomingDays";
import { PlansRow } from "./PlansRow";
import { TomorrowEntry } from "../tomorrow/TomorrowRow";
import { BerandaSkeleton } from "../skeletons";
import { usePullToRefresh } from "../refresh";
import { forgetCachedCustomer, loadCachedCustomer, saveCachedCustomer } from "./offline";

/** A customer read; `savedAt` is set when it is the copy this phone kept, not a fresh answer. */
type LoadedCustomer = { data: CustomerState; savedAt: string | null };

/**
 * Whether this phone still holds `actorId`'s session. Logout deletes the stored actor first, before it forgets the kept
 * copies and signs out, so a missing or different stored actor means the session this read began in has ended.
 */
async function stillSignedIn(runtime: MobileRuntime, actorId: string): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(runtime.storageKey("actor")).catch(() => null);
  try {
    return !!stored && (JSON.parse(stored) as { id?: string }).id === actorId;
  } catch {
    return false;
  }
}

/**
 * Keeps a fresh read for the next launch, only while its session lasts. A read still out when the person taps Keluar
 * must not write back the copy logout just forgot: it is not saved once the session has ended, and a save that raced
 * logout's first step is taken back. (A save that lands before logout deletes the stored actor is cleared by logout
 * itself, which forgets the copies after that step.)
 */
async function keepCustomer(runtime: MobileRuntime, actorId: string, data: CustomerState): Promise<void> {
  if (!(await stillSignedIn(runtime, actorId))) return;
  await saveCachedCustomer(actorId, { savedAt: new Date().toISOString(), data });
  if (!(await stillSignedIn(runtime, actorId))) await forgetCachedCustomer(actorId);
}

async function loadCustomer(runtime: MobileRuntime, actorId: string): Promise<LoadedCustomer> {
  try {
    const data = await runtime.api.customer();
    await keepCustomer(runtime, actorId, data);
    return { data, savedAt: null };
  } catch (e) {
    const cached = await keptCustomer(actorId);
    if (cached) return cached;
    throw e;
  }
}

/** The last confirmed read this phone kept for this account, painted at launch while the fresh read runs. */
async function keptCustomer(actorId: string): Promise<LoadedCustomer | null> {
  const cached = await loadCachedCustomer(actorId);
  return cached ? { data: cached.data, savedAt: cached.savedAt } : null;
}

/** Beranda: today's plate (or plates), what waits on the customer, the next days and the running plans. */
export function Beranda() {
  const { actor, ready, t } = useMobile();
  // The header leaves the hero's 58 for the skeleton, as it does for a loaded hero.
  if (!ready)
    return (
      <Screen header={<MoodHeader title={t("Beranda", "Home")} overlap={58} />}>
        <BerandaSkeleton />
      </Screen>
    );
  if (!actor) return <EmptyHome />;
  return <SignedInHome actorId={actor.id} />;
}

type Translate = (id: string, en: string) => string;

/**
 * Says "Memperbarui…" to VoiceOver. iOS has no live regions, so the line is announced; Android's TalkBack hears it
 * from the header's live region instead, so it is not announced twice. `os` is the running platform.
 */
export function announceUpdating(text: string, os = process.env.EXPO_OS) {
  if (os === "ios") AccessibilityInfo.announceForAccessibility(text);
}

/**
 * Beranda's headline in the mood header ("Beranda" while it first loads), with the "Memperbarui…" line under it while
 * a kept copy is being refreshed. The polite live region is mounted from the first frame, empty and zero-high when
 * there is nothing to say, so TalkBack hears the line once when it appears (a region that mounts already holding its
 * text is not reliably announced).
 */
function HomeTitle({ text, updating }: { text: string; updating: string | null }) {
  const palette = useMoodColors();
  return (
    <View>
      <Text testID="home-title" variant="title" accessibilityRole="header" style={{ color: palette.headerText }}>
        {text}
      </Text>
      <View testID="home-refreshing-region" accessibilityLiveRegion="polite">
        {updating ? (
          <Text testID="home-refreshing" variant="caption" style={{ marginTop: 4, color: palette.headerMeta }}>
            {updating}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * The second line of the headline for the chosen meal's plates today: the main dish of one plate (lowercased; the
 * package name, in its own casing, while the menu is not set, so an unset menu never shows a dish), the count of
 * several, or that none comes.
 */
function headlineFor(plates: PlateData[], t: Translate): string {
  if (plates.length > 1) return t(`${plates.length} antaran.`, `${plates.length} deliveries.`);
  const plate = plates[0];
  if (!plate) return t("tidak ada antaran.", "no delivery.");
  return `${plate.lead?.toLowerCase() ?? plate.packageName}.`;
}

/**
 * The line under one end of the day arc: when the meal's one delivery today comes (its window start, "11.00"), how
 * many come when there are several, or that none does. A window that does not start with a time falls back to the
 * count, so the line never shows a time the caterer did not set.
 */
function arcDetail(plates: PlateData[], t: Translate): string {
  if (!plates.length) return t("Tidak ada", "None");
  const start = plates.length === 1 ? windowStart(plates[0].window) : null;
  return start ?? t(`${plates.length} antaran`, plates.length === 1 ? "1 delivery" : `${plates.length} deliveries`);
}

/** "11.00" from a window such as "11.00–13.00"; null when the window does not start with a time. */
function windowStart(window: string): string | null {
  const m = /^\s*(\d{1,2})[.:](\d{2})\s*[–-]/.exec(window);
  return m ? `${m[1].padStart(2, "0")}.${m[2]}` : null;
}

/** Plates that need the customer now. The mood must not hide them behind the other meal's hero. */
const NEEDS_YOU: PlateData["state"][] = ["due", "on_the_way", "failed"];

/**
 * The compact row for the meal the mood is not on: its ring, when it comes ("Malam ini · 17.00–19.00") or how many
 * come ("Siang ini · 2 antaran"), and the first plate's main dish (the package name while its menu is not set, the
 * headline's rule). One tap switches to it. When a plate of that meal needs the customer (it should have arrived, is on
 * the way, or failed), its status sentence shows here too, so "needs you now" stays visible; the actions are one tap
 * away, on the hero.
 */
function OtherMealRow({ plates, apiBase, onPress }: { plates: PlateData[]; apiBase: string; onPress: () => void }) {
  const { t } = useMobile();
  const c = useColors();
  const styles = useStyles();
  const plate = plates[0];
  const dinner = plate.meal === "dinner";
  const label = dinner ? t("Malam ini", "Dinner tonight") : t("Siang ini", "Lunch today");
  const when =
    plates.length > 1 ? t(`${plates.length} antaran`, `${plates.length} deliveries`) : plate.window || "";
  const dish = plate.lead ?? plate.packageName;
  const waiting = plates.find((p) => NEEDS_YOU.includes(p.state));
  const status = waiting ? sentences(waiting, t)[0] : "";
  return (
    <PressableScale
      testID="other-meal-row"
      accessibilityRole="button"
      haptic="select"
      onPress={onPress}
      style={styles.otherMeal}
    >
      {/* The row is the button and speaks for the ring. */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <PhotoRing
          uri={photoUri(plate.image, apiBase)}
          size={54}
          ring={dinner ? "forest" : "sunrise"}
          accessibilityLabel={dish}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" style={{ lineHeight: 18, fontVariant: ["tabular-nums"] }}>
          {when ? `${label} · ${when}` : label}
        </Text>
        <Text style={{ fontFamily: fontFor("700") }}>{dish}</Text>
        {status ? (
          <Text testID="other-meal-status" style={{ fontFamily: fontFor("700"), color: c.sunriseInk }}>
            {status}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

function SignedInHome({ actorId }: { actorId: string }) {
  const { runtime, t, locale } = useMobile();
  const c = useColors();
  const { mood, setMood } = useMood();
  const palette = useMoodColors();
  // A launch paints the copy kept for this account first (`fromCache`); the fresh read replaces it.
  const home = useData(`home:customer`, () => loadCustomer(runtime, actorId), { cached: () => keptCustomer(actorId) });
  // Menu choices that are due; Beranda still shows without them (offline or a failed feed).
  const actions = useData("home:actions", () => runtime.api.customerActions(20).catch(() => null));
  // The pager's card in view, per meal, so a mood switch never counts the other meal's card as seen.
  const [page, setPage] = useState<{ meal: string; index: number }>({ meal: "", index: 0 });
  const state = home.data?.data;
  const now = new Date();
  // Pulling down reads Beranda and its menu choices again; the page stays as it is until the answers land.
  const pull = usePullToRefresh(() => Promise.all([home.reload(), actions.reload()]));
  // A kept copy is on screen and the fresh read is out: "Memperbarui…" sits in the header, under the headline (see
  // HomeTitle). TalkBack reads it once through its live region; iOS has no live region, so VoiceOver hears it once,
  // announced when the refresh starts.
  const updating = !!state && home.fromCache && home.loading;
  const updatingText = t("Memperbarui…", "Updating…");
  useEffect(() => {
    if (updating) announceUpdating(updatingText);
    // Once per refresh, not again when the language changes under it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updating]);

  // Before the first answer the data area is the skeleton, in the same `FadeSwap` that will hold the page, so the page
  // enters as one block. The skeleton draws a hero, so the header leaves room for it as for a loaded one.
  if (!state)
    return (
      <Screen
        header={
          <MoodHeader
            title={<HomeTitle text={t("Beranda", "Home")} updating={null} />}
            overlap={home.loading ? 58 : 0}
          />
        }
      >
        <FadeSwap swapKey={home.loading ? "loading" : "error"} style={{ gap: 16 }}>
          {home.loading ? (
            <BerandaSkeleton />
          ) : (
            <View style={{ gap: 4, alignItems: "flex-start" }}>
              <Text selectable testID="home-error" style={{ color: c.danger }}>
                {home.error}
              </Text>
              <Button variant="text" label={t("Coba lagi", "Try again")} onPress={() => void home.reload()} />
            </View>
          )}
        </FadeSwap>
      </Screen>
    );

  const plates = todayPlates(state, now);
  const days = upcomingDays(state, now, 3, locale);
  const plans = activePlans(state);
  // Plans that ended lately and were not renewed; the card itself checks whether its recap was already seen.
  const recaps = recapCandidates(state, now);
  const recap = recaps.length ? <RecapCard candidates={recaps} /> : null;
  if (!plates.length && !days.length && !plans.count) return <EmptyHome lead={recap} />;
  // A kept copy (painted at launch, or kept because the fresh read failed) can be read but not acted on: a meal may
  // have moved or been cancelled since, so every action stays hidden until a fresh read lands.
  const savedAt = home.data?.savedAt;

  const today = jakartaDay(now);
  const meal = mood === "siang" ? "lunch" : "dinner";
  const byMeal = mealPlates(plates);
  const heroPlates = byMeal[meal];
  const otherPlates = byMeal[meal === "lunch" ? "dinner" : "lunch"];
  const opening = mood === "siang" ? t("Siang ini,", "Lunch today,") : t("Malam ini,", "Dinner tonight,");
  const headline = `${opening}\n${headlineFor(heroPlates, t)}`;
  const arc = {
    siang: { title: t("Siang", "Lunch"), label: t("Makan siang", "Lunch"), detail: arcDetail(byMeal.lunch, t) },
    malam: { title: t("Malam", "Dinner"), label: t("Makan malam", "Dinner"), detail: arcDetail(byMeal.dinner, t) },
  };
  const next = days[0];
  const nextLabel = next?.label ?? "";
  // "Berikutnya" names a later day, so it is only true when nothing else is left today.
  const laterToday = otherPlates.some((p) => !["arrived", "failed", "reported"].includes(p.state));
  const meta =
    !heroPlates.length && !laterToday && next
      ? t(`Berikutnya ${nextLabel}`, `Next ${nextLabel}`)
      : dayLabel(today, today, locale);
  const mealName = meal === "lunch" ? t("Makan siang", "Lunch") : t("Makan malam", "Dinner");
  const inView = page.meal === meal ? page.index : 0;

  return (
    <Screen
      refreshControl={pull}
      header={
        <MoodHeader
          meta={meta}
          arc={arc}
          overlap={heroPlates.length ? 58 : 0}
          title={<HomeTitle text={headline} updating={updating ? updatingText : null} />}
        />
      }
    >
      {/* The whole page is one block that fades in from the skeleton. A hero rides up over the header from here, the
          block's own edge, so no part of the hero sits outside its parent's bounds (where a touch would not reach). */}
      <FadeSwap swapKey="ready" style={[{ gap: 16 }, heroPlates.length ? { marginTop: HERO_OVERLAP } : null]}>
        {heroPlates.length > 1 ? (
          // Several deliveries of the chosen meal: equal heroes, one at a time, the next one peeking.
          <HeroPager
            key={`pager:${meal}`}
            count={heroPlates.length}
            // TalkBack reads "Makan siang, 1 dari 2, Dapur Senja": the meal names the control, and the position with the
            // card's kitchen is its value, which the platform speaks again after each move.
            accessibilityLabelFor={() => mealName}
            accessibilityValueFor={(i) =>
              t(
                `${i + 1} dari ${heroPlates.length}, ${heroPlates[i]?.catererName ?? ""}`,
                `${i + 1} of ${heroPlates.length}, ${heroPlates[i]?.catererName ?? ""}`,
              )
            }
            counterLabel={(i) => t(`${i + 1} dari ${heroPlates.length}`, `${i + 1} of ${heroPlates.length}`)}
            onIndexChange={(index) => setPage({ meal, index })}
          >
            {heroPlates.map((p, i) => (
              <Plate
                key={`${p.deliveryId}:${p.meal}`}
                variant="hero"
                paged
                counted={i === inView}
                plate={p}
                apiBase={runtime.apiBase}
                offline={!!savedAt}
              />
            ))}
          </HeroPager>
        ) : heroPlates.length ? (
          // One frame for the hero whichever meal it shows, so its fill cross-fades when the mood switches.
          <Plate key="hero" variant="hero" plate={heroPlates[0]} apiBase={runtime.apiBase} offline={!!savedAt} />
        ) : null}
        {updating ? null : savedAt ? (
          <Text variant="caption" style={{ color: c.sunriseInk, fontVariant: ["tabular-nums"] }}>
            {t("Terakhir diperbarui", "Last updated")} {jakartaClock(savedAt)} ·{" "}
            {t("tidak ada koneksi", "no connection")}
          </Text>
        ) : home.error ? (
          <Text selectable variant="caption" style={{ color: c.danger }}>
            {home.error}
          </Text>
        ) : null}
        {otherPlates.length ? (
          <OtherMealRow
            plates={otherPlates}
            apiBase={runtime.apiBase}
            onPress={() => setMood(mood === "siang" ? "malam" : "siang")}
          />
        ) : null}
        {recap}
        <WaitingList state={state} actions={actions.data?.items ?? null} offline={!!savedAt} now={now} />
        <TomorrowEntry state={state} now={now} />
        <UpcomingDays days={days} apiBase={runtime.apiBase} />
        <PlansRow count={plans.count} caterers={plans.caterers} images={plans.images} apiBase={runtime.apiBase} />
      </FadeSwap>
    </Screen>
  );
}

const useStyles = themedStyles((c) => ({
  otherMeal: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12 },
}));
