import { useEffect, useState } from "react";
import { Linking, Pressable, Share, View } from "react-native";
import * as Print from "expo-print";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import {
  cookingRecap,
  deliveryRoute,
  jakartaDay,
  routeShareText,
  type CookingRecap,
  type KitchenMeal,
  type SellerAttentionItem,
  type SellerOperationsState,
  type Stop,
} from "@catera/domain";
import { useData, useMobile, type MobileRuntime } from "@catera/mobile-core";
import { Button, Card, colors, Screen, Segmented, Text } from "@catera/mobile-ui";
import { jakartaClock } from "./exceptions";
import { loadCachedDay, saveCachedDay } from "./offline";
import { canMoveDelivery, ExceptionSheet } from "./ExceptionSheet";

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

/** Hari ini: what to cook, where to take it, and only the exceptions to act on. */
/** Hari ini; `date` (from a notification) opens Besok when it points to tomorrow. */
export function TodayScreen({ date: target }: { date?: string } = {}) {
  const { actor, runtime, t } = useMobile();
  const [offset, setOffset] = useState<"0" | "1">(() => (target === jakartaDay(new Date(), 1) ? "1" : "0"));
  useEffect(() => {
    if (target) setOffset(target === jakartaDay(new Date(), 1) ? "1" : "0");
  }, [target]);
  const [section, setSection] = useState<"masak" | "antar">("masak");
  const catererId = actor?.catererId ?? "";
  const date = jakartaDay(new Date(), Number(offset));
  const day = useData(`ops:${catererId}:${date}`, () => loadDay(runtime, catererId, date));
  const attention = useData(`attention:${catererId}`, () =>
    runtime.api.sellerAttention(catererId, { scope: "future" }),
  );
  const ops = day.data?.data;

  // A kitchen without packages has nothing to cook yet; only the owner can set it up.
  const newKitchen = !!ops && !ops.offers.length && actor?.role === "owner";

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Segmented
            value={offset}
            onChange={setOffset}
            options={[
              { value: "0", label: t("Hari ini", "Today") },
              { value: "1", label: t("Besok", "Tomorrow") },
            ]}
          />
        </View>
      </View>
      <Segmented
        value={section}
        onChange={setSection}
        options={[
          { value: "masak", label: t("Masak", "Cook") },
          { value: "antar", label: t("Antar", "Deliver") },
        ]}
      />
      {day.data?.savedAt ? (
        <Card tone="attention">
          <Text variant="caption" style={{ color: colors.sunriseInk }}>
            {t("Terakhir diperbarui", "Last updated")} {jakartaClock(day.data.savedAt)} ·{" "}
            {t("tidak ada sinyal", "offline")}
          </Text>
        </Card>
      ) : null}
      {!ops && day.error ? <Text style={{ color: colors.danger }}>{day.error}</Text> : null}
      {!ops && !day.error ? <Text variant="caption">{t("Memuat…", "Loading…")}</Text> : null}
      {newKitchen ? <MulaiCard /> : null}
      {offset === "0" ? <ActionCards items={attention.data?.items ?? []} /> : null}
      {ops && section === "masak" ? <Masak ops={ops} /> : null}
      {ops && section === "antar" ? (
        <Antar ops={ops} date={date} report={day.data?.savedAt ? null : offset === "0" ? "today" : "tomorrow"} />
      ) : null}
    </Screen>
  );
}

function Masak({ ops }: { ops: SellerOperationsState }) {
  const { t } = useMobile();
  const recaps = MEALS.map((meal) => [meal, cookingRecap(ops, meal)] as const).filter(
    ([, r]) => r.total > 0,
  );
  if (!recaps.length)
    return <Text>{t("Tidak ada yang dimasak hari ini.", "Nothing to cook today.")}</Text>;
  return (
    <>
      {recaps.map(([meal, recap]) => (
        <RecapCard key={meal} meal={meal} recap={recap} caterer={ops.caterer.name} />
      ))}
    </>
  );
}

function recapLines(recap: CookingRecap, title: string) {
  return [
    `*${title}* (${recap.total} porsi)`,
    ...recap.byDish.map((d) => `${d.count}× ${d.name}`),
  ].join("\n");
}

function RecapCard({ meal, recap, caterer }: { meal: KitchenMeal; recap: CookingRecap; caterer: string }) {
  const { t } = useMobile();
  const title = meal === "lunch" ? t("Makan siang", "Lunch") : t("Makan malam", "Dinner");
  return (
    <Card>
      <Text variant="label" style={{ color: colors.muted }}>
        {title}
      </Text>
      <Text variant="number">{`${recap.total} porsi`}</Text>
      <View>
        <Text variant="label">{t("Per paket", "By package")}</Text>
        {recap.byPackage.map((p) => (
          <Row key={p.packageId} label={p.name} value={p.portions} />
        ))}
      </View>
      <View>
        <Text variant="label">{t("Yang dimasak", "To cook")}</Text>
        {recap.byDish.map((d) => (
          <Row key={d.category + d.name} label={d.name} value={d.count} />
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button
          style={{ flex: 1 }}
          label={t("Bagikan", "Share")}
          onPress={() => void Share.share({ message: `${caterer}\n${recapLines(recap, title)}` })}
        />
        <Button
          style={{ flex: 1 }}
          variant="secondary"
          label={t("Cetak", "Print")}
          onPress={() =>
            void Print.printAsync({
              html: `<h2>${caterer} · ${title}: ${recap.total} porsi</h2><ul>${recap.byDish
                .map((d) => `<li>${d.count} × ${d.name}</li>`)
                .join("")}</ul>`,
            })
          }
        />
      </View>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.line,
      }}
    >
      <Text>{label}</Text>
      <Text style={{ fontWeight: "800" }}>{String(value)}</Text>
    </View>
  );
}

/** Today: report a failed stop or move it. Tomorrow: only move, while the cutoff is ahead. */
const movable = (ops: SellerOperationsState, stop: Stop) => canMoveDelivery(ops.deliveries.find((d) => d.id === stop.deliveryId));

function Antar({ ops, date, report }: { ops: SellerOperationsState; date: string; report: "today" | "tomorrow" | null }) {
  const { t, locale } = useMobile();
  const [meal, setMeal] = useState<KitchenMeal>("lunch");
  const [part, setPart] = useState(0);
  const [reporting, setReporting] = useState<Stop | null>(null);
  const stops = deliveryRoute(ops, meal);
  const parts = routeShareText(stops, { date, meal, caterer: ops.caterer.name }, locale);
  const counts = MEALS.map((m) => deliveryRoute(ops, m).length);
  return (
    <>
      <Segmented
        value={meal}
        onChange={(m) => {
          setMeal(m);
          setPart(0);
        }}
        options={[
          { value: "lunch", label: `${t("Siang", "Lunch")} · ${counts[0]}` },
          { value: "dinner", label: `${t("Malam", "Dinner")} · ${counts[1]}` },
        ]}
      />
      <Card tone="sage">
        <Text variant="caption" style={{ color: colors.forest }}>
          {t(
            "Semua dianggap terkirim setelah jam antar selesai. Tandai hanya kalau ada masalah.",
            "Everything counts as delivered after the delivery window. Only flag problems.",
          )}
        </Text>
      </Card>
      {stops.map((s) => (
        <Card key={s.deliveryId} style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: colors.forest,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: colors.cream, fontWeight: "800", fontSize: 13 }}>{String(s.n)}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontWeight: "800" }}>{s.name}</Text>
            <Text variant="caption">{[s.addressLine, s.area].filter(Boolean).join(", ")}</Text>
            <Text variant="label">{`${s.portions} porsi · ${s.packageName}`}</Text>
            {s.note ? (
              <Text variant="caption" style={{ color: colors.sunriseInk }}>
                {s.note}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`${t("Buka peta", "Open map")} ${s.name}`}
            onPress={() => void Linking.openURL(s.mapsUrl)}
            style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="location-outline" size={22} color={colors.forest} />
          </Pressable>
          {report === "today" || (report === "tomorrow" && movable(ops, s)) ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${report === "today" ? t("Ada masalah", "Problem") : t("Pindah tanggal", "Move date")}: ${s.name}`}
              onPress={() => setReporting(s)}
              style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.muted} />
            </Pressable>
          ) : null}
        </Card>
      ))}
      {stops.length ? (
        <Button
          label={
            part === 0
              ? t("Bagikan rute ke WhatsApp", "Share route to WhatsApp")
              : `${t("Bagikan bagian", "Share part")} ${part + 1}`
          }
          onPress={async () => {
            await Share.share({ message: parts[part] });
            setPart((p) => (p + 1 < parts.length ? p + 1 : 0));
          }}
        />
      ) : (
        <Text>{t("Tidak ada pengantaran untuk waktu ini.", "No deliveries for this meal.")}</Text>
      )}
      {reporting ? (
        <ExceptionSheet
          stop={reporting}
          meal={meal}
          ops={ops}
          allowFailed={report === "today"}
          onClose={() => setReporting(null)}
        />
      ) : null}
    </>
  );
}

const attentionLabels: Partial<Record<SellerAttentionItem["kind"], [string, string]>> = {
  delivery_issue: ["Pelanggan melaporkan masalah", "A customer reported a problem"],
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
        return (
          <Card key={item.id} tone="attention">
            <Text style={{ fontWeight: "800" }}>{t(id, en)}</Text>
            {item.context ? <Text variant="caption">{item.context}</Text> : null}
          </Card>
        );
      })}
    </>
  );
}

function MulaiCard() {
  const { t } = useMobile();
  const steps: [string, string, string][] = [
    [t("Buat paket pertama", "Create your first package"), t("Satu layar, sekitar 3 menit", "One screen, about 3 minutes"), "/paket/baru"],
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
            <Text style={{ fontWeight: "800", color: i === 0 ? colors.forest : colors.cream }}>{title}</Text>
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
