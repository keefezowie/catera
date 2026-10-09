import { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import {
  errorLabel,
  jakartaDay,
  journeyCaption,
  kitchenSession,
  mealLabel,
  sessionStart,
  shortDate,
  type DeliveryIssue,
  type KitchenMeal,
  type KitchenSession,
  type SellerAttentionItem,
  type SellerOperationsState,
} from "@catera/domain";
import { useData, useMobile, useTrack, type MobileRuntime } from "@catera/mobile-core";
import {
  Button,
  Card,
  FadeSwap,
  fontFor,
  MoodFill,
  MoodHeader,
  PressableRow,
  PressableScale,
  RantangTrack,
  Screen,
  StickyAction,
  Text,
  useColors,
  useHaptic,
  useMood,
  useMoodColors,
  useThemePreference,
} from "@catera/mobile-ui";
import { jakartaClock } from "./exceptions";
import { loadCachedDay, saveCachedDay } from "./offline";
import { SessionCard } from "./SessionCard";
import { dapurLink } from "../links";
import { ReadError } from "../ReadError";

type LoadedDay = { data: SellerOperationsState; savedAt: string | null };

async function loadDay(runtime: MobileRuntime, catererId: string, date: string): Promise<LoadedDay> {
  const key = `${catererId}-${date}`;
  try {
    const data = await runtime.api.sellerOperations(catererId, date);
    await saveCachedDay(key, { savedAt: new Date().toISOString(), data });
    return { data, savedAt: null };
  } catch (error) {
    const cached = await loadCachedDay(key);
    if (cached) return { data: cached.data, savedAt: cached.savedAt };
    throw error;
  }
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
  const start = sessionStart(ops, meal);
  return (
    <View
      testID="session-count"
      style={{ gap: 16, padding: 16, borderRadius: 22, borderCurve: "continuous" }}
    >
      <MoodFill surface="hero" testID="session-count-fill" radius={22} heroShadow />
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flexShrink: 1 }}>
          <Text variant="number" style={{ color: palette.heroText }}>
            {String(portions)}
          </Text>
          <Text variant="caption" style={{ color: palette.heroMeta }}>
            {meal === "lunch"
              ? t(`porsi siang · ${addresses} alamat`, `lunch portions · ${addresses} addresses`)
              : t(`porsi malam · ${addresses} alamat`, `dinner portions · ${addresses} addresses`)}
          </Text>
        </View>
        {start ? (
          <Text variant="label" style={{ color: palette.heroText, flexShrink: 0 }}>
            {t(`Antar ${start}`, `Deliver ${start}`)}
          </Text>
        ) : null}
      </View>
      <RantangTrack
        stage={session.journey.stage}
        caption={journeyCaption(session.journey, locale) ?? ""}
        labels={[t("Dimasak", "Cooking"), t("Diantar", "On the way"), t("Sampai", "Arrived")]}
      />
    </View>
  );
}

/**
 * The one action the session is waiting for, pinned above the tab bar: "Mulai masak" while any row is still
 * scheduled, then "Berangkat antar" once all are cooking. Each asks first, because it tells customers. Ticks on the
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
  const c = useColors();
  const track = useTrack();
  const haptic = useHaptic();
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);
  const { meal } = session;
  const cook = session.canCook;
  const lunch = meal === "lunch";

  async function run() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const result = await command<{ moved?: number }>(cook ? "delivery.cook" : "delivery.depart", { catererId, date, meal });
      if (result?.moved === 0) {
        // Someone else got there first, or the meal had already moved on: nothing changed, and the day reads again.
        setMessage({
          text: cook ? t("Sudah ditandai dimasak.", "Already marked as cooking.") : t("Sudah ditandai berangkat.", "Already marked as left."),
          failed: false,
        });
      } else {
        haptic.success();
        track(cook ? "cook_started" : "depart_tapped");
      }
    } catch (e) {
      const code = (e as { code?: string }).code || (e as Error).message;
      setMessage({
        text:
          code === "INVALID_DATE"
            ? t("Hanya bisa untuk hari ini.", "Only possible for today.")
            : errorLabel(code, locale) || t("Belum berhasil. Coba lagi.", "That didn't work. Try again."),
        failed: true,
      });
      onFailed();
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  function ask() {
    if (running.current) return;
    if (cook)
      Alert.alert(
        lunch ? t("Mulai masak makan siang?", "Start cooking lunch?") : t("Mulai masak makan malam?", "Start cooking dinner?"),
        t("Pelanggan melihat status Dimasak.", "Customers see the status Cooking."),
        [
          { text: t("Batal", "Cancel"), style: "cancel" },
          { text: t("Mulai", "Start"), onPress: () => void run() },
        ],
      );
    else
      Alert.alert(
        t("Berangkat antar sekarang?", "Leave to deliver now?"),
        t(
          "Pelanggan yang memakai aplikasi Catera dapat notifikasi saat kamu berangkat.",
          "Customers using the Catera app get a notification when you leave.",
        ),
        [
          { text: t("Batal", "Cancel"), style: "cancel" },
          { text: t("Berangkat", "Leave"), onPress: () => void run() },
        ],
      );
  }

  return (
    <View style={{ gap: 8 }}>
      {message ? (
        <Text selectable variant="caption" style={message.failed ? { color: c.danger } : undefined}>
          {message.text}
        </Text>
      ) : null}
      <StickyAction
        label={
          cook
            ? t("Mulai masak", "Start cooking")
            : t(`Berangkat antar · ${session.portions} porsi`, `Leave to deliver · ${session.portions} portions`)
        }
        // The push reaches only customers with an account, and the kitchen cannot count them, so no number is promised.
        caption={
          cook
            ? undefined
            : t(
                "Pelanggan yang memakai aplikasi Catera dapat notifikasi saat kamu berangkat.",
                "Customers using the Catera app get a notification when you leave.",
              )
        }
        busy={busy}
        onPress={ask}
      />
    </View>
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
  const date = jakartaDay(new Date(), Number(offset));
  const day = useData(`ops:${catererId}:${date}`, () => loadDay(runtime, catererId, date));
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
  // The session is worked out once here: the count card, the checklist, the order and the footer all read it, so they
  // agree on which rows count (a stop marked "Gagal diantar" or a cancelled one is in none of them).
  const now = new Date();
  const session = ops ? kitchenSession(ops, meal, now) : null;
  const otherSession = ops ? kitchenSession(ops, other, now) : null;
  // A copy kept from before the connection dropped may be stale: it can be read, but not acted on.
  const action = session && !day.data?.savedAt && (session.canCook || session.canDepart) ? session : null;
  // The meta keeps the kitchen's name while the other day loads, instead of dropping it for a moment.
  const [catererName, setCatererName] = useState("");
  if (ops && ops.caterer.name !== catererName) setCatererName(ops.caterer.name);
  const dayWord = offset === "0" ? t("Hari ini", "Today") : t("Besok", "Tomorrow");

  return (
    <Screen
      footer={
        action ? (
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
          {ops && session ? <CountCard ops={ops} session={session} /> : null}
        </MoodHeader>
      }
    >
      <FadeSwap swapKey={`${date}-${mood}`}>
        <View style={{ gap: 16 }}>
          {day.data?.savedAt ? (
            <Card tone="attention">
              <Text variant="caption" style={{ color: c.sunriseInk }}>
                {t("Terakhir diperbarui", "Last updated")} {jakartaClock(day.data.savedAt)} ·{" "}
                {t("tidak ada sinyal", "offline")}
              </Text>
            </Card>
          ) : null}
          {!ops && day.error ? <ReadError message={day.error} onRetry={() => void day.reload()} /> : null}
          {!ops && !day.error ? <Text variant="caption">{t("Memuat…", "Loading…")}</Text> : null}
          {newKitchen ? <MulaiCard /> : null}
          {offset === "0" ? (
            <>
              {!issues.data && issues.error ? (
                // A failed read must not look like "no reports".
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text selectable variant="caption" style={{ flex: 1, color: c.danger }}>
                    {t("Laporan pelanggan belum bisa dimuat.", "Customer reports could not be loaded.")}
                  </Text>
                  <Button variant="text" label={t("Coba lagi", "Try again")} onPress={() => void issues.reload()} />
                </View>
              ) : null}
              <ReportCards issues={issues.data ?? []} />
              <ActionCards items={attention.data?.items ?? []} />
            </>
          ) : null}
          {ops && session ? (
            <SessionCard
              ops={ops}
              session={session}
              meal={meal}
              date={date}
              report={day.data?.savedAt ? null : offset === "0" ? "today" : "tomorrow"}
              caterer={ops.caterer.name}
            />
          ) : ops && otherSession ? (
            <Card tone="sage">
              <Text selectable>
                {meal === "lunch"
                  ? t("Tidak ada antaran makan siang.", "No lunch deliveries.")
                  : t("Tidak ada antaran makan malam.", "No dinner deliveries.")}
              </Text>
              <Button
                variant="secondary"
                label={
                  other === "lunch"
                    ? t(
                        `Lihat makan siang · ${otherSession.portions} porsi`,
                        `See lunch · ${otherSession.portions} portions`,
                      )
                    : t(
                        `Lihat makan malam · ${otherSession.portions} porsi`,
                        `See dinner · ${otherSession.portions} portions`,
                      )
                }
                onPress={() => setMood(mood === "siang" ? "malam" : "siang")}
              />
            </Card>
          ) : ops && !newKitchen ? (
            <Card tone="sage">
              <Text>{offset === "0" ? t("Tidak ada masakan untuk hari ini.", "Nothing to cook today.") : t("Tidak ada masakan untuk besok.", "Nothing to cook tomorrow.")}</Text>
              <Text variant="caption">{t("Pesanan baru akan muncul di sini.", "New orders will appear here.")}</Text>
            </Card>
          ) : null}
        </View>
      </FadeSwap>
    </Screen>
  );
}

/** Reports still waiting on the caterer, each naming who, which day and meal; tap to answer. */
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
            onPress={() => router.push(`/laporan/${i.id}` as never)}
          >
            <Card tone="attention" style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: fontFor("800") }}>{`${who} ${t("melaporkan masalah", "reported a problem")}`}</Text>
                <Text variant="label">{`${shortDate(i.service_date, locale)} · ${mealLabel(i.meal, locale)}`}</Text>
                <Text variant="caption">{i.subject}</Text>
                {i.status === "responded" ? (
                  <Text variant="caption" style={{ color: c.sunriseInk }}>
                    {t("Sudah dibalas · tandai selesai bila beres", "Replied · mark as done when sorted")}
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
  payment: ["Ada urusan pembayaran", "A payment needs attention"],
};

function ActionCards({ items }: { items: SellerAttentionItem[] }) {
  const { t } = useMobile();
  const c = useColors();
  const shown = items.filter((i) => attentionLabels[i.kind]).slice(0, 3);
  return (
    <>
      {shown.map((item) => {
        const [id, en] = attentionLabels[item.kind]!;
        // "/" is dapurLink's answer for "no Dapur screen for this": Hari ini is already where we are.
        const route = dapurLink(item.href);
        const link = route !== "/";
        const card = (
          <Card tone="attention" style={link ? { flexDirection: "row", alignItems: "center" } : undefined}>
            <View testID={`attention-body-${item.id}`} style={{ flex: link ? 1 : undefined, gap: 10 }}>
              <Text style={{ fontFamily: fontFor("800") }}>{t(id, en)}</Text>
              {item.context ? <Text variant="caption">{item.context}</Text> : null}
            </View>
            {link ? <Ionicons name="chevron-forward" size={18} color={c.muted} /> : null}
          </Card>
        );
        return link ? (
          <PressableRow key={item.id} testID={`attention-${item.id}`} accessibilityRole="link" onPress={() => router.push(route as never)}>
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
  const { scheme } = useThemePreference();
  // The unselected rows sit on the brand card as a faint lift. The card's fill swaps light and dark with the theme,
  // so the lift is the card's own opposite: a light veil on the dark green, a dark veil on the cream.
  const veil = scheme === "dark" ? "rgba(22,61,46,0.08)" : "rgba(255,247,233,0.08)";
  const steps: [string, string, string][] = [
    [t("Buat paket pertama", "Create your first package"), t("Satu layar", "One screen"), "/paket/baru"],
    [t("Pindahkan pelanggan lama", "Bring in existing customers"), t("Kirim foto buku catatan atau chat WhatsApp", "Send a notebook photo or WhatsApp chat"), "/impor"],
    [t("Aktifkan pembayaran", "Turn on payments"), t("Perlu sebelum perpanjangan pertama", "Needed before the first renewal"), "/aktifkan"],
  ];
  return (
    <>
      <Card tone="brand">
        <Text variant="heading" style={{ color: c.cream }}>
          {t("Siapkan dapur Anda", "Set up your kitchen")}
        </Text>
        {steps.map(([title, sub, href], i) => (
          <PressableRow
            key={href}
            accessibilityRole="button"
            onPress={() => router.push(href as never)}
            style={{
              minHeight: 56,
              padding: 12,
              borderRadius: 12,
              backgroundColor: i === 0 ? c.cream : veil,
              gap: 2,
            }}
          >
            <Text style={{ fontFamily: fontFor("800"), color: i === 0 ? c.forest : c.cream }}>{title}</Text>
            <Text variant="caption" style={{ color: i === 0 ? c.muted : c.cream }}>
              {sub}
            </Text>
          </PressableRow>
        ))}
      </Card>
      <Card>
        <Text variant="heading">{t("Nanti di sini", "Coming up here")}</Text>
        <Text variant="caption">
          {t(
            "Setelah pelanggan masuk, halaman ini menunjukkan berapa porsi yang dimasak dan rute antar hari ini dan besok.",
            "Once customers are in, this page shows what to cook and where to deliver today and tomorrow.",
          )}
        </Text>
      </Card>
    </>
  );
}
