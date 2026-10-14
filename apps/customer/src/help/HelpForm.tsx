import { useEffect, useRef, useState, type ReactNode } from "react";
import { Text as RNText, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { errorLabel, mealLabel, shortDate, type DeliveryIssue, type Subscription } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  FadeSwap,
  Field,
  fontFor,
  PressableScale,
  Segmented,
  SheetBody,
  SheetHeader,
  Skeleton,
  SkeletonGroup,
  Text,
  themedStyles,
  useColors,
  useToast,
  useUnsavedGuard,
} from "@catera/mobile-ui";

type Kind = "help" | "review";

const TOPICS = [
  { id: "Pembatalan", en: "Cancellation" },
  { id: "Pembayaran", en: "Payment" },
  { id: "Lainnya", en: "Other" },
];

/**
 * Requests typed and not sent, per person and subject ("help", or the report under review), in memory only. Android's
 * bottom sheet closes on a swipe before anything can ask (`useUnsavedGuard`), so the words wait here and come back when
 * the form opens again for that subject. Sending or "Buang" drops them; closing the app forgets them.
 */
const drafts = new Map<string, string>();

/** A plain sentence for a refused request: the shared label, or "try again". */
const failure = (e: unknown, locale: "id" | "en", t: (id: string, en: string) => string) =>
  errorLabel((e as { code?: string }).code || (e as Error).message, locale) ||
  t("Belum berhasil. Coba lagi.", "That did not work. Try again.");

/**
 * The sheet's frame: the title row over the scrolling form, in one FadeSwap so the form fades in as one block. The
 * header holds its context line (`holdContextLine`) on every render: while the report is read a skeleton keeps the line
 * (null), then the report's subject, day and meal land as one line (read out in full), so the header keeps its height.
 */
function Frame({ title, context, swapKey, children }: { title: string; context?: string | null; swapKey: string; children: ReactNode }) {
  const { t } = useMobile();
  return (
    <View style={{ flex: 1 }}>
      <SheetHeader title={title} context={context} holdContextLine closeLabel={t("Tutup", "Close")} />
      <SheetBody>
        <FadeSwap swapKey={swapKey} style={{ gap: 12 }}>
          {children}
        </FadeSwap>
      </SheetBody>
    </View>
  );
}

function HelpSkeleton() {
  const { t } = useMobile();
  return (
    <SkeletonGroup label={t("Memuat", "Loading")}>
      <View style={{ gap: 12 }}>
        <Skeleton height={44} radius={10} />
        <Skeleton width="40%" height={12} />
        <Skeleton height={88} radius={9} />
        <Skeleton height={48} radius={10} />
      </View>
    </SkeletonGroup>
  );
}

/**
 * `/bantuan-form?kind=help` ("Minta bantuan": a topic, the package and a few words) and
 * `/bantuan-form?kind=review&issue={id}` ("Minta Catera meninjau" a report): native form sheets over Bantuan
 * (`sheetOptions({ detents: "form" })`); from Beli or Bayar the same forms open as `/pembelian/bantuan-form` over the
 * purchase. Sending closes the sheet with the toast "Permintaan bantuan terkirim"; a refusal stays in the sheet.
 * Typed words ask before the sheet closes.
 */
export function HelpForm() {
  const params = useLocalSearchParams<{ kind?: string; issue?: string }>();
  const { actor, ready, t } = useMobile();
  const kind: Kind = params.kind === "review" ? "review" : "help";
  const issue = typeof params.issue === "string" ? params.issue : "";
  const title = kind === "review" ? t("Minta Catera meninjau", "Ask Catera to review") : t("Minta bantuan", "Ask for help");
  if (!ready || !actor)
    return (
      <Frame title={title} swapKey={ready ? "signin" : "loading"}>
        {ready ? (
          <Button
            label={t("Masuk", "Sign in")}
            onPress={() => router.push({ pathname: "/login", params: { next: "/bantuan" } } as never)}
          />
        ) : (
          <HelpSkeleton />
        )}
      </Frame>
    );
  return kind === "review" ? (
    <Review key={`${actor.id}:${issue}`} actorId={actor.id} issueId={issue} title={title} />
  ) : (
    <Help key={actor.id} actorId={actor.id} title={title} />
  );
}

/** What both forms share: the typed words kept as a draft, the guard, and closing with the toast once sent. */
function useRequest(draftKey: string, noun: { id: string; en: string }) {
  const { t } = useMobile();
  const toast = useToast();
  const [text, setText] = useState(() => drafts.get(draftKey) ?? "");
  const [sent, setSent] = useState(false);
  const closed = useRef(false);
  useUnsavedGuard(!sent && text.trim() !== "", t(noun.id, noun.en), {
    t,
    nounEn: noun.en,
    onDiscard: () => drafts.delete(draftKey),
  });
  // After the guard has seen `sent`, so closing never asks.
  useEffect(() => {
    if (!sent || closed.current) return;
    closed.current = true;
    router.back();
    toast.show({ message: t("Permintaan bantuan terkirim", "Help request sent"), tone: "success" });
  }, [sent, toast, t]);
  const write = (value: string) => {
    setText(value);
    if (value.trim()) drafts.set(draftKey, value);
    else drafts.delete(draftKey);
  };
  const done = () => {
    drafts.delete(draftKey);
    setSent(true);
  };
  return { text, write, done };
}

/** Cancellations, refunds and other requests all enter support: a topic, a few words and the package. */
function Help({ actorId, title }: { actorId: string; title: string }) {
  const { runtime, command, t, locale } = useMobile();
  const c = useColors();
  const styles = useStyles();
  const customer = useData("bantuan-form:customer", () => runtime.api.customer());
  const { text, write, done } = useRequest(`${actorId}:help`, { id: "permintaan", en: "request" });
  const [topic, setTopic] = useState("");
  const [subscriptionId, setSubscriptionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const subscriptions: Subscription[] = customer.data?.subscriptions ?? [];
  const chosen = subscriptions.some((s) => s.id === subscriptionId) ? subscriptionId : (subscriptions[0]?.id ?? "");

  if (!customer.data)
    return (
      <Frame title={title} swapKey={customer.error ? "error" : "loading"}>
        {customer.error ? (
          <>
            <Text selectable style={{ color: c.danger }}>
              {customer.error}
            </Text>
            <Button label={t("Coba lagi", "Try again")} onPress={() => void customer.reload()} />
          </>
        ) : (
          <HelpSkeleton />
        )}
      </Frame>
    );

  async function send() {
    if (busy || !topic || !chosen || text.trim().length < 5) return;
    setBusy(true);
    setError("");
    try {
      await command("support.create", { subscriptionId: chosen, subject: topic, description: text.trim() });
      done();
    } catch (e) {
      setError(failure(e, locale, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Frame title={title} swapKey="ready">
      {!subscriptions.length ? (
        <Text style={{ color: c.muted }}>
          {t("Permintaan bantuan butuh paket yang sudah dibeli.", "A help request needs a package you bought.")}
        </Text>
      ) : (
        <>
          <Segmented<string>
            value={topic}
            onChange={setTopic}
            options={TOPICS.map((x) => ({ value: x.id, label: t(x.id, x.en) }))}
          />
          {subscriptions.length > 1 ? (
            <View style={styles.chips}>
              {subscriptions.map((s) => (
                <PressableScale
                  key={s.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: s.id === chosen }}
                  haptic="select"
                  onPress={() => setSubscriptionId(s.id)}
                  style={[styles.pick, s.id === chosen && styles.pickOn]}
                >
                  <RNText style={[styles.pickText, { color: s.id === chosen ? c.cream : c.charcoal }]}>
                    {s.snapshot.offer.name}
                  </RNText>
                </PressableScale>
              ))}
            </View>
          ) : null}
          <Field
            label={t("Ceritakan kendalanya", "Tell us what is wrong")}
            multiline
            value={text}
            onChangeText={write}
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
            <Text selectable variant="caption" style={{ color: c.danger }}>
              {error}
            </Text>
          ) : null}
          <Button
            label={t("Kirim permintaan", "Send request")}
            disabled={busy || !topic || !chosen || text.trim().length < 5}
            onPress={() => void send()}
          />
        </>
      )}
    </Frame>
  );
}

/** Asks Catera to review a report the caterer has not settled: what is still wrong, in a few words. */
function Review({ actorId, issueId, title }: { actorId: string; issueId: string; title: string }) {
  const { runtime, command, t, locale } = useMobile();
  const c = useColors();
  const issues = useData("bantuan-form:issues", () => runtime.api.request<DeliveryIssue[]>("delivery-issues"));
  const { text, write, done } = useRequest(`${actorId}:review:${issueId}`, { id: "permintaan", en: "request" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const issue = issues.data?.find((i) => i.id === issueId);

  if (!issue)
    return (
      <Frame title={title} context={issues.loading ? null : undefined} swapKey={issues.loading ? "loading" : "missing"}>
        {issues.loading ? (
          <HelpSkeleton />
        ) : (
          <>
            <Text selectable={!!issues.error} style={{ color: issues.error ? c.danger : c.muted }}>
              {issues.error || t("Laporan tidak ditemukan.", "Report not found.")}
            </Text>
            {issues.error ? <Button label={t("Coba lagi", "Try again")} onPress={() => void issues.reload()} /> : null}
          </>
        )}
      </Frame>
    );

  async function escalate() {
    if (busy || !issue || text.trim().length < 5) return;
    setBusy(true);
    setError("");
    try {
      await command("deliveryIssue.escalate", { id: issue.id, version: issue.version, body: text.trim() });
      done();
    } catch (e) {
      setError(failure(e, locale, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Frame
      title={title}
      context={`${issue.subject} · ${shortDate(issue.service_date, locale)} · ${mealLabel(issue.meal, locale)}`}
      swapKey="ready"
    >
      <Field
        label={t("Apa yang belum beres?", "What is still wrong?")}
        multiline
        value={text}
        onChangeText={write}
        maxLength={2000}
        style={{ minHeight: 88, textAlignVertical: "top", paddingTop: 12 }}
      />
      {error ? (
        <Text selectable variant="caption" style={{ color: c.danger }}>
          {error}
        </Text>
      ) : null}
      <Button
        label={t("Kirim ke Catera", "Send to Catera")}
        disabled={busy || text.trim().length < 5}
        onPress={() => void escalate()}
      />
    </Frame>
  );
}

const useStyles = themedStyles((c) => ({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pick: { minHeight: 48, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: c.secondaryBorder, justifyContent: "center" },
  pickOn: { backgroundColor: c.forest, borderColor: c.forest },
  pickText: { fontSize: 13, fontFamily: fontFor("700") },
}));
