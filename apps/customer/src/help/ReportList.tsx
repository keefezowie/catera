import { useState } from "react";
import { Text as RNText, View } from "react-native";
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
  type SupportCase,
} from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  Card,
  FadeSwap,
  fontFor,
  FormError,
  ReadError,
  Screen,
  Text,
  themedStyles,
  useColors,
} from "@catera/mobile-ui";
import { SignInFirst } from "../account/SignInFirst";
import { FLOW_HREF, pushSheet } from "../nav";
import { ListSkeleton } from "../skeletons";

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

/**
 * Bantuan dan laporan: payment help, the customer's reports and their support cases. "Minta bantuan" and "Minta Catera
 * meninjau" open their forms as native sheets over this list (`/bantuan-form`); from Beli or Bayar (`flow`) the list and
 * its forms open over the purchase instead (`/pembelian/bantuan-form`).
 */
export function ReportList({ flow = false }: { flow?: boolean }) {
  const { actor, ready, t } = useMobile();
  if (!ready)
    return (
      <Screen>
        <ListSkeleton rows={3} label={t("Memuat laporan", "Loading reports")} />
      </Screen>
    );
  if (!actor) return <SignInFirst title={t("Bantuan dan laporan", "Help and reports")} next="/bantuan" />;
  return <List key={actor.id} flow={flow} />;
}

/** The caterer's last word on a report, if they have given one. */
const lastReply = (i: DeliveryIssue) =>
  [...(i.events ?? [])].reverse().find((e) => e.action === "deliveryIssue.respond" || e.action === "deliveryIssue.resolve");

/** The help form route for this list's context: the tab's own sheet, or the copy over the purchase. */
const helpHref = (flow: boolean, query: string) => `${flow ? FLOW_HREF.bantuanForm : "/bantuan-form"}?${query}`;

function List({ flow }: { flow: boolean }) {
  const { runtime, t } = useMobile();
  // The case filter below names its argument `c`, so the palette keeps a longer name here.
  const palette = useColors();
  const params = useLocalSearchParams<{ checkoutId?: string }>();
  const issues = useData("help:issues", () => runtime.api.request<DeliveryIssue[]>("delivery-issues"));
  const customer = useData("help:customer", () => runtime.api.customer());
  // Payment help is a bonus: if the feed fails the list still shows.
  const feed = useData("help:actions", () => runtime.api.customerActions(50));

  if ((!issues.data || !customer.data) && (issues.error || customer.error))
    return (
      <Screen>
        <ReadError
          art
          message={issues.error || customer.error}
          onRetry={() => {
            void issues.reload();
            void customer.reload();
          }}
        />
      </Screen>
    );
  if (!issues.data || !customer.data)
    return (
      <Screen>
        <FadeSwap swapKey="loading">
          <ListSkeleton rows={3} label={t("Memuat laporan", "Loading reports")} />
        </FadeSwap>
      </Screen>
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
      {/* The reports fade in from their skeleton as one block. */}
      <FadeSwap swapKey="ready" style={{ gap: 16 }}>
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
        {customer.data.subscriptions.length ? (
          <Button
            variant="secondary"
            label={t("Minta bantuan", "Ask for help")}
            onPress={() => pushSheet(helpHref(flow, "kind=help") as never)}
          />
        ) : null}
        {reports.map((r) => (
          <ReportCard key={r.id} issue={r} flow={flow} />
        ))}
        {cases.map((c) => (
          <CaseCard key={c.id} item={c} refunds={refunds.filter((x) => x.case_id === c.id)} />
        ))}
        {!reports.length && !cases.length && !payments.length ? (
          <View style={{ gap: 4, paddingTop: 8 }}>
            <Text variant="heading">{t("Belum ada laporan.", "No reports yet.")}</Text>
            <Text style={{ color: palette.muted }}>
              {t(
                "Kalau ada masalah dengan makanan, laporkan dari hari yang bersangkutan di Jadwal.",
                "If something is wrong with a meal, report it from that day in Jadwal.",
              )}
            </Text>
          </View>
        ) : null}
        {issues.error || customer.error ? (
          <ReadError
            message={issues.error || customer.error}
            onRetry={() => {
              void issues.reload();
              void customer.reload();
            }}
          />
        ) : null}
      </FadeSwap>
    </Screen>
  );
}

function StatusPill({ status }: { status: string }) {
  const { t } = useMobile();
  const c = useColors();
  const styles = useStyles();
  // Only the caterer's reply needs the customer to act, so only it takes the cream pill.
  const needsYou = status === "responded";
  return (
    <View style={[styles.pill, needsYou ? styles.pillOpen : styles.pillDone]}>
      <RNText style={[styles.pillText, { color: c.charcoal }]}>
        {statusWord(status, t)}
      </RNText>
    </View>
  );
}

function ReportCard({ issue: i, flow }: { issue: DeliveryIssue; flow: boolean }) {
  const { t, locale } = useMobile();
  const c = useColors();
  const styles = useStyles();
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
        <Text variant="caption" style={{ color: c.muted, fontVariant: ["tabular-nums"] }}>
          {hint}
        </Text>
      ) : null}
      {canEscalate ? (
        // What is still wrong goes in a form sheet over this list.
        <Button
          variant="secondary"
          label={t("Minta Catera meninjau", "Ask Catera to review")}
          onPress={() => pushSheet(helpHref(flow, `kind=review&issue=${encodeURIComponent(i.id)}`) as never)}
        />
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
  const styles = useStyles();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failures, setFailures] = useState(0);
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
          busy={busy}
          onPress={() => {
            setBusy(true);
            setError("");
            command("support.escalate", { id: c.id })
              .catch((e) => {
                setError(
                  errorLabel((e as { code?: string }).code || (e as Error).message, locale) ||
                    t("Belum berhasil. Coba lagi.", "That did not work. Try again."),
                );
                setFailures((n) => n + 1);
              })
              .finally(() => setBusy(false));
          }}
        />
      ) : null}
      {error ? <FormError message={error} failureKey={failures} /> : null}
    </Card>
  );
}

const useStyles = themedStyles((c) => ({
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  pill: { minHeight: 28, paddingHorizontal: 10, borderRadius: 14, justifyContent: "center" },
  pillOpen: { backgroundColor: c.cream },
  pillDone: { backgroundColor: c.sage },
  pillText: { fontSize: 12, fontFamily: fontFor("700") },
  reply: { gap: 2, padding: 12, borderRadius: 12, backgroundColor: c.sage },
}));
