import { useEffect, useRef, useState, type ReactNode } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, Text as RNText, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { errorLabel, mealLabel, shortDate, type DeliveryIssue, type Subscription } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  ChoiceList,
  FadeSwap,
  Field,
  fonts,
  FormError,
  ReadError,
  SheetBody,
  SheetHeader,
  sheetSidePadding,
  Skeleton,
  SkeletonGroup,
  Text,
  useColors,
  useHaptic,
  useToast,
  useUnsavedGuard,
} from "@catera/mobile-ui";

type Kind = "help" | "review";

/** The subject goes to support as written here (Indonesian); the example line says what each topic covers. */
const TOPICS = [
  {
    id: "Pembatalan",
    en: "Cancellation",
    example: { id: "Batalkan paket atau sisa harinya", en: "Cancel a package or its remaining days" },
  },
  {
    id: "Pembayaran",
    en: "Payment",
    example: { id: "Sudah bayar, tapi paket belum aktif", en: "Paid, but the package isn't active" },
  },
  {
    id: "Lainnya",
    en: "Other",
    example: { id: "Pertanyaan lain soal paket atau pengantaran", en: "Anything else about a package or delivery" },
  },
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
  t("Permintaannya belum terkirim. Coba lagi.", "Your request didn't send. Try again.");

/**
 * The sheet's frame: the title row over the scrolling form, in one FadeSwap so the form fades in as one block. The
 * header holds its context line (`holdContextLine`) on every render: while the report is read a skeleton keeps the line
 * (null), then the report's subject, day and meal land as one line (read out in full), so the header keeps its height.
 */
function Frame({
  title,
  context,
  swapKey,
  children,
  footer,
}: {
  title: string;
  context?: string | null;
  swapKey: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { t } = useMobile();
  return (
    <View style={{ flex: 1 }}>
      <SheetHeader title={title} context={context} holdContextLine closeLabel={t("Tutup", "Close")} />
      <SheetBody footer={footer}>
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
 * `/bantuan-form?kind=help` ("Minta bantuan": the package, a topic and a few words; `&paket={subscriptionId}` opens it
 * on that package) and
 * `/bantuan-form?kind=review&issue={id}` ("Minta Catera meninjau" a report): native form sheets over Bantuan
 * (`sheetOptions({ detents: "form" })`); from Beli or Bayar the same forms open as `/pembelian/bantuan-form` over the
 * purchase. Sending closes the sheet with the toast "Permintaan bantuan terkirim"; a refusal stays in the sheet.
 * Typed words ask before the sheet closes.
 */
export function HelpForm() {
  const params = useLocalSearchParams<{ kind?: string; issue?: string; paket?: string }>();
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
    <Help key={actor.id} actorId={actor.id} title={title} paket={typeof params.paket === "string" ? params.paket : ""} />
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

/**
 * Which package the request is about, as one row: "Paket" over the package's name. With several packages the row opens
 * them under it as radio rows (`ChoiceList`), and a choice closes them again; with one there is nothing to choose, so
 * the row only names it. The rows run to the sheet's edges like `ChoiceList`, and grow with the text: nothing is cut.
 */
function PaketRow({
  subscriptions,
  chosen,
  onChoose,
}: {
  subscriptions: Subscription[];
  chosen: string;
  onChoose: (id: string) => void;
}) {
  const { t } = useMobile();
  const palette = useColors();
  const haptic = useHaptic();
  const [open, setOpen] = useState(false);
  const ios = process.env.EXPO_OS === "ios";
  const label = t("Paket", "Package");
  const name = subscriptions.find((s) => s.id === chosen)?.snapshot.offer.name ?? "";
  const several = subscriptions.length > 1;
  const body = (
    <>
      <View style={{ flex: 1, gap: 2 }}>
        <RNText style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: palette.muted }}>{label}</RNText>
        <RNText style={{ fontFamily: fonts.semibold, fontSize: ios ? 17 : 16, lineHeight: 22, color: palette.charcoal }}>
          {name}
        </RNText>
      </View>
      {several ? <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color={palette.controlRing} /> : null}
    </>
  );
  const frame = {
    minHeight: 72,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 16,
    paddingHorizontal: sheetSidePadding(),
    paddingVertical: 8,
  };
  return (
    <View style={{ marginHorizontal: -sheetSidePadding() }}>
      {several ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}, ${name}`}
          accessibilityState={{ expanded: open }}
          onPress={() => {
            haptic.select();
            setOpen((v) => !v);
          }}
          android_ripple={{ color: palette.line }}
          style={({ pressed }) => [frame, ios && pressed ? { backgroundColor: palette.sage } : null]}
        >
          {body}
        </Pressable>
      ) : (
        <View style={frame}>{body}</View>
      )}
      {open ? (
        <ChoiceList
          label={label}
          options={subscriptions.map((s) => ({ value: s.id, label: s.snapshot.offer.name }))}
          value={chosen}
          onChange={(id) => {
            onChoose(id);
            setOpen(false);
          }}
        />
      ) : null}
      <View style={{ height: 1, marginStart: sheetSidePadding(), backgroundColor: palette.line }} />
    </View>
  );
}

/** Cancellations, refunds and other requests all enter support: the package, a topic and a few words. */
function Help({ actorId, title, paket }: { actorId: string; title: string; paket: string }) {
  const { runtime, command, t, locale } = useMobile();
  const c = useColors();
  const customer = useData("bantuan-form:customer", () => runtime.api.customer());
  const { text, write, done } = useRequest(`${actorId}:help`, { id: "permintaan", en: "request" });
  const [topic, setTopic] = useState("");
  // The `paket` link names the package to start on; one the customer does not have falls back to the first.
  const [subscriptionId, setSubscriptionId] = useState(paket);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failures, setFailures] = useState(0);
  const subscriptions: Subscription[] = customer.data?.subscriptions ?? [];
  const chosen = subscriptions.some((s) => s.id === subscriptionId) ? subscriptionId : (subscriptions[0]?.id ?? "");

  if (!customer.data)
    return (
      <Frame title={title} swapKey={customer.error ? "error" : "loading"}>
        {customer.error ? (
          <ReadError message={customer.error} onRetry={() => void customer.reload()} />
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
      setFailures((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Frame
      title={title}
      swapKey="ready"
      footer={
        subscriptions.length ? (
          <>
            {error ? <FormError message={error} failureKey={failures} /> : null}
            <Button
              label={t("Kirim permintaan", "Send request")}
              busy={busy}
              disabled={!topic || !chosen || text.trim().length < 5}
              onPress={() => void send()}
            />
          </>
        ) : undefined
      }
    >
      {!subscriptions.length ? (
        <Text style={{ color: c.muted }}>
          {t("Kamu bisa minta bantuan setelah membeli paket.", "You can ask for help once you've bought a package.")}
        </Text>
      ) : (
        <>
          <PaketRow subscriptions={subscriptions} chosen={chosen} onChoose={setSubscriptionId} />
          <View style={{ gap: 4 }}>
            <Text variant="label">{t("Soal apa?", "What is it about?")}</Text>
            {/* Radio rows, not a segmented control: three topics squeezed into one row split their words at large text. */}
            <View style={{ marginHorizontal: -sheetSidePadding() }}>
              <ChoiceList
                label={t("Soal apa?", "What is it about?")}
                value={topic || null}
                onChange={setTopic}
                options={TOPICS.map((x) => ({ value: x.id, label: t(x.id, x.en), detail: t(x.example.id, x.example.en) }))}
              />
            </View>
          </View>
          <Field
            label={t("Ceritakan masalahnya", "Tell us what's wrong")}
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
  const [failures, setFailures] = useState(0);
  const issue = issues.data?.find((i) => i.id === issueId);

  if (!issue)
    return (
      <Frame title={title} context={issues.loading ? null : undefined} swapKey={issues.loading ? "loading" : "missing"}>
        {issues.loading ? (
          <HelpSkeleton />
        ) : (
          issues.error ? (
            <ReadError message={issues.error} onRetry={() => void issues.reload()} />
          ) : (
            <Text style={{ color: c.muted }}>{t("Laporan tidak ditemukan.", "Report not found.")}</Text>
          )
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
      setFailures((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Frame
      title={title}
      context={`${issue.subject} · ${shortDate(issue.service_date, locale)} · ${mealLabel(issue.meal, locale)}`}
      swapKey="ready"
      footer={
        <>
          {error ? <FormError message={error} failureKey={failures} /> : null}
          <Button
            label={t("Kirim ke Catera", "Send to Catera")}
            busy={busy}
            disabled={text.trim().length < 5}
            onPress={() => void escalate()}
          />
        </>
      }
    >
      <Field
        label={t("Apa yang belum beres?", "What is still wrong?")}
        multiline
        value={text}
        onChangeText={write}
        maxLength={2000}
        style={{ minHeight: 88, textAlignVertical: "top", paddingTop: 12 }}
      />
    </Frame>
  );
}

