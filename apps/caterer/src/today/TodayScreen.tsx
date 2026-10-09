import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import {
  cookingRecap,
  deliveryRoute,
  jakartaDay,
  mealLabel,
  sessionStart,
  shortDate,
  type DeliveryIssue,
  type KitchenMeal,
  type SellerAttentionItem,
  type SellerOperationsState,
} from "@catera/domain";
import { nativeMotion } from "@catera/design-tokens";
import { useData, useMobile, type MobileRuntime } from "@catera/mobile-core";
import {
  Button,
  Card,
  FadeSwap,
  fontFor,
  MoodHeader,
  PressableRow,
  PressableScale,
  Screen,
  Text,
  useColors,
  useMood,
  useMoodColors,
  useReduced,
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

/** A meal has something to cook or to deliver. */
const hasWork = (ops: SellerOperationsState, meal: KitchenMeal) =>
  cookingRecap(ops, meal).total > 0 || deliveryRoute(ops, meal).length > 0;

const ease = Easing.bezier(...nativeMotion.ease);

/**
 * The session's headline numbers on the mood's hero fill: portions to cook, addresses, and when the first window
 * opens. Two stacked fills (Siang under, Malam over) cross-fade with the header's own timing.
 */
function CountCard({ ops, meal }: { ops: SellerOperationsState; meal: KitchenMeal }) {
  const { t } = useMobile();
  const { mood } = useMood();
  const siang = useMoodColors("siang");
  const malam = useMoodColors("malam");
  const palette = useMoodColors();
  const reduced = useReduced();
  const target = mood === "malam" ? 1 : 0;
  const progress = useSharedValue<number>(target);
  useEffect(() => {
    progress.value = reduced ? target : withTiming(target, { duration: nativeMotion.content, easing: ease });
  }, [progress, target, reduced]);
  const fade = useAnimatedStyle(() => ({ opacity: progress.value }));

  const total = cookingRecap(ops, meal).total;
  const addresses = deliveryRoute(ops, meal).length;
  const start = sessionStart(ops, meal);
  const fill = { ...StyleSheet.absoluteFill, borderRadius: 22, borderCurve: "continuous" } as const;
  return (
    <View
      testID="session-count"
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 12,
        padding: 16,
        borderRadius: 22,
        borderCurve: "continuous",
        boxShadow: palette.heroShadow,
      }}
    >
      <View testID="session-count-fill-siang" pointerEvents="none" style={[fill, { backgroundColor: siang.hero }]} />
      <Animated.View
        testID="session-count-fill-malam"
        pointerEvents="none"
        style={[fill, { backgroundColor: malam.hero }, reduced ? { opacity: target } : fade]}
      />
      <View style={{ flexShrink: 1 }}>
        <Text variant="number" style={{ color: palette.heroText }}>
          {String(total)}
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
  );
}

/** Hari ini: the mood's meal as one session with what to cook and where to take it, plus only the exceptions to act on. */
/** Hari ini; `date` (from a notification) opens Besok when it points to tomorrow. */
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
  const mealWork = !!ops && hasWork(ops, meal);
  const otherWork = !!ops && hasWork(ops, other);
  // The meta keeps the kitchen's name while the other day loads, instead of dropping it for a moment.
  const [catererName, setCatererName] = useState("");
  if (ops && ops.caterer.name !== catererName) setCatererName(ops.caterer.name);
  const dayWord = offset === "0" ? t("Hari ini", "Today") : t("Besok", "Tomorrow");

  return (
    <Screen
      header={
        <MoodHeader
          meta={[catererName, dayWord].filter(Boolean).join(" · ")}
          toggle
          title={
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={
                offset === "0"
                  ? t("Ganti hari, sekarang Hari ini", "Change day, now Today")
                  : t("Ganti hari, sekarang Besok", "Change day, now Tomorrow")
              }
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
          {ops && mealWork ? <CountCard ops={ops} meal={meal} /> : null}
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
          {ops && mealWork ? (
            <SessionCard
              ops={ops}
              meal={meal}
              date={date}
              report={day.data?.savedAt ? null : offset === "0" ? "today" : "tomorrow"}
              caterer={ops.caterer.name}
            />
          ) : ops && otherWork ? (
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
                        `Lihat makan siang · ${cookingRecap(ops, other).total} porsi`,
                        `See lunch · ${cookingRecap(ops, other).total} portions`,
                      )
                    : t(
                        `Lihat makan malam · ${cookingRecap(ops, other).total} porsi`,
                        `See dinner · ${cookingRecap(ops, other).total} portions`,
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
