import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text as RNText, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { dayLabel, errorLabel, jakartaDay, mealLabel, type Delivery } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, Card, colors, Field, fontFor, PressableScale, Screen, Text } from "@catera/mobile-ui";
import { SignInFirst } from "../account/SignInFirst";
import { ChatKatering, catererPhoneOf } from "./ChatKatering";

type Kind = "belum" | "kurang" | "layak";

/** The subject goes to the caterer as written here (Indonesian), whatever language the app is in. */
const KINDS: { id: Kind; subject: string; en: string }[] = [
  { id: "belum", subject: "Belum sampai", en: "Has not arrived" },
  { id: "kurang", subject: "Ada yang kurang atau salah", en: "Something is missing or wrong" },
  { id: "layak", subject: "Makanan tidak layak", en: "The food is not fit to eat" },
];
/** The command needs a body of at least five characters; the note is optional for the customer. */
const WITHOUT_NOTE = "Tanpa catatan tambahan.";

/** Ada masalah: three choices, an optional note, then what happens next. */
export function ReportProblem() {
  const params = useLocalSearchParams<{ id: string; meal?: string; jenis?: string }>();
  const { actor, ready, t } = useMobile();
  const { id } = params;
  const query = new URLSearchParams(
    Object.entries({ meal: params.meal, jenis: params.jenis }).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  ).toString();
  if (!ready)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  if (!actor)
    return (
      <SignInFirst
        title={t("Ada masalah", "Report a problem")}
        next={`/masalah/${id}${query ? `?${query}` : ""}`}
      />
    );
  return <Report key={`${actor.id}:${id}`} id={id} meal={params.meal} jenis={params.jenis} />;
}

function Report({ id, meal: wanted, jenis }: { id: string; meal?: string; jenis?: string }) {
  const { runtime, command, t, locale } = useMobile();
  const state = useData(`report:${id}`, () => runtime.api.customer(`?deliveryId=${encodeURIComponent(id)}`));
  const [kind, setKind] = useState<Kind | "">(KINDS.some((k) => k.id === jenis) ? (jenis as Kind) : "");
  const [note, setNote] = useState("");
  const [meal, setMeal] = useState<string | undefined>(wanted);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const d: Delivery | undefined = state.data?.deliveries.find((x) => x.id === id);

  // A day with every meal cancelled has nothing to report: say so rather than offer a form that cannot send.
  if (!d || !(d.meals ?? []).some((m) => m.status !== "cancelled"))
    return (
      <Screen>
        {state.loading ? (
          <ActivityIndicator color={colors.forest} />
        ) : (
          <>
            <Text style={{ color: state.error ? colors.danger : colors.muted }}>
              {state.error || t("Pengantaran tidak ditemukan.", "Delivery not found.")}
            </Text>
            {state.error ? <Button label={t("Coba lagi", "Try again")} onPress={() => void state.reload()} /> : null}
          </>
        )}
      </Screen>
    );

  const meals = (d.meals ?? []).filter((m) => m.status !== "cancelled");
  const current = meals.find((m) => m.meal === meal) ?? meals[0];
  const caterer = d.offer.caterer;
  const toBantuan = () => router.replace("/bantuan" as never);
  const when = `${dayLabel(d.service_date, jakartaDay(new Date()), locale)} · ${d.offer.name}`;

  // The sent screen wins over the form even though the reload now shows the new report.
  if (sent)
    return (
      <Screen>
        <View style={{ gap: 2 }}>
          <Text variant="title">{t("Laporan terkirim", "Report sent")}</Text>
          <Text variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
            {when}
          </Text>
        </View>
        <Card style={{ gap: 14 }}>
          {[
            t(`Sekarang: ${caterer} mendapat laporan Anda.`, `Now: ${caterer} has your report.`),
            t(
              `Sampai besok 12.00: ${caterer} membalas atau mengganti di sini.`,
              `By tomorrow 12:00: ${caterer} replies or replaces it here.`,
            ),
            t(
              "Belum beres? Catera meninjau dan bisa mengembalikan dana hari ini.",
              "Still not sorted? Catera reviews it and can refund today.",
            ),
          ].map((line, i) => (
            <View key={i} style={styles.step}>
              <View style={styles.badge}>
                <RNText style={styles.badgeText}>{String(i + 1)}</RNText>
              </View>
              <Text style={{ flex: 1, fontVariant: ["tabular-nums"] }}>{line}</Text>
            </View>
          ))}
        </Card>
        <Button label={t("Lihat laporan saya", "See my reports")} onPress={toBantuan} />
        <Button variant="text" label={t("Kembali", "Back")} onPress={() => router.back()} />
      </Screen>
    );

  async function send() {
    if (busy || !kind || !current) return;
    setBusy(true);
    setError("");
    try {
      await command("deliveryIssue.create", {
        deliveryId: d!.id,
        meal: current.meal,
        subject: KINDS.find((k) => k.id === kind)!.subject,
        body: note.trim() || WITHOUT_NOTE,
      });
      setSent(true);
    } catch (e) {
      const code = (e as { code?: string }).code || (e as Error).message;
      if (code === "CONFLICT") {
        setError(t("Laporan untuk makan ini sudah terkirim.", "A report for this meal was already sent."));
        void state.reload();
      } else if (code === "NOT_ALLOWED") {
        // The server takes reports only for today or earlier in Jakarta.
        setError(
          t(
            "Laporan bisa dikirim mulai hari pengantaran, setelah jam antar dimulai.",
            "You can report from the delivery day, once the delivery window starts.",
          ),
        );
      } else setError(errorLabel(code, locale) || t("Belum berhasil. Coba lagi.", "That did not work. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ gap: 2 }}>
        <Text variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
          {when} · {caterer}
        </Text>
      </View>
      {meals.length > 1 ? (
        <View style={{ flexDirection: "row", gap: 8 }} accessibilityRole="radiogroup">
          {meals.map((m) => {
            const checked = m.meal === current?.meal;
            return (
              <PressableScale
                key={m.meal}
                haptic="select"
                accessibilityRole="radio"
                accessibilityLabel={mealLabel(m.meal, locale)}
                accessibilityState={{ checked }}
                onPress={() => setMeal(m.meal)}
                style={[styles.mealChoice, checked && styles.on]}
              >
                <RNText style={[styles.choiceLabel, { color: checked ? colors.cream : colors.charcoal }]}>
                  {mealLabel(m.meal, locale)}
                </RNText>
              </PressableScale>
            );
          })}
        </View>
      ) : null}
      {current?.issue ? (
        <>
          <Card tone="sage">
            <Text>{t("Laporan untuk makan ini sudah terkirim.", "A report for this meal was already sent.")}</Text>
          </Card>
          <Button label={t("Lihat laporan saya", "See my reports")} onPress={toBantuan} />
        </>
      ) : (
        <>
          <View style={{ gap: 8 }} accessibilityRole="radiogroup">
            <Text variant="label">{t("Apa yang terjadi?", "What happened?")}</Text>
            {KINDS.map((k) => {
              const checked = kind === k.id;
              return (
                <PressableScale
                  key={k.id}
                  haptic="select"
                  accessibilityRole="radio"
                  accessibilityLabel={k.subject}
                  accessibilityState={{ checked }}
                  onPress={() => setKind(k.id)}
                  style={[styles.choice, checked && styles.on]}
                >
                  <RNText style={[styles.choiceLabel, { color: checked ? colors.cream : colors.charcoal }]}>
                    {t(k.subject, k.en)}
                  </RNText>
                </PressableScale>
              );
            })}
          </View>
          <Field
            label={t("Catatan (boleh dikosongkan)", "Note (optional)")}
            multiline
            value={note}
            onChangeText={setNote}
            maxLength={2000}
            style={{ minHeight: 88, textAlignVertical: "top", paddingTop: 12 }}
          />
          {error ? (
            <Text variant="caption" style={{ color: colors.danger }}>
              {error}
            </Text>
          ) : null}
          <Button label={t("Kirim laporan", "Send report")} disabled={!kind || busy} onPress={() => void send()} />
          <ChatKatering
            phone={catererPhoneOf(d)}
            variant="text"
            label={t(`Atau chat ${caterer} di WhatsApp dulu`, `Or chat ${caterer} on WhatsApp first`)}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
  choice: {
    minHeight: 56,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  mealChoice: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  on: { backgroundColor: colors.forest, borderColor: colors.forest },
  choiceLabel: { fontSize: 15, fontFamily: fontFor("700") },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.forest,
  },
  badgeText: { fontSize: 13, fontFamily: fontFor("800"), color: colors.cream },
});
