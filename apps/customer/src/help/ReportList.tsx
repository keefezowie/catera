import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text as RNText, View } from "react-native";
import { router } from "expo-router";
import {
  currency,
  errorLabel,
  mealLabel,
  shortDate,
  type CustomerActionItem,
  type DeliveryIssue,
  type SupportCase,
} from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, Card, colors, Field, FONT, Screen, Text } from "@catera/mobile-ui";
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
  const { runtime, t, locale } = useMobile();
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
  const payments = (feed.data?.items ?? []).filter(
    (i: CustomerActionItem) => i.kind === "payment_action" && i.status === "awaiting_payment",
  );
  const refunds = customer.data.refunds ?? [];

  return (
    <Screen>
      {payments.map((p) => (
        <Card key={p.id} tone="attention">
          <Text variant="heading">{t("Pembayaran belum selesai", "Payment not finished")}</Text>
          <Text variant="caption">{[p.packageName, p.catererName].filter(Boolean).join(" · ")}</Text>
          <Button
            label={t("Buka pembayaran", "Open payment")}
            onPress={() => router.push(`/payment/${encodeURIComponent(p.id.replace(/^payment-/, ""))}` as never)}
          />
        </Card>
      ))}
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
  const settled = status === "resolved";
  return (
    <View style={[styles.pill, settled ? styles.pillDone : styles.pillOpen]}>
      <RNText style={[styles.pillText, { color: settled ? colors.forest : colors.sunriseInk }]}>
        {statusWord(status, t)}
      </RNText>
    </View>
  );
}

function ReportCard({ issue: i }: { issue: DeliveryIssue }) {
  const { command, t, locale } = useMobile();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reply = lastReply(i);
  const canEscalate = !i.case_id && (i.status === "responded" || i.status === "resolved");

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
  pillText: { fontFamily: FONT, fontSize: 12, fontWeight: "700" },
  reply: { gap: 2, padding: 12, borderRadius: 12, backgroundColor: colors.sage },
});
