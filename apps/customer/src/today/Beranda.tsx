import {
  memo,
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { AccessibilityInfo, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  activePlans,
  dayLabel,
  jakartaDay,
  mealPlates,
  recapCandidates,
  todayPlates,
  tomorrowStory,
  upcomingDays,
  type CustomerState,
  type Plate as PlateData,
} from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import {
  ConnectionBanner,
  FadeSwap,
  HeroPager,
  MoodHeader,
  ReadError,
  Screen,
  Skeleton,
  SkeletonGroup,
  StateArt,
  Text,
  useMood,
  useMoodColors,
} from "@catera/mobile-ui";
import type { Mood } from "@catera/design-tokens";
import { EmptyHome, EmptyHomeBody, EmptyHomeHeader, type HomeCatalog } from "./EmptyHome";
import { HERO_BAND_OVERLAP, HERO_BAND_RISE } from "./heroBand";
import { HeroShown, Plate, stateLabel, statementFor } from "./Plate";
import { StatusStops, StatusStopsPlaceholder, type StopInfo } from "./StatusStops";
import { RecapCard } from "./RecapCard";
import { StaleCopy } from "../staleCopy";
import { LiveSlot } from "./LiveSlot";
import { UpcomingDays } from "./UpcomingDays";
import { PlansRow } from "./PlansRow";
import { BerandaSkeleton } from "../skeletons";
import { usePullToRefresh } from "../refresh";
import { keptCustomer, loadCustomer } from "./customerRead";

// The band's overlap lives in `heroBand.ts` so the skeleton can read it without importing this screen back.
export { HERO_BAND_OVERLAP };

/**
 * Beranda: today's plate (or plates), the one thing that waits on the customer (a live slot), the next days (at most
 * three) and the running plans, each block 32 under the last.
 */
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

/**
 * Beranda's meta row: the sun or the moon of the chosen meal, the date (or "Berikutnya …"), and while a kept copy is being
 * refreshed, "· Memperbarui…" after it in the same row. The row is 36 high whatever it holds (a long line wraps inside
 * it), so the word comes and goes without moving the band. The word sits in a polite live region mounted from the first
 * frame and empty while there is nothing to say, so TalkBack hears it once when it appears (a region that mounts
 * already holding its text is not reliably announced).
 */
function HomeMeta({ text, updating }: { text: string; updating: string | null }) {
  const palette = useMoodColors();
  const { mood } = useMood();
  const line = { color: palette.headerMeta, fontVariant: ["tabular-nums" as const] };
  return (
    <View testID="home-meta" style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
      <View
        testID="home-meta-glyph"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ marginRight: 6 }}
      >
        <Ionicons name={mood === "siang" ? "sunny" : "moon"} size={18} color={palette.headerMeta} />
      </View>
      <Text variant="meta" style={line}>
        {updating ? `${text} · ` : text}
      </Text>
      <View testID="home-refreshing-region" accessibilityLiveRegion="polite">
        {updating ? (
          <Text testID="home-refreshing" variant="meta" style={line}>
            {updating}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** What the loaded band says: the meta row, the one-line statement, the status line and whether a hero rides over it. */
type HomeHeading = {
  meta: string;
  statement: string;
  /** The two stops of the status line under the statement. */
  stops: { lunch: StopInfo; dinner: StopInfo };
  hero: boolean;
  updating: string | null;
};

/**
 * Beranda's mood band: the date line (`meta`, with the sun or the moon), the day statement in `section` and, 12 under it,
 * the two-stop status line (a 40 row). While the
 * first read is out (`loaded` absent) it is laid out as the loaded band, so it keeps its height when the page lands: the
 * date in the meta row (the phone knows it) and the meal's opening line with a skeleton line after it, one `section`
 * line high like the statement, and the status line by its placeholder row. It leaves the same 104 for the hero as the
 * skeleton draws one. The line breathes with
 * the data area's group, which names the wait; the band is chrome, never a progress bar. One component for both, so the
 * band stays mounted across the swap.
 */
function HomeHeader({ loaded }: { loaded?: HomeHeading }) {
  const { t, locale } = useMobile();
  const { mood } = useMood();
  const palette = useMoodColors();
  const today = jakartaDay(new Date());
  return (
    <MoodHeader
      band
      meta={<HomeMeta text={loaded?.meta ?? dayLabel(today, today, locale)} updating={loaded?.updating ?? null} />}
      overlap={!loaded || loaded.hero ? HERO_BAND_OVERLAP : 0}
      title={
        loaded ? (
          <Text testID="home-title" variant="section" accessibilityRole="header" style={{ color: palette.headerText }}>
            {loaded.statement}
          </Text>
        ) : (
          <View testID="home-title-loading" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text variant="section" accessibilityRole="header" style={{ color: palette.headerText }}>
              {openingFor(mood, t)}
            </Text>
            <SkeletonGroup>
              <View testID="home-title-placeholder" style={{ height: 26, flex: 1, justifyContent: "center" }}>
                <Skeleton onMood width="58%" height={16} />
              </View>
            </SkeletonGroup>
          </View>
        )
      }
    >
      {/* 12 under the statement (the band's own gap is 4): the Siang/Malam pill, 60 tall. */}
      <View style={{ marginTop: 8 }}>
        {loaded ? (
          <StatusStops lunch={loaded.stops.lunch} dinner={loaded.stops.dinner} />
        ) : (
          <SkeletonGroup>
            <StatusStopsPlaceholder />
          </SkeletonGroup>
        )}
      </View>
    </MoodHeader>
  );
}

/**
 * The band's statement for the shown meal's plates today: its state when one plate comes ("Makan siang sedang diantar."),
 * the count of several, or that none comes. It never names the dish: the hero's title does.
 */
function statementLine(plates: PlateData[], mood: Mood, t: Translate): string {
  if (plates.length > 1) return `${openingFor(mood, t)} ${t(`${plates.length} pengantaran.`, `${plates.length} deliveries.`)}`;
  if (plates.length === 1) return statementFor(plates[0], t);
  return `${openingFor(mood, t)} ${t("tidak ada pengantaran.", "no delivery.")}`;
}

/** Plates that need the customer now. The mood must not hide them behind the other meal's hero. */
const NEEDS_YOU: PlateData["state"][] = ["due", "on_the_way", "failed"];

/**
 * One stop of the status line. A meal with no plate says "Tidak ada". Otherwise its label carries the window of its one
 * plate. The shown meal's state line is its plate's short state ("Sedang diantar", "Terjadwal", "Sudah sampai"), or the
 * count when several plates fill the pager. The other meal shows the first plate's main dish (the package name while its
 * menu is not set, the headline's rule), or, when a plate of it needs the customer (it should have arrived, is on the
 * way, or failed), that plate's state, so "needs you now" stays visible behind the mood. The actions are one tap away,
 * on the hero.
 */
function stopFor(plates: PlateData[], chosen: boolean, t: Translate): StopInfo {
  if (!plates.length) return { window: null, state: t("Tidak ada", "None") };
  const first = plates[0];
  const waiting = plates.find((p) => NEEDS_YOU.includes(p.state));
  const count = t(`${plates.length} pengantaran`, plates.length === 1 ? "1 delivery" : `${plates.length} deliveries`);
  let state: string;
  if (chosen) state = plates.length > 1 ? count : stateLabel(first, t);
  else if (waiting) state = stateLabel(waiting, t);
  else state = plates.length > 1 ? count : (first.lead ?? first.packageName);
  return { window: plates.length === 1 ? first.window || null : null, state };
}

/** Tomorrow's deliveries in the story's order: its block in Berikutnya opens the story at the part it shows. */
function tomorrowOf(story: ReturnType<typeof tomorrowStory>) {
  return story ? { date: story.date, parts: story.parts } : null;
}

function SignedInHome({ actorId }: { actorId: string }) {
  const { runtime, t, locale } = useMobile();
  const { mood } = useMood();
  // A launch paints the copy kept for this account first (`fromCache`); the fresh read replaces it.
  const home = useData(`home:customer`, () => loadCustomer(runtime, actorId), { cached: () => keptCustomer(actorId) });
  // Menu choices that are due; Beranda still shows without them (offline or a failed feed).
  const actions = useData("home:actions", () => runtime.api.customerActions(20));
  // The pager's card in view, per meal, so a mood switch never counts the other meal's card as seen.
  const [pages, setPages] = useState<Record<Meal, number>>({ lunch: 0, dinner: 0 });
  // Whether the "Paket selesai" recap is on the page (undefined while it reads its seen marks). Its food photo is never
  // next to a mascot: the waving one on an empty Beranda and the resting one on a quiet day stay out while it shows.
  const [recapShown, setRecapShown] = useState<boolean | undefined>(undefined);
  const state = home.data?.data;
  // Everything read from the day is the same for both meals: it is worked out when the read changes or the minute turns,
  // never again for a switch.
  const minute = Math.floor(Date.now() / 60_000);
  const day = useMemo(() => {
    const now = new Date();
    const plates = state ? todayPlates(state, now) : [];
    return {
      now,
      plates,
      byMeal: mealPlates(plates),
      days: state ? upcomingDays(state, now, 3, locale) : [],
      plans: state ? activePlans(state) : null,
      recaps: state ? recapCandidates(state, now) : [],
      tomorrow: tomorrowOf(state ? tomorrowStory(state, now, locale) : null),
    };
    // `minute` re-reads the clock once a minute; the read itself is `state`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, minute, locale]);
  // The other meal's hero mounts just after the first paint, as an interruptible transition, so its first switch is as
  // quick as the next ones (its photo is already on the phone, too).
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    if (state && !warm) startTransition(() => setWarm(true));
  }, [state, warm]);
  const { now, plates, days, plans } = day;
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
  const recap = day.recaps.length ? <RecapCardM candidates={day.recaps} onShownChange={setRecapShown} /> : null;
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
  const { byMeal } = day;
  // The mood switches the page in the same render as the band (a deferred page swap was slower on the release build,
  // gate g-c-14); what makes it quick is that nothing under the band is built again for a switch.
  const meal: Meal = mood === "siang" ? "lunch" : "dinner";
  const heroPlates = byMeal[meal];
  const otherPlates = byMeal[meal === "lunch" ? "dinner" : "lunch"];
  const statement = statementLine(heroPlates, mood, t);
  const stops = {
    lunch: stopFor(byMeal.lunch, meal === "lunch", t),
    dinner: stopFor(byMeal.dinner, meal === "dinner", t),
  };
  const next = days[0];
  const nextLabel = next?.label ?? "";
  // "Berikutnya" names a later day, so it is only true when nothing else is left today.
  const laterToday = otherPlates.some((p) => !["arrived", "failed", "reported"].includes(p.state));
  const meta =
    !heroPlates.length && !laterToday && next
      ? t(`Berikutnya ${nextLabel}`, `Next ${nextLabel}`)
      : dayLabel(today, today, locale);

  return (
    <Screen
      refreshControl={pull}
      header={
        <HomeHeader
          loaded={{ meta, statement, stops, hero: heroPlates.length > 0, updating: updating ? updatingText : null }}
        />
      }
    >
      {/* The whole page is one block that fades in from the skeleton, and again when the fresh read replaces the copy
          kept on this phone (the key follows which of the two is on screen; a refresh of a fresh read does not fade). A
          hero rides up over the header from here, the block's own edge, so no part of the hero sits outside its
          parent's bounds (where a touch would not reach). */}
      <FadeSwap
        swapKey={savedAt ? "kept" : "fresh"}
        style={[{ gap: 16 }, heroPlates.length ? { marginTop: HERO_BAND_RISE } : null]}
      >
        {/* Nothing comes today and nothing is scheduled next: the resting mascot stands where a plate would, under the
            headline that says so. A day with a plate leads with its photo and never shows the mascot. Nothing else
            sits between the mascot and the Paket selesai recap here, so it stays out while the recap's food photo
            shows; while the recap reads its seen marks the art's box is held, so the page does not move when it
            lands. */}
        {!plates.length && !days.length && (!recap || recapShown !== true) ? (
          <StateArt pose="tidur" held={!!recap && recapShown === undefined} />
        ) : null}
        {/* Both meals' heroes stay mounted and a switch only shows the other one, so it lands at once, photo included:
            nothing is built, measured or downloaded at the tap. The hidden one is out of the layout and out of the
            screen reader's reach, and its journey is never counted as seen. */}
        {MEALS.map((m) =>
          m === meal || warm ? (
            <MealHero
              key={m}
              meal={m}
              plates={byMeal[m]}
              visible={m === meal}
              inView={pages[m]}
              onPage={setPages}
              state={state}
              savedAt={savedAt}
              apiBase={runtime.apiBase}
            />
          ) : null,
        )}
        {/* Mounted whatever the page shows: the banner reads the phone's connection itself and appears only offline,
            with the time of the copy on screen; when the phone is back it reads again. It follows the hero, which rides
            up over the header. */}
        <ConnectionBanner lastSeen={savedAt ? new Date(savedAt) : undefined} onRetry={() => void home.reload()} />
        {!savedAt && home.error ? <ReadError message={home.error} onRetry={() => void home.reload()} /> : null}
        {/* A copy kept while the phone is online means the read failed: say how old it is, never let it pass as current. */}
        <StaleCopy savedAt={savedAt} onRetry={home.reload} />
        {recap}
        {/* The menu choices that are due did not load: the rest of the section stands, and this line retries that read only.
            Offline the connection banner already speaks, and a feed read earlier keeps its rows. */}
        {!savedAt && actions.error && !actions.data ? (
          <ReadError message={t(
            "Belum bisa memuat menu yang perlu dipilih. Cek koneksi lalu coba lagi.",
            "Couldn't load the menus waiting for a choice. Check your connection and try again.",
          )} onRetry={() => void actions.reload()} />
        ) : null}
        <LiveSlotM state={state} actions={actions.data?.items ?? null} offline={!!savedAt} now={now} />
        <UpcomingDaysM days={days} apiBase={runtime.apiBase} tomorrow={day.tomorrow} />
        <PlansRowM subscriptions={state.subscriptions} today={today} apiBase={runtime.apiBase} />
      </FadeSwap>
    </Screen>
  );
}

type Meal = "lunch" | "dinner";
const MEALS = ["lunch", "dinner"] as const satisfies readonly Meal[];

// The sections under the hero do not depend on the meal, so a switch does not render them again.
const LiveSlotM = memo(LiveSlot);
const UpcomingDaysM = memo(UpcomingDays);
const PlansRowM = memo(PlansRow);
const RecapCardM = memo(RecapCard);

/**
 * The other meal's hero: laid over the shown one at no opacity, out of the flow (no gap, no height), untouchable and out
 * of the screen reader's tree. Not `display: "none"`: Fabric does not mount a hidden subtree, so showing it would create
 * every photo and tracker view at the tap; this way a switch only changes two styles.
 */
const OFFSTAGE = { position: "absolute", top: 0, left: 0, right: 0, opacity: 0 } as const;

/**
 * One meal's hero: a pager when the meal has several deliveries today, else one hero card, else nothing. Hidden, it stays
 * mounted offstage (see `OFFSTAGE`), out of the layout and out of the screen reader's tree. Whether it is
 * shown reaches the plates through `HeroShown`, so a switch re-renders only their journey count; `Plate` is memoised.
 */
const MealHero = memo(function MealHero({
  meal,
  plates,
  visible,
  inView,
  onPage,
  state,
  savedAt,
  apiBase,
}: {
  meal: Meal;
  plates: PlateData[];
  visible: boolean;
  inView: number;
  onPage: Dispatch<SetStateAction<Record<Meal, number>>>;
  state: CustomerState;
  savedAt: string | null | undefined;
  apiBase: string;
}) {
  const { t } = useMobile();
  if (!plates.length) return null;
  const mealName = meal === "lunch" ? t("Makan siang", "Lunch") : t("Makan malam", "Dinner");
  const frame = {
    testID: `hero-${meal}`,
    style: visible ? null : OFFSTAGE,
    pointerEvents: visible ? ("auto" as const) : ("none" as const),
    accessibilityElementsHidden: !visible,
    importantForAccessibility: visible ? ("auto" as const) : ("no-hide-descendants" as const),
  };
  const deliveryOf = (p: PlateData) => (savedAt ? undefined : state.deliveries.find((d) => d.id === p.deliveryId));
  if (plates.length === 1)
    return (
      <View {...frame}>
        <HeroShown value={visible}>
          <Plate variant="hero" plate={plates[0]} apiBase={apiBase} offline={!!savedAt} delivery={deliveryOf(plates[0])} />
        </HeroShown>
      </View>
    );
  // Several deliveries of the meal: equal heroes, one at a time, the next one peeking.
  return (
    <View {...frame}>
      <HeroShown value={visible}>
        <HeroPager
          count={plates.length}
          // TalkBack reads "Makan siang, 1 dari 2, Dapur Senja": the meal names the control, and the position with the
          // card's kitchen is its value, which the platform speaks again after each move.
          accessibilityLabelFor={() => mealName}
          accessibilityValueFor={(i) =>
            t(
              `${i + 1} dari ${plates.length}, ${plates[i]?.catererName ?? ""}`,
              `${i + 1} of ${plates.length}, ${plates[i]?.catererName ?? ""}`,
            )
          }
          counterLabel={(i) => t(`${i + 1} dari ${plates.length}`, `${i + 1} of ${plates.length}`)}
          onIndexChange={(index) => onPage((pages) => ({ ...pages, [meal]: index }))}
        >
          {plates.map((p, i) => (
            <Plate
              key={`${p.deliveryId}:${p.meal}`}
              variant="hero"
              counted={i === inView}
              plate={p}
              apiBase={apiBase}
              offline={!!savedAt}
              delivery={deliveryOf(p)}
            />
          ))}
        </HeroPager>
      </HeroShown>
    </View>
  );
});
