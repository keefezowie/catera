import { useEffect, useRef, useState } from "react";
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
  ConnectionBanner,
  FadeSwap,
  fontFor,
  HeroPager,
  MoodHeader,
  PhotoRing,
  PressableScale,
  ReadError,
  Screen,
  Skeleton,
  SkeletonGroup,
  StateArt,
  Text,
  themedStyles,
  useColors,
  useMood,
  useMoodColors,
  type MoodArcProps,
} from "@catera/mobile-ui";
import type { Mood } from "@catera/design-tokens";
import { EmptyHome, EmptyHomeBody, EmptyHomeHeader, type HomeCatalog } from "./EmptyHome";
import { HERO_OVERLAP, photoUri, Plate, sentences } from "./Plate";
import { RecapCard } from "./RecapCard";
import { StaleCopy } from "../staleCopy";
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
  const { actor, ready } = useMobile();
  // Before the session is known the page is already the first read's: its loading header and skeleton.
  if (!ready)
    return (
      <Screen header={<HomeHeader />}>
        <BerandaSkeleton />
      </Screen>
    );
  if (!actor) return <EmptyHome />;
  return <SignedInHome actorId={actor.id} />;
}

type Translate = (id: string, en: string) => string;

/** The title's line height (`title`, 30/39): the loading headline holds its second line at this height. */
const TITLE_LINE = 39;

/**
 * Says "Memperbarui…" to VoiceOver. iOS has no live regions, so the word is announced; Android's TalkBack hears it
 * from the meta row's live region instead, so it is not announced twice. `os` is the running platform.
 */
export function announceUpdating(text: string, os = process.env.EXPO_OS) {
  if (os === "ios") AccessibilityInfo.announceForAccessibility(text);
}

/** The headline's first line, the meal the mood is on: "Siang ini," or "Malam ini,". */
function openingFor(mood: Mood, t: Translate): string {
  return mood === "siang" ? t("Siang ini,", "Lunch today,") : t("Malam ini,", "Dinner tonight,");
}

/** The day arc's two ends; a null detail is a line still being read, held by a skeleton line of its height. */
function arcFor(t: Translate, lunch: string | null, dinner: string | null): MoodArcProps {
  return {
    siang: { title: t("Siang", "Lunch"), label: t("Makan siang", "Lunch"), detail: lunch },
    malam: { title: t("Malam", "Dinner"), label: t("Makan malam", "Dinner"), detail: dinner },
  };
}

/**
 * Beranda's meta row: the date (or "Berikutnya …"), and while a kept copy is being refreshed, "· Memperbarui…" after it
 * in the same row. The row is 48 high whatever it holds (a long line wraps inside it), so the word comes and goes
 * without moving the header. The word sits in a polite live region mounted from the first frame and empty while there
 * is nothing to say, so TalkBack hears it once when it appears (a region that mounts already holding its text is not
 * reliably announced).
 */
function HomeMeta({ text, updating }: { text: string; updating: string | null }) {
  const palette = useMoodColors();
  const line = { color: palette.headerMeta, lineHeight: 18, fontVariant: ["tabular-nums" as const] };
  return (
    <View testID="home-meta" style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
      <Text variant="label" style={line}>
        {updating ? `${text} · ` : text}
      </Text>
      <View testID="home-refreshing-region" accessibilityLiveRegion="polite">
        {updating ? (
          <Text testID="home-refreshing" variant="label" style={line}>
            {updating}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** What the loaded header says: the meta row, the two-line headline, each end's detail and whether a hero rides over. */
type HomeHeading = { meta: string; headline: string; arc: MoodArcProps; hero: boolean; updating: string | null };

/**
 * Beranda's mood header: the meta row, the headline and the day arc. While the first read is out (`loaded` absent) it
 * is laid out as the loaded header, so it keeps its height when the page lands: the date in the meta row (the phone
 * knows it), the meal's opening line with the second headline line held by a skeleton line of the title's height, and
 * the arc with each end's detail line held the same way. It then leaves the hero's 58, as the skeleton draws a hero.
 * The lines breathe with the data area's group, which names the wait; the header is chrome, never a progress bar. One
 * component for both, so the header (and its arc) stays mounted across the swap.
 */
function HomeHeader({ loaded }: { loaded?: HomeHeading }) {
  const { t, locale } = useMobile();
  const { mood } = useMood();
  const palette = useMoodColors();
  const today = jakartaDay(new Date());
  return (
    <MoodHeader
      meta={<HomeMeta text={loaded?.meta ?? dayLabel(today, today, locale)} updating={loaded?.updating ?? null} />}
      arc={loaded?.arc ?? arcFor(t, null, null)}
      overlap={!loaded || loaded.hero ? 58 : 0}
      title={
        loaded ? (
          <Text testID="home-title" variant="title" accessibilityRole="header" style={{ color: palette.headerText }}>
            {loaded.headline}
          </Text>
        ) : (
          <View testID="home-title-loading">
            <Text variant="title" accessibilityRole="header" style={{ color: palette.headerText }}>
              {openingFor(mood, t)}
            </Text>
            <SkeletonGroup>
              <View testID="home-title-placeholder" style={{ height: TITLE_LINE, justifyContent: "center" }}>
                <Skeleton onMood width="58%" height={28} />
              </View>
            </SkeletonGroup>
          </View>
        )
      }
    />
  );
}

/**
 * The second line of the headline for the chosen meal's plates today: the main dish of one plate (lowercased; the
 * package name, in its own casing, while the menu is not set, so an unset menu never shows a dish), the count of
 * several, or that none comes.
 */
function headlineFor(plates: PlateData[], t: Translate): string {
  if (plates.length > 1) return t(`${plates.length} pengantaran.`, `${plates.length} deliveries.`);
  const plate = plates[0];
  if (!plate) return t("tidak ada pengantaran.", "no delivery.");
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
  return start ?? t(`${plates.length} pengantaran`, plates.length === 1 ? "1 delivery" : `${plates.length} deliveries`);
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
    plates.length > 1 ? t(`${plates.length} pengantaran`, `${plates.length} deliveries`) : plate.window || "";
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
          ring={dinner ? "dinner" : "lunch"}
          accessibilityLabel={dish}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" style={{ lineHeight: 18, fontVariant: ["tabular-nums"] }}>
          {when ? `${label} · ${when}` : label}
        </Text>
        <Text style={{ fontFamily: fontFor("700") }}>{dish}</Text>
        {status ? (
          <Text testID="other-meal-status" style={{ fontFamily: fontFor("700"), color: c.charcoal }}>
            {status}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

function SignedInHome({ actorId }: { actorId: string }) {
  const { runtime, t, locale } = useMobile();
  const { mood, setMood } = useMood();
  // A launch paints the copy kept for this account first (`fromCache`); the fresh read replaces it.
  const home = useData(`home:customer`, () => loadCustomer(runtime, actorId), { cached: () => keptCustomer(actorId) });
  // Menu choices that are due; Beranda still shows without them (offline or a failed feed).
  const actions = useData("home:actions", () => runtime.api.customerActions(20).catch(() => null));
  // The pager's card in view, per meal, so a mood switch never counts the other meal's card as seen.
  const [page, setPage] = useState<{ meal: string; index: number }>({ meal: "", index: 0 });
  // Whether the "Paket selesai" recap is on the page (undefined while it reads its seen marks). Its food photo is never
  // next to a mascot: the waving one on an empty Beranda and the resting one on a quiet day stay out while it shows.
  const [recapShown, setRecapShown] = useState<boolean | undefined>(undefined);
  const state = home.data?.data;
  const now = new Date();
  const plates = state ? todayPlates(state, now) : [];
  const days = state ? upcomingDays(state, now, 3, locale) : [];
  const plans = state ? activePlans(state) : null;
  // Nothing today, nothing coming and no running plan: Beranda invites the customer to pick a package instead.
  const empty = !!state && !plates.length && !days.length && !plans?.count;
  // The suggested packages are read together with the first home read, so a customer with nothing running waits on one
  // skeleton and the page arrives in one fade. Once a read shows something running, later reloads skip the network and
  // keep the packages already read, so a reload that empties the page (the last plan cancelled) has them at once.
  const wantsCatalog = useRef(true);
  wantsCatalog.current = !state || empty;
  const keptCatalog = useRef<HomeCatalog["data"]>(null);
  const catalog = useData<HomeCatalog["data"]>("home:catalog", async () => {
    if (!wantsCatalog.current) return keptCatalog.current;
    const read = await runtime.api.catalog("?limit=3");
    keptCatalog.current = read;
    return read;
  });
  // Whether this page has shown its content (loaded or nothing running). After that a reload never brings the
  // skeleton back: the page changes in place, in one fade.
  const painted = useRef(false);
  // A plan that ended since the last read empties the page after the catalog was skipped: read it now.
  const catalogMissing = empty && !catalog.data && !catalog.loading && !catalog.error;
  useEffect(() => {
    if (catalogMissing) void catalog.reload();
  }, [catalogMissing, catalog.reload]);
  // Pulling down reads Beranda and its menu choices again; the page stays as it is until the answers land.
  const pull = usePullToRefresh(() => Promise.all([home.reload(), actions.reload()]));
  // A kept copy is on screen and the fresh read is out: "· Memperbarui…" follows the date in the meta row (see
  // HomeMeta). TalkBack reads it once through its live region; iOS has no live region, so VoiceOver hears it once,
  // announced when the refresh starts.
  const updating = !!state && home.fromCache && home.loading;
  const updatingText = t("Memperbarui…", "Updating…");
  useEffect(() => {
    if (updating) announceUpdating(updatingText);
    // Once per refresh, not again when the language changes under it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updating]);

  // Before the first answer the data area is the skeleton, in the same `FadeSwap` that will hold the page, so the page
  // enters as one block. The skeleton draws a hero, so the header leaves room for it as for a loaded one. On its first
  // load a page with nothing running keeps the skeleton until its packages are read too; a page that has shown content
  // goes straight to the invitation (its packages kept, or their own section waiting if none were ever read).
  if (!state || (!painted.current && empty && !catalog.data && !catalog.error)) {
    const failed = !state && !home.loading;
    return (
      <Screen header={failed ? <MoodHeader title={t("Beranda", "Home")} /> : <HomeHeader />}>
        <FadeSwap swapKey={failed ? "error" : "loading"} style={{ gap: 16 }}>
          {failed ? (
            // Nothing is kept on this phone to show: the failure is the page, with the way to try again.
            <View testID="home-error">
              <ReadError art message={home.error} onRetry={() => void home.reload()} />
            </View>
          ) : (
            <BerandaSkeleton />
          )}
        </FadeSwap>
      </Screen>
    );
  }

  // Plans that ended lately and were not renewed; the card itself checks whether its recap was already seen.
  const recaps = recapCandidates(state, now);
  const recap = recaps.length ? <RecapCard candidates={recaps} onShownChange={setRecapShown} /> : null;
  painted.current = true;
  if (empty)
    return (
      <Screen header={<EmptyHomeHeader />}>
        <FadeSwap swapKey="empty" style={{ gap: 16 }}>
          <EmptyHomeBody lead={recap} leadShown={recapShown} catalog={catalog} />
        </FadeSwap>
      </Screen>
    );
  // A kept copy (painted at launch, or kept because the fresh read failed) can be read but not acted on: a meal may
  // have moved or been cancelled since, so every action stays hidden until a fresh read lands.
  const savedAt = home.data?.savedAt;

  const today = jakartaDay(now);
  const meal = mood === "siang" ? "lunch" : "dinner";
  const byMeal = mealPlates(plates);
  const heroPlates = byMeal[meal];
  const otherPlates = byMeal[meal === "lunch" ? "dinner" : "lunch"];
  const headline = `${openingFor(mood, t)}\n${headlineFor(heroPlates, t)}`;
  const arc = arcFor(t, arcDetail(byMeal.lunch, t), arcDetail(byMeal.dinner, t));
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
        <HomeHeader
          loaded={{ meta, headline, arc, hero: heroPlates.length > 0, updating: updating ? updatingText : null }}
        />
      }
    >
      {/* The whole page is one block that fades in from the skeleton, and again when the fresh read replaces the copy
          kept on this phone (the key follows which of the two is on screen; a refresh of a fresh read does not fade). A
          hero rides up over the header from here, the block's own edge, so no part of the hero sits outside its
          parent's bounds (where a touch would not reach). */}
      <FadeSwap
        swapKey={savedAt ? "kept" : "fresh"}
        style={[{ gap: 16 }, heroPlates.length ? { marginTop: HERO_OVERLAP } : null]}
      >
        {/* Nothing comes today and nothing is scheduled next: the resting mascot stands where a plate would, under the
            headline that says so. A day with a plate leads with its photo and never shows the mascot. Nothing else
            sits between the mascot and the Paket selesai recap here, so it stays out while the recap's food photo
            shows; while the recap reads its seen marks the art's box is held, so the page does not move when it
            lands. */}
        {!plates.length && !days.length && (!recap || recapShown !== true) ? (
          <StateArt pose="tidur" held={!!recap && recapShown === undefined} />
        ) : null}
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
                delivery={savedAt ? undefined : state.deliveries.find((d) => d.id === p.deliveryId)}
              />
            ))}
          </HeroPager>
        ) : heroPlates.length ? (
          // One frame for the hero whichever meal it shows, so its fill cross-fades when the mood switches.
          <Plate
            key="hero"
            variant="hero"
            plate={heroPlates[0]}
            apiBase={runtime.apiBase}
            offline={!!savedAt}
            delivery={savedAt ? undefined : state.deliveries.find((d) => d.id === heroPlates[0].deliveryId)}
          />
        ) : null}
        {/* Mounted whatever the page shows: the banner reads the phone's connection itself and appears only offline,
            with the time of the copy on screen; when the phone is back it reads again. It follows the hero, which rides
            up over the header. */}
        <ConnectionBanner lastSeen={savedAt ? new Date(savedAt) : undefined} onRetry={() => void home.reload()} />
        {!savedAt && home.error ? <ReadError message={home.error} onRetry={() => void home.reload()} /> : null}
        {/* A copy kept while the phone is online means the read failed: say how old it is, never let it pass as current. */}
        <StaleCopy savedAt={savedAt} onRetry={home.reload} />
        {otherPlates.length ? (
          <OtherMealRow
            plates={otherPlates}
            apiBase={runtime.apiBase}
            onPress={() => setMood((m) => (m === "siang" ? "malam" : "siang"))}
          />
        ) : null}
        {recap}
        <WaitingList state={state} actions={actions.data?.items ?? null} offline={!!savedAt} now={now} />
        <TomorrowEntry state={state} now={now} />
        <UpcomingDays days={days} apiBase={runtime.apiBase} />
        {plans ? (
          <PlansRow count={plans.count} caterers={plans.caterers} images={plans.images} apiBase={runtime.apiBase} />
        ) : null}
      </FadeSwap>
    </Screen>
  );
}

const useStyles = themedStyles((c) => ({
  otherMeal: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12 },
}));
