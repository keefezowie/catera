import { useEffect, useRef, useState } from "react";
import { RefreshControl, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import {
  errorLabel,
  jakartaDay,
  journeyCaption,
  kitchenDayDone,
  kitchenSession,
  mealLabel,
  sessionStart,
  shortDate,
  type DeliveryIssue,
  type KitchenMeal,
  type KitchenSession,
  type Locale,
  type SellerAttentionItem,
  type SellerOperationsState,
} from "@catera/domain";
import { useData, useMobile, useTrack, type MobileRuntime, plural } from "@catera/mobile-core";
import {
  Button,
  Card,
  ConnectionBanner,
  FadeSwap,
  fontFor,
  MoodFill,
  MoodHeader,
  PressableRow,
  PressableScale,
  RantangTrack,
  trackCounts,
  trackStage,
  Screen,
  StateArt,
  StickyAction,
  Text,
  useColors,
  useConfirm,
  useToast,
  useHaptic,
  useMood,
  useMoodColors,
  useStackedLayout,
} from "@catera/mobile-ui";
import { jakartaClock } from "./exceptions";
import { cacheSession, loadCachedDay, saveCachedDay } from "./offline";
import { SelectionBar } from "./SelectionBar";
import { useStopSelection } from "./selection";
import { SessionCard } from "./SessionCard";
import { useTicks } from "./ticks";
import { useRouteView } from "./DeliveryOrder";
import { replyHref } from "../hrefs";
import { dapurLink } from "../links";
import { openLink } from "../nav";
import { ReadError } from "../ReadError";
import { TodayCountSkeleton, TodaySkeleton } from "../skeletons";

/**
 * The cooking mascot's size in the count card (spec 7.2): about the height of the portions and their caption. Its slot
 * is held in the numbers row for the whole session (`StateArt held`), so the card keeps one shape before, during and
 * after cooking.
 */
const COOKING_ART = 72;

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
 * The session's headline numbers on the mood's hero fill: portions to cook, addresses, and when the first window
 * opens, with the rantang track under them showing how far the meal has got. The fill is `MoodFill`, so it
 * cross-fades with the header's own timing; the shadow sits on its base layer.
 */
function CountCard({ ops, session }: { ops: SellerOperationsState; session: KitchenSession }) {
  const { t, locale } = useMobile();
  const palette = useMoodColors();
  const { meal, portions, addresses } = session;
  // The window opens with the first row still being served: a failed or cancelled row's hours do not count.
  const served = new Set(session.stops.map((s) => s.deliveryId));
  const start = sessionStart({ ...ops, deliveries: ops.deliveries.filter((d) => served.has(d.id)) }, meal);
  const stacked = useStackedLayout(340);
  const caption = (
    <Text testID="session-count-caption" variant="caption" style={{ color: palette.heroMeta }}>
      {meal === "lunch"
        ? t(`porsi siang · ${addresses} alamat`, `lunch portions · ${plural(addresses, "address", "addresses")}`)
        : t(`porsi malam · ${addresses} alamat`, `dinner portions · ${plural(addresses, "address", "addresses")}`)}
    </Text>
  );
  return (
    <View
      testID="session-count"
      style={{ gap: 16, padding: 16, borderRadius: 22, borderCurve: "continuous" }}
    >
      <MoodFill surface="hero" testID="session-count-fill" radius={22} heroShadow />
      <View
        testID="session-count-row"
        style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}
      >
        <View testID="session-count-numbers" style={{ flex: 1, flexShrink: 1 }}>
          <Text variant="number" style={{ color: palette.heroText }}>
            {String(portions)}
          </Text>
          {stacked ? null : caption}
        </View>
        {/* The cooking mascot's slot, in the numbers row between the portions and "Antar": `[numbers][slot][Antar]`.
            After "Mulai masak", while the whole session cooks, the mascot stands in it at about the numbers' own
            height, fading in, and fades out at "Berangkat antar". Before and after, the slot is held empty and reads as
            the space between the count and the time. It always takes its width, so the card keeps one height and the
            caption wraps the same way through the whole session. */}
        <StateArt
          pose="memasak"
          base={COOKING_ART}
          held={session.journey.stage !== "preparing"}
          style={{ alignSelf: "flex-end" }}
        />
        {start ? (
          <Text variant="label" style={{ color: palette.heroText, flexShrink: 0 }}>
            {t(`Antar ${start}`, `Delivery ${start}`)}
          </Text>
        ) : null}
      </View>
      {/* Large text or a narrow phone: the caption leaves the numbers' column for the card's full width. */}
      {stacked ? caption : null}
      <RantangTrack
        stage={trackStage(session.journey)}
        caption={journeyCaption(session.journey, locale, "kitchen") ?? undefined}
        counts={trackCounts(session.counts)}
      />
    </View>
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
  const [note, setNote] = useState("");
  const toast = useToast();
  const { meal } = session;
  const cook = session.canCook;
  const lunch = meal === "lunch";

  async function run() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setNote("");
    try {
      const result = await command<{ moved?: number }>(cook ? "delivery.cook" : "delivery.depart", { catererId, date, meal });
      if (result?.moved === 0) {
        // Someone else got there first, or the meal had already moved on: nothing changed, and the day reads again.
        setNote(
          cook
            ? t("Sudah ditandai dimasak.", "Already marked as cooking.")
            : t("Sudah ditandai berangkat.", "Already marked as out for delivery."),
        );
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
  return (
    <View style={{ gap: 8 }}>
      {note ? (
        <Text selectable variant="caption">
          {note}
        </Text>
      ) : null}
      <StickyAction
        label={
          cook
            ? t("Mulai masak", "Start cooking")
            : left
              ? t(`Berangkat semua sisa · ${portions} porsi`, `Head out with everything left · ${plural(portions, "portion")}`)
              : t(`Berangkat antar · ${portions} porsi`, `Head out · ${plural(portions, "portion")}`)
        }
        // The push reaches only customers with an account, and the kitchen cannot count them, so no number is promised.
        caption={
          cook
            ? undefined
            : t(
                "Pelanggan yang memakai aplikasi Catera dapat notifikasi saat kamu berangkat.",
                "Customers using the Catera app get a notification when you head out.",
              )
        }
        busy={busy}
        onPress={() => void ask()}
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
    <Card tone="sage" style={{ gap: 12 }}>
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
 * `date` (from a notification) opens Besok when it points to tomorrow.
 */
export function TodayScreen({ date: target }: { date?: string } = {}) {
  const { actor, runtime, t, locale } = useMobile();
  const c = useColors();
  const { mood, setMood } = useMood();
  const m = useMoodColors();
  const [offset, setOffset] = useState<"0" | "1">(() => (target === jakartaDay(new Date(), 1) ? "1" : "0"));
  useEffect(() => {
    if (target) setOffset(target === jakartaDay(new Date(), 1) ? "1" : "0");
  }, [target]);
  const catererId = actor?.catererId ?? "";
  const actorId = actor?.id ?? "";
  const date = jakartaDay(new Date(), Number(offset));
  // A launch paints the day kept for this account first (`fromCache`); the fresh read replaces it.
  const day = useData(`ops:${catererId}:${date}`, () => loadDay(runtime, actorId, catererId, date), {
    cached: () => keptDay(actorId, catererId, date),
  });
  const attention = useData(`attention:${catererId}`, () =>
    runtime.api.sellerAttention(catererId, { scope: "future" }),
  );
  // Customers' delivery reports come from their own read: it names the customer and also holds
  // reports about past days, which the "future" attention scope leaves out.
  const issues = useData(`issues:${catererId}`, () =>
    runtime.api.request<DeliveryIssue[]>(`delivery-issues?${new URLSearchParams({ id: catererId })}`),
  );
  const ops = day.data?.data;

  // A kitchen without packages has nothing to cook yet; only the owner can set it up.
  const newKitchen = !!ops && !ops.offers.length && actor?.role === "owner";
  // One session at a time: the mood picks the meal, and the other one is a tap away when this one is empty.
  const meal: KitchenMeal = mood === "siang" ? "lunch" : "dinner";
  const other: KitchenMeal = meal === "lunch" ? "dinner" : "lunch";
  // The checklist's ticks live here, above the day's FadeSwap: a stage change or a mood switch re-keys the swap and mounts
  // the card afresh, and the ticks must not be re-read (and blink unticked) each time.
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
  const picking = !!session && selection.active && offset === "0" && !day.data?.savedAt;
  // The meta keeps the kitchen's name while the other day loads, instead of dropping it for a moment.
  const [catererName, setCatererName] = useState("");
  if (ops && ops.caterer.name !== catererName) setCatererName(ops.caterer.name);
  // Once the meal is out the header says so, in place of the day word: the track and the order below say the rest.
  const out = offset === "0" && (session?.journey.stage === "out_for_delivery" || session?.journey.stage === "arrived");
  const dayWord = out
    ? t("Sedang diantar", "On the way")
    : offset === "0"
      ? t("Hari ini", "Today")
      : t("Besok", "Tomorrow");
  // The day is done when nothing is left to serve and no report is open. It needs the reports read (a failed read could
  // be hiding an open one), and a copy kept from before the connection dropped may be out of date. A meal whose rows
  // all failed keeps its own card saying so, which a "Semua beres" would otherwise cover.
  const done =
    !!ops &&
    offset === "0" &&
    !day.data?.savedAt &&
    !!issues.data &&
    (session !== null || failedCount === 0) &&
    kitchenDayDone(ops, issues.data, now);
  // The first read of this day: the header and the body each hold their skeleton until it answers. A kept copy or a
  // failed read is never a skeleton (the copy shows itself, a failure shows Coba lagi).
  const loading = !ops && !day.error;

  // Pull to refresh reads the day and its reports again while what is on screen stays; only the spinner says so.
  const [pulling, setPulling] = useState(false);
  async function pull() {
    setPulling(true);
    try {
      await Promise.all([day.reload(), issues.reload(), attention.reload()]);
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
          meta={[catererName, dayWord].filter(Boolean).join(" · ")}
          toggle
          title={
            <PressableScale
              accessibilityRole="button"
              // The name starts with the visible date (WCAG 2.5.3, Label in Name); the meta line above says Hari ini or Besok.
              accessibilityLabel={`${shortDate(date, locale)}, ${t("ganti hari", "change day")}`}
              haptic="select"
              onPress={() => setOffset(offset === "0" ? "1" : "0")}
              style={{ minHeight: 48, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Text variant="title" style={{ color: m.headerText, flexShrink: 1 }}>
                {shortDate(date, locale)}
              </Text>
              <Ionicons name="chevron-down" size={22} color={m.headerText} />
            </PressableScale>
          }
        >
          {/* The count card enters from its skeleton as one block, in the same place on the header. It is keyed by
              day and meal, so the mood toggle and Hari ini/Besok mount the other session's track in place instead of
              sliding it (Decision A); only a stage change of the same session moves it. */}
          {loading || (ops && session) ? (
            <FadeSwap swapKey={loading ? "loading" : "count"}>
              {ops && session ? (
                <CountCard key={`${date}:${session.meal}`} ops={ops} session={session} />
              ) : (
                <TodayCountSkeleton />
              )}
            </FadeSwap>
          ) : null}
        </MoodHeader>
      }
    >
      {/* The banner decides for itself when the phone is offline; with a kept copy it names the time of that copy. It
          sits above the day's FadeSwap so a mood or stage change does not remount it (blank until NetInfo answers
          again, and announced again on iOS). */}
      <ConnectionBanner
        lastSeen={day.data?.savedAt ? new Date(day.data.savedAt) : undefined}
        onRetry={() => void pull()}
      />
      <FadeSwap
        swapKey={`${loading ? "loading" : "day"}-${date}-${mood}-${done ? "done" : (session?.journey.stage ?? "none")}`}
      >
        <View style={{ gap: 16 }}>
          {day.fromCache && day.loading ? (
            // The kept copy shows while the fresh read runs; its actions stay hidden until that lands.
            <Text testID="day-refreshing" variant="caption">
              {t("Memperbarui…", "Updating…")}
            </Text>
          ) : day.data?.savedAt ? (
            <Text testID="day-kept" variant="caption">
              {t(
                "Ini data terakhir yang tersimpan. Mulai masak dan Berangkat kembali setelah data diperbarui.",
                "This is the last data saved. The Start cooking and Head out buttons come back once the data is refreshed.",
              )}
            </Text>
          ) : null}
          {!ops && day.error ? <ReadError art message={day.error} onRetry={() => void day.reload()} /> : null}
          {loading ? <TodaySkeleton /> : null}
          {newKitchen ? <MulaiCard /> : null}
          {offset === "0" ? (
            <>
              {!issues.data && issues.error ? (
                // A failed read must not look like "no reports".
                <ReadError
                  message={t("Laporan pelanggan belum bisa dimuat.", "Customer reports could not be loaded.")}
                  onRetry={() => void issues.reload()}
                />
              ) : null}
              <ReportCards issues={issues.data ?? []} />
              <ActionCards items={attention.data?.items ?? []} />
            </>
          ) : null}
          {ops && done ? (
            <DoneCard ops={ops} onTomorrow={() => setOffset("1")} />
          ) : ops && session ? (
            <SessionCard
              ops={ops}
              session={session}
              ticks={ticks}
              meal={meal}
              date={date}
              report={day.data?.savedAt ? null : offset === "0" ? "today" : "tomorrow"}
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
                {offset === "0"
                  ? t("Tidak ada yang dimasak hari ini.", "Nothing to cook today.")
                  : t("Tidak ada yang dimasak besok.", "Nothing to cook tomorrow.")}
              </Text>
              <Text variant="caption" style={{ textAlign: "center" }}>
                {t("Pesanan baru akan muncul di sini.", "New orders will appear here.")}
              </Text>
            </Card>
          ) : null}
        </View>
      </FadeSwap>
    </Screen>
  );
}

/** Reports still waiting on the caterer, each naming who, which day and meal; tap to answer in the reply sheet. */
function ReportCards({ issues }: { issues: DeliveryIssue[] }) {
  const { t, locale } = useMobile();
  const c = useColors();
  const waiting = issues.filter((i) => !i.case_id && (i.status === "open" || i.status === "responded"));
  return (
    <>
      {waiting.map((i) => {
        const who = i.customerName || t("Pelanggan", "A customer");
        return (
          <PressableRow
            key={i.id}
            accessibilityRole="button"
            accessibilityLabel={`${t("Buka laporan", "Open report")}: ${who}`}
            onPress={() => router.push(replyHref(i.id, i.customerName) as never)}
          >
            <Card tone="attention" style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: fontFor("800") }}>{`${who} ${t("melaporkan masalah", "reported a problem")}`}</Text>
                <Text variant="label">{`${shortDate(i.service_date, locale)} · ${mealLabel(i.meal, locale)}`}</Text>
                <Text variant="caption">{i.subject}</Text>
                {i.status === "responded" ? (
                  <Text variant="caption" style={{ color: c.charcoal }}>
                    {t("Sudah kamu balas. Tandai selesai kalau sudah beres.", "You replied. Mark it done once it's sorted.")}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            </Card>
          </PressableRow>
        );
      })}
    </>
  );
}

// Delivery reports have their own cards above (ReportCards).
const attentionLabels: Partial<Record<SellerAttentionItem["kind"], [string, string]>> = {
  support: ["Pertanyaan pelanggan menunggu", "A customer question is waiting"],
  delivery: ["Ada pengantaran bermasalah", "A delivery needs attention"],
  choice_fallback: ["Menu pilihan pelanggan perlu dicek", "Customer menu choices need a check"],
  choice_deadline: ["Batas pilih menu pelanggan sudah dekat", "Customer menu choice deadline is near"],
  payment: ["Ada pembayaran yang perlu dicek", "A payment needs attention"],
};

/**
 * The delivery rows read "2026-10-20 · dinner · Paket" from the server. Build the line from the payload's own
 * `serviceDate`, `meal` and `packageName` when they are there, and from that string when they are not, then show
 * the day and meal the way the rest of Dapur does ("Selasa 20 Okt · Makan malam · Paket").
 */
function attentionContext(item: SellerAttentionItem, locale: Locale) {
  const context = item.context;
  const tail = (name?: string | null) => (name ? ` · ${name}` : "");
  if (item.kind === "delivery" || item.kind === "choice_fallback" || item.kind === "choice_deadline") {
    if (item.serviceDate && item.meal) return `${shortDate(item.serviceDate, locale)} · ${mealLabel(item.meal, locale)}${tail(item.packageName)}`;
    const m = /^([0-9]{4}-[0-9]{2}-[0-9]{2}) · (lunch|dinner)(?=$| · |:)/.exec(context ?? "");
    if (m) return `${shortDate(m[1], locale)} · ${mealLabel(m[2], locale)}${context.slice(m[0].length)}`;
  }
  return context;
}

function ActionCards({ items }: { items: SellerAttentionItem[] }) {
  const { t, locale } = useMobile();
  const c = useColors();
  const shown = items.filter((i) => attentionLabels[i.kind]).slice(0, 3);
  return (
    <>
      {shown.map((item) => {
        const [id, en] = attentionLabels[item.kind]!;
        const line = attentionContext(item, locale);
        // "/" is dapurLink's answer for "no Dapur screen for this": Hari ini is already where we are.
        const route = dapurLink(item.href);
        const link = route !== "/";
        const card = (
          <Card tone="attention" style={link ? { flexDirection: "row", alignItems: "center" } : undefined}>
            <View testID={`attention-body-${item.id}`} style={{ flex: link ? 1 : undefined, gap: 10 }}>
              <Text style={{ fontFamily: fontFor("800") }}>{t(id, en)}</Text>
              {line ? <Text variant="caption">{line}</Text> : null}
            </View>
            {link ? <Ionicons name="chevron-forward" size={18} color={c.muted} /> : null}
          </Card>
        );
        return link ? (
          <PressableRow key={item.id} testID={`attention-${item.id}`} accessibilityRole="link" onPress={() => openLink(route)}>
            {card}
          </PressableRow>
        ) : (
          <View key={item.id} testID={`attention-${item.id}`}>
            {card}
          </View>
        );
      })}
    </>
  );
}

function MulaiCard() {
  const { t } = useMobile();
  const c = useColors();
  const steps: [string, string, string][] = [
    [t("Buat paket pertama", "Create your first package"), t("Nama, foto, harga, hari antar", "Name, photo, price, days"), "/paket/baru"],
    [t("Pindahkan pelanggan lama", "Bring in existing customers"), t("Kirim foto buku catatan atau chat WhatsApp", "Send a notebook photo or WhatsApp chat"), "/impor"],
    [t("Aktifkan pembayaran", "Turn on payments"), t("Perlu sebelum perpanjangan pertama", "Needed before the first renewal"), "/aktifkan"],
  ];
  return (
    <>
      {/* Direction K: a plain card. Forest fills only the first step, the one brand control here; the rest sit on sage. */}
      <Card>
        <Text variant="heading">{t("Siapkan dapurmu", "Set up your kitchen")}</Text>
        {steps.map(([title, sub, href], i) => (
          <PressableRow
            key={href}
            accessibilityRole="button"
            onPress={() => router.push(href as never)}
            style={{
              minHeight: 56,
              padding: 12,
              borderRadius: 12,
              backgroundColor: i === 0 ? c.forest : c.sage,
              gap: 2,
            }}
          >
            <Text style={{ fontFamily: fontFor("800"), color: i === 0 ? c.cream : c.charcoal }}>{title}</Text>
            <Text variant="caption" style={{ color: i === 0 ? c.cream : c.muted }}>
              {sub}
            </Text>
          </PressableRow>
        ))}
      </Card>
      <Card>
        <Text variant="heading">{t("Setelah ada pelanggan", "Once you have customers")}</Text>
        <Text variant="caption">
          {t(
            "Halaman ini menunjukkan porsi yang perlu dimasak dan rute antar, hari ini dan besok.",
            "This page shows what to cook and where to deliver, today and tomorrow.",
          )}
        </Text>
      </Card>
    </>
  );
}
