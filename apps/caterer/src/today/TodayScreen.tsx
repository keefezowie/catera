import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import {
  cookingRecap,
  deliveryRoute,
  jakartaDay,
  mealLabel,
  shortDate,
  type DeliveryIssue,
  type KitchenMeal,
  type SellerAttentionItem,
  type SellerOperationsState,
} from "@catera/domain";
import { useData, useMobile, type MobileRuntime } from "@catera/mobile-core";
import { Button, Card, colors, FadeSwap, fontFor, PressableRow, Screen, Segmented, Text } from "@catera/mobile-ui";
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

const MEALS: KitchenMeal[] = ["lunch", "dinner"];

/** Hari ini: one card per meal with what to cook and where to take it, plus only the exceptions to act on. */
/** Hari ini; `date` (from a notification) opens Besok when it points to tomorrow. */
export function TodayScreen({ date: target }: { date?: string } = {}) {
  const { actor, runtime, t, locale } = useMobile();
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
  // Lunch first; a meal gets a card when there is something to cook or to deliver.
  const sessions = ops
    ? MEALS.filter((meal) => cookingRecap(ops, meal).total > 0 || deliveryRoute(ops, meal).length > 0)
    : [];

  return (
    <Screen>
      <Text variant="title">{shortDate(date, locale)}</Text>
      <Segmented
        value={offset}
        onChange={setOffset}
        options={[
          { value: "0", label: t("Hari ini", "Today") },
          { value: "1", label: t("Besok", "Tomorrow") },
        ]}
      />
      <FadeSwap swapKey={offset}>
        <View style={{ gap: 16 }}>
          {day.data?.savedAt ? (
            <Card tone="attention">
              <Text variant="caption" style={{ color: colors.sunriseInk }}>
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
                  <Text variant="caption" style={{ flex: 1, color: colors.danger }}>
                    {t("Laporan pelanggan belum bisa dimuat.", "Customer reports could not be loaded.")}
                  </Text>
                  <Button variant="text" label={t("Coba lagi", "Try again")} onPress={() => void issues.reload()} />
                </View>
              ) : null}
              <ReportCards issues={issues.data ?? []} />
              <ActionCards items={attention.data?.items ?? []} />
            </>
          ) : null}
          {ops && sessions.length ? (
            sessions.map((meal) => (
              <SessionCard
                key={meal}
                ops={ops}
                meal={meal}
                date={date}
                report={day.data?.savedAt ? null : offset === "0" ? "today" : "tomorrow"}
                caterer={ops.caterer.name}
              />
            ))
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
  const waiting = issues.filter((i) => !i.case_id && (i.status === "open" || i.status === "responded"));
  return (
    <>
      {waiting.map((i) => {
        const who = i.customerName || t("Pelanggan", "A customer");
        return (
          <Pressable
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
                  <Text variant="caption" style={{ color: colors.sunriseInk }}>
                    {t("Sudah dibalas · tandai selesai bila beres", "Replied · mark as done when sorted")}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.forest} />
            </Card>
          </Pressable>
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
  const shown = items.filter((i) => attentionLabels[i.kind]).slice(0, 3);
  return (
    <>
      {shown.map((item) => {
        const [id, en] = attentionLabels[item.kind]!;
        // "/" is dapurLink's answer for "no Dapur screen for this": Hari ini is already where we are.
        const route = dapurLink(item.href);
        const card = (
          <Card tone="attention">
            <Text style={{ fontFamily: fontFor("800") }}>{t(id, en)}</Text>
            {item.context ? <Text variant="caption">{item.context}</Text> : null}
          </Card>
        );
        return route === "/" ? (
          <View key={item.id}>{card}</View>
        ) : (
          <PressableRow key={item.id} accessibilityRole="link" onPress={() => router.push(route as never)}>
            {card}
          </PressableRow>
        );
      })}
    </>
  );
}

function MulaiCard() {
  const { t } = useMobile();
  const steps: [string, string, string][] = [
    [t("Buat paket pertama", "Create your first package"), t("Satu layar", "One screen"), "/paket/baru"],
    [t("Pindahkan pelanggan lama", "Bring in existing customers"), t("Kirim foto buku catatan atau chat WhatsApp", "Send a notebook photo or WhatsApp chat"), "/impor"],
    [t("Aktifkan pembayaran", "Turn on payments"), t("Perlu sebelum perpanjangan pertama", "Needed before the first renewal"), "/aktifkan"],
  ];
  return (
    <>
      <Card tone="brand">
        <Text variant="heading" style={{ color: colors.cream }}>
          {t("Siapkan dapur Anda", "Set up your kitchen")}
        </Text>
        {steps.map(([title, sub, href], i) => (
          <Pressable
            key={href}
            accessibilityRole="button"
            onPress={() => router.push(href as never)}
            style={{
              minHeight: 56,
              padding: 12,
              borderRadius: 12,
              backgroundColor: i === 0 ? colors.cream : "rgba(255,247,233,0.08)",
              gap: 2,
            }}
          >
            <Text style={{ fontFamily: fontFor("800"), color: i === 0 ? colors.forest : colors.cream }}>{title}</Text>
            <Text variant="caption" style={{ color: i === 0 ? colors.muted : colors.cream }}>
              {sub}
            </Text>
          </Pressable>
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
