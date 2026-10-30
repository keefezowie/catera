import { useEffect, useRef, useState } from "react";
import { RefreshControl, View } from "react-native";
import { router } from "expo-router";
import {
  errorLabel,
  jakartaDay,
  kitchenDayDone,
  kitchenSession,
  sessionStart,
  shortDate,
  weekdayName,
  type DeliveryIssue,
  type KitchenMeal,
  type KitchenSession,
  type SellerOperationsState,
} from "@catera/domain";
import { useData, useMobile, useTrack, type MobileRuntime, plural } from "@catera/mobile-core";
import {
  Button,
  Card,
  ConnectionBanner,
  DecorativeIcon,
  FadeSwap,
  FigureStrip,
  MoodHeader,
  PressableRow,
  Screen,
  StateArt,
  Text,
  useColors,
  useConfirm,
  useToast,
  useHaptic,
  useMood,
  useMoodColors,
} from "@catera/mobile-ui";
import { BatchProgress } from "./BatchProgress";
import { jakartaClock } from "./exceptions";
import { cacheSession, loadCachedDay, saveCachedDay } from "./offline";
import { SelectionBar } from "./SelectionBar";
import { useStopSelection } from "./selection";
import { SessionCard } from "./SessionCard";
import { useTicks } from "./ticks";
import { WEEK_DAYS, WeekStrip, weekOffset } from "./WeekStrip";
import { useRouteView } from "./DeliveryOrder";
import { LiveSlot } from "./LiveSlot";
import { ACTION, CAPTION_RESERVE, FIGURE_GAP, FIGURE_TOP, SECTION_GAP } from "./rows";
import { belanjaRange, weekRange } from "./belanja";
import { belanjaHref } from "../hrefs";
import { ReadError } from "../ReadError";
import { TodayCountSkeleton, TodaySkeleton } from "../skeletons";

/** A day's read; `savedAt` is set when it is the copy this phone kept, not a fresh answer. */
type LoadedDay = { data: SellerOperationsState; savedAt: string | null };

async function loadDay(runtime: MobileRuntime, actorId: string, catererId: string, date: string): Promise<LoadedDay> {
  // Taken before the read: if the session ends while it runs, its answer is not kept for the next person on the phone.
  const session = cacheSession();
  try {
    const data = await runtime.api.sellerOperations(catererId, date);
    await saveCachedDay(actorId, catererId, date, { savedAt: new Date().toISOString(), data }, session);
    return { data, savedAt: null };
  } catch (error) {
    const cached = await keptDay(actorId, catererId, date);
    if (cached) return cached;
    throw error;
  }
}

/** The last confirmed day this phone kept for this account and kitchen, painted at launch while the fresh read runs. */
async function keptDay(actorId: string, catererId: string, date: string): Promise<LoadedDay | null> {
  const cached = await loadCachedDay(actorId, catererId, date);
  return cached ? { data: cached.data, savedAt: cached.savedAt } : null;
}

/**
 * The session's headline figures in the header, under the date: porsi (the lead), paket and alamat in one strip, with
 * when the first window opens as its subline, and the batch progress under it (how many stops have arrived, are on the way
 * or are cooking; nothing while every row is still scheduled).
 * The strip is the theme's surface, which is also the hero surface of both moods, so it needs no fill of its own and
 * does not cross-fade with the header. The mascot is not here (it stays on the done and empty cards).
 */
function HeaderFigures({ ops, session }: { ops: SellerOperationsState; session: KitchenSession }) {
  const { t } = useMobile();
  const { meal, portions, addresses } = session;
  // The window opens with the first row still being served: a failed or cancelled row's hours do not count.
  const served = new Set(session.stops.map((s) => s.deliveryId));
  const start = sessionStart({ ...ops, deliveries: ops.deliveries.filter((d) => served.has(d.id)) }, meal);
  return (
    <View testID="session-count" style={{ gap: FIGURE_GAP, marginTop: FIGURE_TOP }}>
      <FigureStrip
        testID="session-figures"
        lead
        cells={[
          { label: t("porsi", "portions"), value: String(portions) },
          { label: t("paket", "packages"), value: String(session.recap.byPackage.length) },
          { label: t("alamat", "addresses"), value: String(addresses) },
        ]}
        subline={start ? t(`Antar ${start}`, `Delivery ${start}`) : undefined}
      />
      <BatchProgress session={session} />
    </View>
  );
}

/**
 * The way into Belanja 7 hari, under the header on every day of the strip, for the owner and the helper alike: one
 * surface card holding a 48+ row, the basket glyph, "Belanja 7 hari" over the range it covers (today and the six days
 * after, the recap's own range), and a chevron. It reads nothing itself, so it is there before the day answers and
 * stays put when the day, the meal or the stage changes.
 */
function BelanjaEntry() {
  const { t, locale } = useMobile();
  const c = useColors();
  const range = weekRange(belanjaRange(new Date()), locale);
  const title = t("Belanja 7 hari", "Shopping, 7 days");
  const detail = t(`Porsi per menu, ${range}`, `Portions per dish, ${range}`);
  return (
    <Card testID="belanja-entry" style={{ paddingVertical: 0 }}>
      {/* A PressableRow, not a LinkRow: LinkRow holds one label, and this row needs a title over its range line. */}
      <PressableRow
        testID="belanja-entry-row"
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${detail}`}
        onPress={() => router.push(belanjaHref() as never)}
        style={{ minHeight: ACTION, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 12 }}
      >
        {/* forest: the action's glyph */}
        <DecorativeIcon name="basket-outline" size={22} color={c.forest} />
        <View style={{ flex: 1 }}>
          <Text testID="belanja-entry-title" variant="bodyStrong">
            {title}
          </Text>
          <Text testID="belanja-entry-detail" variant="meta" style={{ fontVariant: ["tabular-nums"] }}>
            {detail}
          </Text>
        </View>
        <DecorativeIcon name="chevron-forward" size={18} color={c.muted} />
      </PressableRow>
    </Card>
  );
}

/**
 * The one action the session is waiting for, pinned above the tab bar: "Mulai masak" while any row is still
 * scheduled, then "Berangkat antar" once all are cooking. Each asks first in a confirm sheet, because it tells customers. Ticks on the
 * checklist play no part: the screen only goes by the session's own flags, and the database decides (today only).
 * A second press while the command runs is dropped. A failure is a plain line in the caption and re-reads the day.
 */
function KitchenAction({
  session,
  catererId,
  date,
  onFailed,
}: {
  session: KitchenSession;
  catererId: string;
  date: string;
  onFailed: () => void;
}) {
  const { t, locale, command } = useMobile();
  const track = useTrack();
  const haptic = useHaptic();
  const confirm = useConfirm();
  const running = useRef(false);
  // The confirm sheet is open: a second tap before it covers the button asks nothing more.
  const asking = useRef(false);
  const [busy, setBusy] = useState(false);
  // Nothing changed ("someone got there first") is a note; a failure is an error toast with Coba lagi (spec 5.2).
  // It belongs to the stage it was made in (`cook`): once the stage moves on, the note is not shown any more.
  const [noted, setNote] = useState<{ text: string; cook: boolean } | null>(null);
  const toast = useToast();
  const { meal } = session;
  const cook = session.canCook;
  const lunch = meal === "lunch";

  async function run() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setNote(null);
    try {
      const result = await command<{ moved?: number }>(cook ? "delivery.cook" : "delivery.depart", { catererId, date, meal });
      if (result?.moved === 0) {
        // Someone else got there first, or the meal had already moved on: nothing changed, and the day reads again.
        setNote({
          cook,
          text: cook
            ? t("Sudah ditandai dimasak.", "Already marked as cooking.")
            : t("Sudah ditandai berangkat.", "Already marked as out for delivery."),
        });
      } else {
        haptic.success();
        track(cook ? "cook_started" : "depart_tapped");
      }
    } catch (e) {
      const code = (e as { code?: string }).code || (e as Error).message;
      toast.show({
        tone: "error",
        action: { label: t("Coba lagi", "Try again"), onPress: () => void run() },
        message:
          code === "INVALID_DATE"
            ? t("Hanya bisa untuk hari ini.", "Only possible for today.")
            : errorLabel(code, locale) ||
              (cook
                ? t("Belum bisa menandai Dimasak. Coba lagi.", "Could not mark it as cooking. Try again.")
                : t("Belum bisa menandai berangkat. Coba lagi.", "Could not mark it as out for delivery. Try again.")),
      });
      onFailed();
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  async function ask() {
    if (running.current || asking.current) return;
    asking.current = true;
    try {
      const go = await confirm(
        cook
          ? {
              title: lunch
                ? t("Mulai masak makan siang?", "Start cooking lunch?")
                : t("Mulai masak makan malam?", "Start cooking dinner?"),
              message: t("Pelanggan akan melihat status Dimasak.", "Customers will see Cooking."),
              cancelLabel: t("Batal", "Cancel"),
              confirmLabel: t("Mulai", "Start"),
              icon: "rantang",
            }
          : {
              title: t("Berangkat antar sekarang?", "Head out now?"),
              message: t(
                "Pelanggan yang memakai aplikasi Catera dapat notifikasi saat kamu berangkat.",
                "Customers using the Catera app get a notification when you head out.",
              ),
              cancelLabel: t("Batal", "Cancel"),
              confirmLabel: t("Berangkat", "Head out"),
              icon: "rantang",
            },
      );
      if (go) await run();
    } finally {
      asking.current = false;
    }
  }

  // Once some stops have left, the button takes whatever is still waiting, and the portions say how many.
  const left = session.counts.out_for_delivery + session.counts.arrived + session.counts.delivered > 0;
  const portions = left ? session.remaining.portions : session.portions;
  // The note of this stage, if any. It takes the caption's place, so the slot never holds more than its reserved lines.
  const note = noted && noted.cook === cook ? noted.text : "";
  // The push reaches only customers with an account, and the kitchen cannot count them, so no number is promised.
  const caption = cook
    ? undefined
    : t(
        "Pelanggan yang memakai aplikasi Catera dapat notifikasi saat kamu berangkat.",
        "Customers using the Catera app get a notification when you head out.",
      );
  return (
    <View testID="sticky-action" style={{ gap: 8 }}>
      {/* The caption line keeps its room with or without words ("Mulai masak" has none), so the footer is one height
          from "Mulai masak" to "Berangkat antar" and nothing under the list shifts when it changes. */}
      <View testID="kitchen-action-caption" style={{ minHeight: CAPTION_RESERVE }}>
        {note ? (
          <Text selectable variant="meta">
            {note}
          </Text>
        ) : caption ? (
          <Text variant="meta">{caption}</Text>
        ) : null}
      </View>
      <Button
        label={
          cook
            ? t("Mulai masak", "Start cooking")
            : left
              ? t(`Berangkat semua sisa · ${portions} porsi`, `Head out with everything left · ${plural(portions, "portion")}`)
              : t(`Berangkat antar · ${portions} porsi`, `Head out · ${plural(portions, "portion")}`)
        }
        busy={busy}
        onPress={() => void ask()}
        spinnerTestID="sticky-action-spinner"
      />
    </View>
  );
}

/** How the day's deliveries ended, counted from the real rows of both meals; a cancelled day or meal counts as neither. */
function dayOutcome(ops: SellerOperationsState) {
  let arrived = 0;
  let failed = 0;
  for (const d of ops.deliveries) {
    if (d.status === "cancelled") continue;
    for (const m of d.meals) {
      if (m.status === "delivered") arrived += 1;
      else if (m.status === "issue") failed += 1;
    }
  }
  return { arrived, failed };
}

/**
 * "Semua beres hari ini": what the body shows once every delivery is recorded and no report is open. It says everything
 * arrived only when nothing was marked "Gagal diantar"; otherwise it counts both, so a day with failures never reads as clean.
 */
function DoneCard({ ops, onTomorrow }: { ops: SellerOperationsState; onTomorrow: () => void }) {
  const { t } = useMobile();
  const { arrived, failed } = dayOutcome(ops);
  return (
    <Card testID="done-card" tone="sage" style={{ gap: 12 }}>
      {/* The celebrating mascot holds up its own check, so it takes the place of the check icon. */}
      <StateArt pose="merayakan" />
      <Text variant="heading" style={{ textAlign: "center" }}>
        {t("Semua beres hari ini", "All done today")}
      </Text>
      <Text selectable testID="done-outcome" style={{ textAlign: "center" }}>
        {failed === 0
          ? t("Semua pengantaran sudah ditandai sampai.", "All deliveries are marked as arrived.")
          : t(
              `${arrived} ditandai sampai, ${failed} ditandai Gagal diantar.`,
              `${arrived} marked as arrived, ${failed} marked Not delivered.`,
            )}
      </Text>
      <Button label={t("Lihat besok", "See tomorrow")} onPress={onTomorrow} />
    </Card>
  );
}

/**
 * Hari ini: the mood's meal as one session with what to cook and where to take it, plus only the exceptions to act on.
 * The strip under the title picks any of the next seven days; only today can be acted on. `date` (from a notification)
 * opens that day when it is within the week, and today otherwise.
 */
export function TodayScreen({ date: target }: { date?: string } = {}) {
  const { actor, runtime, t, locale } = useMobile();
  const c = useColors();
  const { mood, setMood } = useMood();
  const m = useMoodColors();
  const [offset, setOffset] = useState(() => weekOffset(target, new Date()));
  useEffect(() => {
    if (target) setOffset(weekOffset(target, new Date()));
  }, [target]);
  const catererId = actor?.catererId ?? "";
  const actorId = actor?.id ?? "";
  const date = jakartaDay(new Date(), offset);
  // A launch paints the day kept for this account first (`fromCache`); the fresh read replaces it.
  const day = useData(`ops:${catererId}:${date}`, () => loadDay(runtime, actorId, catererId, date), {
    cached: () => keptDay(actorId, catererId, date),
  });
  // The week strip's counts: orders per day for the mood's meal, today through six days on. Its own read: a failure
  // leaves the strip without counts and nothing else (the day itself is read separately).
  const week = {
    from: jakartaDay(new Date(), 0),
    to: jakartaDay(new Date(), WEEK_DAYS - 1),
    meal: mood === "siang" ? "lunch" : "dinner",
  };
  const calendar = useData(`cal:${catererId}:${week.from}:${week.meal}`, () =>
    runtime.api.sellerCalendar(catererId, { ...week, status: "active" }),
  );
  const counts = calendar.data ? Object.fromEntries(calendar.data.days.map((d) => [d.date, d.orders])) : null;
  const attention = useData(`attention:${catererId}`, () =>
    runtime.api.sellerAttention(catererId, { scope: "future" }),
  );
  // Customers' delivery reports come from their own read: it names the customer and also holds
  // reports about past days, which the "future" attention scope leaves out.
  const issues = useData(`issues:${catererId}`, () =>
    runtime.api.request<DeliveryIssue[]>(`delivery-issues?${new URLSearchParams({ id: catererId })}`),
  );
  const ops = day.data?.data;
  const today = offset === 0;

  // A kitchen without packages has nothing to cook yet; only the owner can set it up.
  const newKitchen = !!ops && !ops.offers.length && actor?.role === "owner";
  // One session at a time: the mood picks the meal, and the other one is a tap away when this one is empty.
  const meal: KitchenMeal = mood === "siang" ? "lunch" : "dinner";
  const other: KitchenMeal = meal === "lunch" ? "dinner" : "lunch";
  // The checklist's ticks live here, above the day's FadeSwap, so they belong to the day and meal and are never re-read
  // (and blink unticked) when a card changes in place.
  const ticks = useTicks(catererId, date, meal);
  // The order's expanded list and next WhatsApp part live here for the same reason: a caterer who shared part 1 and then
  // tapped Mulai masak or Berangkat antar sends part 2 next, not part 1 again.
  const route = useRouteView(`${date}:${meal}`);
  // The session is worked out once here: the count card, the checklist, the order and the footer all read it, so they
  // agree on which rows count (a stop marked "Gagal diantar" or a cancelled one is in none of them).
  const now = new Date();
  const session = ops ? kitchenSession(ops, meal, now) : null;
  const otherSession = ops ? kitchenSession(ops, other, now) : null;
  // A meal with no session can still have rows: the ones marked "Gagal diantar". Saying "no deliveries" then would be false.
  const failedCount =
    ops && !session
      ? ops.deliveries.filter(
          (d) => d.status !== "cancelled" && d.meals.some((m) => m.meal === meal && m.status === "issue"),
        ).length
      : 0;
  // A copy kept from before the connection dropped may be stale: it can be read, but not acted on.
  const action = session && !day.data?.savedAt && (session.canCook || session.canDepart) ? session : null;
  // "Pilih": the order list and the bottom bar share one selection, reset when the day or the meal changes.
  const selection = useStopSelection(session?.stops ?? [], `${date}:${meal}`);
  const picking = !!session && selection.active && today && !day.data?.savedAt;
  // The meta keeps the kitchen's name while the other day loads, instead of dropping it for a moment.
  const [catererName, setCatererName] = useState("");
  if (ops && ops.caterer.name !== catererName) setCatererName(ops.caterer.name);
  // Once the meal is out the header says so, in place of the day word: the batch progress and the order below say the rest.
  const out = today && (session?.journey.stage === "out_for_delivery" || session?.journey.stage === "arrived");
  const dayWord = out
    ? t("Sedang diantar", "On the way")
    : today
      ? t("Hari ini", "Today")
      : offset === 1
        ? t("Besok", "Tomorrow")
        : weekdayName(date, locale);
  // The day is done when nothing is left to serve and no report is open. It needs the reports read (a failed read could
  // be hiding an open one), and a copy kept from before the connection dropped may be out of date. A meal whose rows
  // all failed keeps its own card saying so, which a "Semua beres" would otherwise cover.
  const done =
    !!ops &&
    today &&
    !day.data?.savedAt &&
    !!issues.data &&
    (session !== null || failedCount === 0) &&
    kitchenDayDone(ops, issues.data, now);
  // The first read of this day: the header and the body each hold their skeleton until it answers. A kept copy or a
  // failed read is never a skeleton (the copy shows itself, a failure shows Coba lagi).
  const loading = !ops && !day.error;
  // The body's fade key: a different day, or the first read landing.
  const dayKey = `${loading ? "loading" : "day"}-${date}`;

  // Pull to refresh reads the day and its reports again while what is on screen stays; only the spinner says so.
  const [pulling, setPulling] = useState(false);
  const toast = useToast();
  const pulled = useRef(false);
  const staleNow = day.stale || issues.stale || attention.stale;
  // A pull that ended with the old data still on screen says so; a background reload that fails stays quiet.
  useEffect(() => {
    if (pulling || !pulled.current) return;
    pulled.current = false;
    if (staleNow) toast.show({ message: t("Belum bisa memperbarui. Tarik lagi untuk mencoba.", "Couldn't refresh. Pull again to try."), tone: "error" });
  }, [pulling, staleNow, toast, t]);
  async function pull() {
    pulled.current = true;
    setPulling(true);
    try {
      await Promise.all([day.reload(), issues.reload(), attention.reload(), calendar.reload()]);
    } finally {
      setPulling(false);
    }
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={pulling}
          onRefresh={() => void pull()}
          tintColor={c.forest}
          colors={[c.forest]}
          progressBackgroundColor={c.surface}
        />
      }
      footer={
        picking && ops && session ? (
          <SelectionBar
            key={`${date}-${session.meal}`}
            ops={ops}
            session={session}
            catererId={catererId}
            date={date}
            selection={selection}
            onFailed={() => void day.reload()}
          />
        ) : action ? (
          <KitchenAction
            key={`${date}-${action.meal}`}
            session={action}
            catererId={catererId}
            date={date}
            onFailed={() => void day.reload()}
          />
        ) : undefined
      }
      header={
        <MoodHeader
          band
          meta={[catererName, dayWord].filter(Boolean).join(" · ")}
          toggle
          toggleSize="compact"
          title={
            <Text variant="heroTitle" style={{ color: m.headerText }}>
              {shortDate(date, locale)}
            </Text>
          }
        >
          <WeekStrip selected={offset} onSelect={setOffset} counts={counts} />
          {/* The figures enter from their skeleton as one block, in the same place on the header. They are keyed by
              day and meal, so the mood toggle and a day picked on the week strip mount the other session's batch
              progress in place instead of sliding it (Decision A); only a stage change of the same session moves it. */}
          {loading || (ops && session) ? (
            <FadeSwap swapKey={loading ? "loading" : "count"}>
              {ops && session ? (
                <HeaderFigures key={`${date}:${session.meal}`} ops={ops} session={session} />
              ) : (
                <TodayCountSkeleton />
              )}
            </FadeSwap>
          ) : null}
        </MoodHeader>
      }
    >
      {/* The banner decides for itself when the phone is offline; with a kept copy it names the time of that copy. It
          sits above the day's FadeSwap so a day change does not remount it (blank until NetInfo answers
          again, and announced again on iOS). */}
      <ConnectionBanner
        lastSeen={day.data?.savedAt ? new Date(day.data.savedAt) : undefined}
        onRetry={() => void pull()}
      />
      {/* Only a different day (or the first read landing) is new content and fades. A stage change (Mulai masak, Berangkat
          antar, Semua beres) or the Siang / Malam switch is the same day answering a tap: its parts change in place,
          so the body neither fades from zero nor blanks for a frame. The day is two FadeSwaps on the same key with the
          Belanja row between them: what needs the caterer first (the captions, the read errors, the live slot), then the
          row, then the day's content. The row is the same on every day, so it stays out of both and never fades.
          Each part ends (or starts) with a zero-height spacer, so its 24 to the row exists only when the part has
          content: an empty part adds no gap. */}
      <View testID="today-body">
        <FadeSwap swapKey={dayKey}>
          <View testID="today-first" style={{ gap: SECTION_GAP }}>
            {day.fromCache && day.loading ? (
              // The kept copy shows while the fresh read runs; its actions stay hidden until that lands.
              <Text testID="day-refreshing" variant="meta">
                {t("Memperbarui…", "Updating…")}
              </Text>
            ) : day.data?.savedAt ? (
              <Text testID="day-kept" variant="meta">
                {t(
                  "Ini data terakhir yang tersimpan. Mulai masak dan Berangkat kembali setelah data diperbarui.",
                  "This is the last data saved. The Start cooking and Head out buttons come back once the data is refreshed.",
                )}
              </Text>
            ) : null}
            {!ops && day.error ? <ReadError art message={day.error} onRetry={() => void day.reload()} /> : null}
            {today && !issues.data && issues.error ? (
              // A failed read must not look like "no reports".
              <ReadError
                message={t("Laporan pelanggan belum bisa dimuat.", "Customer reports could not be loaded.")}
                onRetry={() => void issues.reload()}
              />
            ) : null}
            {today && !attention.data && attention.error ? (
              // A failed read must not look like "nothing needs attention".
              <ReadError
                message={t("Hal yang perlu dicek belum bisa dimuat.", "Items that need a check could not be loaded.")}
                onRetry={() => void attention.reload()}
              />
            ) : null}
            {/* The live slot: the first of the setup card, the reports and the attention items, the rest one tap away. */}
            <LiveSlot
              setup={newKitchen}
              issues={today ? (issues.data ?? []) : []}
              attention={today ? (attention.data?.items ?? []) : []}
            />
            <View style={{ height: 0 }} />
          </View>
        </FadeSwap>
        <BelanjaEntry />
        <FadeSwap swapKey={dayKey}>
          <View testID="today-day" style={{ gap: SECTION_GAP }}>
            <View style={{ height: 0 }} />
            {loading ? <TodaySkeleton /> : null}
            {ops && done ? (
              <DoneCard ops={ops} onTomorrow={() => setOffset(1)} />
            ) : ops && session ? (
              <SessionCard
                ops={ops}
                session={session}
                ticks={ticks}
                meal={meal}
                date={date}
                report={day.data?.savedAt ? null : today ? "today" : "later"}
                caterer={ops.caterer.name}
                selection={selection}
                route={route}
              />
            ) : ops && (failedCount > 0 || otherSession) ? (
              <Card tone="sage">
                {/* Nothing scheduled for this meal rests the mascot; rows marked "Gagal diantar" are not a quiet meal. */}
                {failedCount > 0 ? null : <StateArt pose="tidur" />}
                <Text testID="meal-empty-note" selectable style={failedCount > 0 ? undefined : { textAlign: "center" }}>
                  {failedCount > 0
                    ? meal === "lunch"
                      ? t(
                          `${failedCount} pengantaran makan siang ditandai Gagal diantar.`,
                          `${failedCount} lunch ${failedCount === 1 ? "delivery" : "deliveries"} marked Not delivered.`,
                        )
                      : t(
                          `${failedCount} pengantaran makan malam ditandai Gagal diantar.`,
                          `${failedCount} dinner ${failedCount === 1 ? "delivery" : "deliveries"} marked Not delivered.`,
                        )
                    : meal === "lunch"
                      ? t("Tidak ada pengantaran makan siang.", "No lunch deliveries.")
                      : t("Tidak ada pengantaran makan malam.", "No dinner deliveries.")}
                </Text>
                {otherSession ? (
                  <Button
                    variant="secondary"
                    label={
                      other === "lunch"
                        ? t(
                            `Lihat makan siang · ${otherSession.portions} porsi`,
                            `See lunch · ${plural(otherSession.portions, "portion")}`,
                          )
                        : t(
                            `Lihat makan malam · ${otherSession.portions} porsi`,
                            `See dinner · ${plural(otherSession.portions, "portion")}`,
                          )
                    }
                    onPress={() => setMood(mood === "siang" ? "malam" : "siang")}
                  />
                ) : null}
              </Card>
            ) : ops && !newKitchen ? (
              <Card tone="sage">
                <StateArt pose="tidur" />
                <Text style={{ textAlign: "center" }}>
                  {today
                    ? t("Tidak ada yang dimasak hari ini.", "Nothing to cook today.")
                    : offset === 1
                      ? t("Tidak ada yang dimasak besok.", "Nothing to cook tomorrow.")
                      : t(`Tidak ada yang dimasak hari ${dayWord}.`, `Nothing to cook on ${dayWord}.`)}
                </Text>
                <Text variant="meta" style={{ textAlign: "center" }}>
                  {t("Pesanan baru akan muncul di sini.", "New orders will appear here.")}
                </Text>
              </Card>
            ) : null}
          </View>
        </FadeSwap>
      </View>
    </Screen>
  );
}
