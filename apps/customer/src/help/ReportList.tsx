import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text as RNText, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  addDays,
  currency,
  errorLabel,
  jakartaDay,
  mealLabel,
  shortDate,
  type CustomerActionItem,
  type DeliveryIssue,
  type Subscription,
  type SupportCase,
} from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, Card, colors, Field, fontFor, Screen, Segmented, Text } from "@catera/mobile-ui";
import { SignInFirst } from "../account/SignInFirst";

/** Plain status words shared by reports and support cases. */
export function statusWord(status: string, t: (id: string, en: string) => string): string {
  switch (status) {
    case "responded":
      return t("Dibalas", "Replied");
    case "escalated":
      return t("Ditinjau Catera", "Catera is reviewing");
    case "resolved":
      return t("Selesai", "Done");
    default:
      return t("Terkirim", "Sent");
  }
}

/** Bantuan dan laporan: payment help, the customer's reports and their support cases. */
export function ReportList() {
  const { actor, ready, t } = useMobile();
  if (!ready)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  if (!actor) return <SignInFirst title={t("Bantuan dan laporan", "Help and reports")} next="/bantuan" />;
  return <List key={actor.id} />;
}

/** The caterer's last word on a report, if they have given one. */
const lastReply = (i: DeliveryIssue) =>
  [...(i.events ?? [])].reverse().find((e) => e.action === "deliveryIssue.respond" || e.action === "deliveryIssue.resolve");

function List() {
  const { runtime, t } = useMobile();
  const params = useLocalSearchParams<{ checkoutId?: string }>();
  const issues = useData("help:issues", () => runtime.api.request<DeliveryIssue[]>("delivery-issues"));
  const customer = useData("help:customer", () => runtime.api.customer());
  // Payment help is a bonus: if the feed fails the list still shows.
  const feed = useData("help:actions", () => runtime.api.customerActions(50));

  if ((!issues.data || !customer.data) && (issues.error || customer.error))
    return (
      <Screen>
        <Text style={{ color: colors.danger }}>{issues.error || customer.error}</Text>
        <Button
          label={t("Coba lagi", "Try again")}
          onPress={() => {
            void issues.reload();
            void customer.reload();
          }}
        />
      </Screen>
    );
  if (!issues.data || !customer.data)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );

  const reports = [...issues.data].sort((a, b) => Number(a.status === "resolved") - Number(b.status === "resolved"));
  // A report Catera took over also has a case: show it once, as the report.
  const taken = new Set(reports.map((r) => r.case_id).filter(Boolean));
  const cases = customer.data.cases.filter((c) => !taken.has(c.id));
  const refunds = customer.data.refunds ?? [];
  // Payment help: the checkout the customer came from, in whatever unpaid state it is in (it may even have
  // left the feed after failing); otherwise every checkout waiting for payment.
  const paymentItems = (feed.data?.items ?? []).filter((i: CustomerActionItem) => i.kind === "payment_action");
  const checkoutId = typeof params.checkoutId === "string" ? params.checkoutId : "";
  const payments: { id: string; detail: string }[] = checkoutId
    ? [
        {
          id: checkoutId,
          detail: [
            paymentItems.find((i) => i.id === `payment-${checkoutId}`)?.packageName,
            paymentItems.find((i) => i.id === `payment-${checkoutId}`)?.catererName,
          ]
            .filter(Boolean)
            .join(" · "),
        },
      ]
    : paymentItems
        .filter((i) => i.status === "awaiting_payment")
        .map((i) => ({ id: i.id.replace(/^payment-/, ""), detail: [i.packageName, i.catererName].filter(Boolean).join(" · ") }));

  return (
    <Screen>
      {payments.map((p) => (
        <Card key={p.id} tone="attention">
          <Text variant="heading">{t("Pembayaran belum selesai", "Payment not finished")}</Text>
          {p.detail ? <Text variant="caption">{p.detail}</Text> : null}
          <Button
            label={t("Buka pembayaran", "Open payment")}
            onPress={() => router.push(`/payment/${encodeURIComponent(p.id)}` as never)}
          />
        </Card>
      ))}
      {customer.data.subscriptions.length ? <AskForHelp subscriptions={customer.data.subscriptions} /> : null}
      {reports.map((r) => (
        <ReportCard key={r.id} issue={r} />
      ))}
      {cases.map((c) => (
        <CaseCard key={c.id} item={c} refunds={refunds.filter((x) => x.case_id === c.id)} />
      ))}
      {!reports.length && !cases.length && !payments.length ? (
        <View style={{ gap: 4, paddingTop: 8 }}>
          <Text variant="heading">{t("Belum ada laporan.", "No reports yet.")}</Text>
          <Text style={{ color: colors.muted }}>
            {t(
              "Kalau ada masalah dengan makanan, laporkan dari hari yang bersangkutan di Jadwal.",
              "If something is wrong with a meal, report it from that day in Jadwal.",
            )}
          </Text>
        </View>
      ) : null}
      {issues.error || customer.error ? (
        <Text variant="caption" style={{ color: colors.danger }}>
          {issues.error || customer.error}
        </Text>
      ) : null}
    </Screen>
  );
}

function StatusPill({ status }: { status: string }) {
  const { t } = useMobile();
  // Only the caterer's reply needs the customer to act, so only it is Sunrise.
  const needsYou = status === "responded";
  return (
    <View style={[styles.pill, needsYou ? styles.pillOpen : styles.pillDone]}>
      <RNText style={[styles.pillText, { color: needsYou ? colors.sunriseInk : colors.charcoal }]}>
        {statusWord(status, t)}
      </RNText>
    </View>
  );
}

const TOPICS = [
  { id: "Pembatalan", en: "Cancellation" },
  { id: "Pembayaran", en: "Payment" },
  { id: "Lainnya", en: "Other" },
];

/** Cancellations, refunds and other requests all enter support: a topic, a few words and the package. */
function AskForHelp({ subscriptions }: { subscriptions: Subscription[] }) {
  const { command, t, locale } = useMobile();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [subscriptionId, setSubscriptionId] = useState(subscriptions[0]?.id ?? "");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const chosen = subscriptions.some((s) => s.id === subscriptionId) ? subscriptionId : (subscriptions[0]?.id ?? "");

  if (!open)
    return <Button variant="secondary" label={t("Minta bantuan", "Ask for help")} onPress={() => setOpen(true)} />;

  async function send() {
    if (busy || !topic || !chosen || text.trim().length < 5) return;
    setBusy(true);
    setError("");
    try {
      await command("support.create", { subscriptionId: chosen, subject: topic, description: text.trim() });
      setOpen(false);
      setTopic("");
      setText("");
    } catch (e) {
      setError(
        errorLabel((e as { code?: string }).code || (e as Error).message, locale) ||
          t("Belum berhasil. Coba lagi.", "That did not work. Try again."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ gap: 12 }}>
      <Text variant="heading">{t("Minta bantuan", "Ask for help")}</Text>
      <Segmented<string>
        value={topic}
        onChange={setTopic}
        options={TOPICS.map((x) => ({ value: x.id, label: t(x.id, x.en) }))}
      />
      {subscriptions.length > 1 ? (
        <View style={styles.chips}>
          {subscriptions.map((s) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityState={{ selected: s.id === chosen }}
              onPress={() => setSubscriptionId(s.id)}
              style={[styles.pick, s.id === chosen && styles.pickOn]}
            >
              <RNText style={[styles.pickText, { color: s.id === chosen ? colors.cream : colors.forest }]}>
                {s.snapshot.offer.name}
              </RNText>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Field
        label={t("Ceritakan kendalanya", "Tell us what is wrong")}
        multiline
        value={text}
        onChangeText={setText}
        maxLength={2000}
        style={{ minHeight: 88, textAlignVertical: "top", paddingTop: 12 }}
      />
      <Text variant="caption">
        {t(
          "Katering membalas lebih dulu. Pembatalan dan pengembalian dana selalu ditinjau.",
          "The caterer replies first. Cancellations and refunds are always reviewed.",
        )}
      </Text>
      {error ? (
        <Text variant="caption" style={{ color: colors.danger }}>
          {error}
        </Text>
      ) : null}
      <Button
        label={t("Kirim permintaan", "Send request")}
        disabled={busy || !topic || !chosen || text.trim().length < 5}
        onPress={() => void send()}
      />
      <Button variant="text" label={t("Batal", "Cancel")} onPress={() => setOpen(false)} />
    </Card>
  );
}

function ReportCard({ issue: i }: { issue: DeliveryIssue }) {
  const { command, t, locale } = useMobile();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reply = lastReply(i);
  // An unanswered report can go to Catera from 12.00 Jakarta the day after it was sent; a reply or a
  // "done" from the caterer can be questioned at any time. Days and the noon mark are Jakarta's (+07:00).
  const now = new Date();
  const sentDay = jakartaDay(new Date(i.created_at));
  const waiting = i.status === "open" && now < new Date(`${addDays(sentDay, 1)}T12:00:00+07:00`);
  const canEscalate = !i.case_id && !waiting && i.status !== "escalated";
  const hint =
    sentDay === jakartaDay(now)
      ? t("Bisa minta Catera meninjau mulai besok 12.00", "You can ask Catera to review from tomorrow 12.00")
      : t("Bisa minta Catera meninjau hari ini 12.00", "You can ask Catera to review from today 12.00");

  async function escalate() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await command("deliveryIssue.escalate", { id: i.id, version: i.version, body: reason.trim() });
      setAsking(false);
    } catch (e) {
      setError(
        errorLabel((e as { code?: string }).code || (e as Error).message, locale) ||
          t("Belum berhasil. Coba lagi.", "That did not work. Try again."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ gap: 8 }}>
      <View style={styles.head}>
        <Text variant="heading" style={{ flex: 1 }}>
          {i.subject}
        </Text>
        <StatusPill status={i.status} />
      </View>
      <Text variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
        {i.package_name} · {shortDate(i.service_date, locale)} · {mealLabel(i.meal, locale)}
      </Text>
      {reply ? (
        <View style={styles.reply}>
          <Text variant="label">{t("Balasan katering", "Caterer's reply")}</Text>
          <Text>{reply.body}</Text>
        </View>
      ) : null}
      {waiting && !i.case_id ? (
        <Text variant="caption" style={{ color: colors.muted, fontVariant: ["tabular-nums"] }}>
          {hint}
        </Text>
      ) : null}
      {canEscalate && !asking ? (
        <Button variant="secondary" label={t("Minta Catera meninjau", "Ask Catera to review")} onPress={() => setAsking(true)} />
      ) : null}
      {asking ? (
        <>
          <Field
            label={t("Apa yang belum beres?", "What is still wrong?")}
            multiline
            value={reason}
            onChangeText={setReason}
            maxLength={2000}
            style={{ minHeight: 88, textAlignVertical: "top", paddingTop: 12 }}
          />
          {error ? (
            <Text variant="caption" style={{ color: colors.danger }}>
              {error}
            </Text>
          ) : null}
          <Button
            label={t("Kirim ke Catera", "Send to Catera")}
            disabled={busy || reason.trim().length < 5}
            onPress={() => void escalate()}
          />
          <Button variant="text" label={t("Batal", "Cancel")} onPress={() => setAsking(false)} />
        </>
      ) : null}
    </Card>
  );
}

function CaseCard({
  item: c,
  refunds,
}: {
  item: SupportCase;
  refunds: { id: string; amount: number; state: string }[];
}) {
  const { command, t, locale } = useMobile();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Card style={{ gap: 8 }}>
      <View style={styles.head}>
        <Text variant="heading" style={{ flex: 1 }}>
          {c.subject}
        </Text>
        <StatusPill status={c.status} />
      </View>
      {c.resolution ? <Text>{c.resolution}</Text> : null}
      {refunds.map((r) => (
        <Text key={r.id} variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
          {r.state === "succeeded"
            ? t(`Dana ${currency(r.amount, locale)} sudah dikembalikan.`, `${currency(r.amount, locale)} has been refunded.`)
            : t(`Dana ${currency(r.amount, locale)} sedang diproses.`, `${currency(r.amount, locale)} is being processed.`)}
        </Text>
      ))}
      {c.status === "responded" ? (
        <Button
          variant="secondary"
          label={t("Minta Catera meninjau", "Ask Catera to review")}
          disabled={busy}
          onPress={() => {
            setBusy(true);
            setError("");
            command("support.escalate", { id: c.id })
              .catch((e) =>
                setError(
                  errorLabel((e as { code?: string }).code || (e as Error).message, locale) ||
                    t("Belum berhasil. Coba lagi.", "That did not work. Try again."),
                ),
              )
              .finally(() => setBusy(false));
          }}
        />
      ) : null}
      {error ? (
        <Text variant="caption" style={{ color: colors.danger }}>
          {error}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  pill: { minHeight: 28, paddingHorizontal: 10, borderRadius: 14, justifyContent: "center" },
  pillOpen: { backgroundColor: colors.cream },
  pillDone: { backgroundColor: colors.sage },
  pillText: { fontSize: 12, fontFamily: fontFor("700") },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pick: { minHeight: 44, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: "#CDD4C4", justifyContent: "center" },
  pickOn: { backgroundColor: colors.forest, borderColor: colors.forest },
  pickText: { fontSize: 13, fontFamily: fontFor("700") },
  reply: { gap: 2, padding: 12, borderRadius: 12, backgroundColor: colors.sage },
});
