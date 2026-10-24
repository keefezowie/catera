import { createContext, use, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Linking, View, type ViewStyle } from "react-native";
import { router } from "expo-router";
import {
  addDays,
  errorLabel,
  jakartaDay,
  mealLabel,
  shortDate,
  whatsappUrl,
  type DeliveryIssue,
} from "@catera/domain";
import { nativeLayout } from "@catera/design-tokens";
import { useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  DecorativeIcon,
  FadeSwap,
  Field,
  FormError,
  GlyphRow,
  KeyValueRow,
  ListCard,
  Screen,
  SheetBody,
  SheetFooter,
  SheetHeader,
  Skeleton,
  SkeletonGroup,
  Text,
  useBusy,
  useColors,
  useStackedLayout,
  useToast,
  useUnsavedGuard,
} from "@catera/mobile-ui";
import { jakartaClock } from "./exceptions";
import { FooterSkeleton, SkeletonLine } from "./ExceptionSheet";
import { DetailSkeleton } from "../skeletons";
import { ReadError } from "../ReadError";

/**
 * The sheet's loading shapes: the report card at a typical one-line description (the 12 padding, the 22 subject line, 8, the
 * 22 description, 12, the hairline and the 40 "Dikirim" row, rounded), the 18 line of the reply-by hint, and the reply field
 * (its 16 label line, 6 and the 88 input).
 */
const REPORT_CARD = 128;
const FIELD_LABEL = 16;
const FIELD_MIN = 88;

/** The server needs at least this much text for a reply or a resolution note. */
const MIN_BODY = 5;
/** What "Tandai selesai" sends when nothing is typed. Always Indonesian: the customer reads it, whatever the caterer's language. */
const RESOLVE_NOTE = "Masalah ini sudah kami tangani.";

/** Plain status words, the same ones the customer sees on their report. */
export function reportStatus(status: string, t: (id: string, en: string) => string): string {
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

/** "Kamis 8 Okt 12.40" in Jakarta time. */
const sentAt = (iso: string, locale: "id" | "en") => `${shortDate(jakartaDay(new Date(iso)), locale)} ${jakartaClock(iso)}`;

const eventLabels: Record<string, [string, string]> = {
  "deliveryIssue.respond": ["Balasan", "Reply"],
  "deliveryIssue.resolve": ["Ditandai selesai", "Marked done"],
  "deliveryIssue.escalate": ["Pelanggan minta Catera meninjau", "The customer asked Catera to review"],
  "support.resolve": ["Keputusan Catera", "Catera's decision"],
};

/**
 * Replies typed and not sent, per person and report, in memory only. Android's bottom sheet closes on a swipe before
 * anything can ask (`useUnsavedGuard`), so the reply waits here and comes back when the sheet opens again for that
 * report. Sending or choosing "Buang" drops it; closing the app forgets it.
 */
const drafts = new Map<string, string>();

/** One report, read by its id for this kitchen. */
function useIssue(id: string) {
  const { runtime, actor } = useMobile();
  const catererId = actor?.catererId ?? "";
  return useData(`issue:${catererId}:${id}`, () =>
    runtime.api.request<DeliveryIssue[]>(`delivery-issues?${new URLSearchParams({ id: catererId, issue: id })}`),
  );
}

/**
 * One customer's delivery report: what they said, and the caterer's reply or "done". `title` is the customer's name
 * the link that opened it carried (`reportHref`), absent on a cold link or a notification. Notifications open this
 * page; from Hari ini a report opens as the reply sheet (`ReplySheet`).
 */
export function ReportScreen({ id, title: carried }: { id: string; title?: string }) {
  const { t } = useMobile();
  const c = useColors();
  const issues = useIssue(id);
  // Until the report arrives the screen keeps the customer's name its link carried, or else is named by what it is;
  // then by the customer who sent it. A failed read or a missing report goes back to what it is: the carried name was
  // never checked against a record.
  const generic = t("Laporan masalah", "Problem report");
  const issue = issues.data?.find((i) => i.id === id);
  const loading = !issues.data && !issues.error;
  const title = issue
    ? issue.customerName || t("Pelanggan", "Customer")
    : issues.data || issues.error
      ? generic
      : (carried ?? generic);
  // One screen in every state, so the report enters from its skeleton as one block (the FadeSwap below).
  return (
    <ReportPage title={title}>
      <FadeSwap swapKey={issue ? "report" : loading ? "loading" : "other"} style={{ gap: 16 }}>
        {issue ? (
          // No key on the version: a reload after a refused action keeps the typed reply and the message.
          <Report issue={issue} reload={issues.reload} />
        ) : issues.data ? (
          <Text>{t("Laporan ini tidak ditemukan.", "This report was not found.")}</Text>
        ) : issues.error ? (
          // The failed read stands in for the whole page, so it leads with the puzzled mascot (spec 7.2).
          <ReadError art message={issues.error} onRetry={() => void issues.reload()} />
        ) : (
          <DetailSkeleton label={t("Memuat laporan", "Loading the report")} />
        )}
      </FadeSwap>
    </ReportPage>
  );
}

/**
 * Where the page's "Balas" and "Tandai selesai" are pinned: the page's own footer, as the sheet pins them in its footer.
 * The state lives here, in a component whose `children` stay the same element, so setting the footer re-renders only
 * this frame and never the report that sets it (the way `SheetBody` holds its `SheetFooter`).
 */
const PageFooter = createContext<((node: ReactNode) => void) | null>(null);

function ReportPage({ title, children }: { title: string; children: ReactNode }) {
  const [footer, setFooter] = useState<ReactNode>(null);
  return (
    <PageFooter.Provider value={setFooter}>
      <Screen nativeTitle={title} footer={footer}>
        {children}
      </Screen>
    </PageFooter.Provider>
  );
}

/** The report's actions, pinned: in the page's footer on the page, in the sheet's footer in the sheet. */
function PinnedActions({ children }: { children: ReactNode }) {
  const page = use(PageFooter);
  useLayoutEffect(() => {
    page?.(children);
  });
  useLayoutEffect(() => () => page?.(null), [page]);
  return page ? null : <SheetFooter>{children}</SheetFooter>;
}

/** Balas (filled) with Tandai selesai (outlined) beside it; one above the other once the width cannot hold both labels. */
function ReplyActions({
  reply,
  resolve,
}: {
  /** Each button is drawn with the style that fits the layout: Balas takes the row's spare width, Tandai selesai its own 20 padding. */
  reply: (style: ViewStyle | undefined) => ReactNode;
  resolve: (style: ViewStyle | undefined) => ReactNode;
}) {
  const stacked = useStackedLayout(320);
  const balas = reply(stacked ? undefined : { flex: 1 });
  const selesai = resolve(stacked ? undefined : { paddingHorizontal: 20 });
  return (
    <View
      testID="reply-actions"
      style={{ flexDirection: stacked ? "column" : "row", alignItems: stacked ? "stretch" : "center", gap: nativeLayout.space.sm }}
    >
      {stacked ? (
        <>
          {balas}
          {selesai}
        </>
      ) : (
        <>
          {selesai}
          {balas}
        </>
      )}
    </View>
  );
}

/** The reply sheet's frame: the customer's name, the day, meal and package under it, then the scrolling content. */
function SheetFrame({ title, context, children }: { title: string; context?: string; children: ReactNode }) {
  const { t } = useMobile();
  return (
    <View testID="reply-sheet" style={{ flex: 1 }}>
      <SheetHeader title={title} context={context} closeLabel={t("Tutup", "Close")} />
      <SheetBody>{children}</SheetBody>
    </View>
  );
}

/**
 * The reply to a report, as a form sheet over Hari ini (`/balas/{id}`): what the customer said, the replies so far,
 * and the reply box with "Balas" and "Tandai selesai". Sending closes the sheet with "Balasan terkirim". A typed reply
 * asks before it is dropped, and one an Android swipe closed comes back next time. `title` is the customer's name the
 * report card carried.
 */
export function ReplySheet({ id, title: carried }: { id: string; title?: string }) {
  const { actor, t, locale } = useMobile();
  const issues = useIssue(id);
  const issue = issues.data?.find((i) => i.id === id);
  const generic = t("Laporan masalah", "Problem report");
  const title = issue
    ? issue.customerName || t("Pelanggan", "Customer")
    : issues.data || issues.error
      ? generic
      : (carried ?? generic);
  const context = issue
    ? `${shortDate(issue.service_date, locale)} · ${mealLabel(issue.meal, locale)} · ${issue.package_name}`
    : undefined;
  return (
    <SheetFrame title={title} context={context}>
      {issue ? (
        <Report issue={issue} reload={issues.reload} draftKey={`${actor?.id ?? ""}:${id}`} />
      ) : issues.data ? (
        <Text>{t("Laporan ini tidak ditemukan.", "This report was not found.")}</Text>
      ) : issues.error ? (
        <ReadError message={issues.error} onRetry={() => void issues.reload()} />
      ) : (
        <>
          <SkeletonGroup label={t("Memuat laporan", "Loading the report")}>
            <View testID="reply-skeleton" style={{ gap: 16 }}>
              <Skeleton testID="reply-skeleton-card" height={REPORT_CARD} radius={nativeLayout.radius.card} />
              <View testID="reply-skeleton-hint" style={{ height: 18, justifyContent: "center" }}>
                <Skeleton width="70%" height={10} radius={5} />
              </View>
              <View testID="reply-skeleton-field" style={{ height: FIELD_LABEL + 6 + FIELD_MIN, gap: 6 }}>
                <SkeletonLine width={120} block={10} line={FIELD_LABEL} />
                <Skeleton height={FIELD_MIN} radius={nativeLayout.radius.control} />
              </View>
            </View>
          </SkeletonGroup>
          <FooterSkeleton testID="reply-skeleton-footer" />
        </>
      )}
    </SheetFrame>
  );
}

/**
 * The report below its title: what the customer said, the replies, and the reply box while it is open. On the page the
 * day and package lead and a sent reply says so in a toast; in the sheet (`draftKey`, its person and report) they are
 * the sheet's context line, and sending closes the sheet.
 */
function Report({ issue: i, reload, draftKey }: { issue: DeliveryIssue; reload: () => Promise<void>; draftKey?: string }) {
  const { t, locale, command } = useMobile();
  const c = useColors();
  const toast = useToast();
  const [text, setTextState] = useState(() => (draftKey ? (drafts.get(draftKey) ?? "") : ""));
  const [sent, setSent] = useState(false);
  const setText = (value: string) => {
    setTextState(value);
    if (!draftKey) return;
    if (value.trim()) drafts.set(draftKey, value);
    else drafts.delete(draftKey);
  };
  const [failure, setFailure] = useState<{ message: string; key: number } | null>(null);
  // Which of the two buttons is waiting; the hook drops a second press while one runs.
  const [which, setWhich] = useState<"deliveryIssue.respond" | "deliveryIssue.resolve" | null>(null);
  // Catera has taken over (or it is closed): the caterer can no longer change it here.
  const open = !i.case_id && (i.status === "open" || i.status === "responded");
  const replies = (i.events ?? []).filter((e) => eventLabels[e.action]);
  const reply = text.trim();
  // In a sheet the cards are the sage tone (the sheet is the card colour, and dark has no card edge), with the pill on the surface.
  const inSheet = draftKey !== undefined;
  const cardTone = inSheet ? "sage" : "surface";

  // The customer may ask Catera to review an unanswered report from 12.00 Jakarta the day after it was sent.
  const sentDay = jakartaDay(new Date(i.created_at));
  const reviewFrom = new Date(`${addDays(sentDay, 1)}T12:00:00+07:00`);
  const hint =
    i.status !== "open" || i.case_id
      ? ""
      : new Date() >= reviewFrom
        ? t("Pelanggan sudah bisa meminta Catera meninjau. Balas sekarang.", "The customer can now ask Catera to review. Reply now.")
        : sentDay === jakartaDay(new Date())
          ? t("Balas sebelum besok pukul 12.00. Setelah itu pelanggan bisa minta Catera meninjau.", "Reply by 12.00 tomorrow. After that, the customer can ask Catera to review it.")
          : t("Balas sebelum pukul 12.00 hari ini. Setelah itu pelanggan bisa minta Catera meninjau.", "Reply by 12.00 today. After that, the customer can ask Catera to review it.");

  // 1 to 4 characters: too short to send, and not empty enough to mean "use the standard note".
  const tooShort = reply.length > 0 && reply.length < MIN_BODY;

  const [busy, act] = useBusy(async (action: "deliveryIssue.respond" | "deliveryIssue.resolve") => {
    const body = action === "deliveryIssue.resolve" && !reply ? RESOLVE_NOTE : reply;
    if (body.length < MIN_BODY) return;
    setWhich(action);
    setFailure(null);
    try {
      // The new version comes back with the reload that every command triggers.
      await command(action, { id: i.id, version: i.version, body });
      setText("");
      if (draftKey) setSent(true);
      else toast.show({ message: t("Balasan terkirim", "Reply sent"), tone: "success" });
    } catch (e) {
      setFailure((f) => ({
        message:
          errorLabel((e as { code?: string }).code || (e as Error).message, locale) ||
          (action === "deliveryIssue.respond"
            ? t("Balasan belum terkirim. Coba lagi.", "The reply was not sent. Try again.")
            : t("Laporan belum bisa ditandai selesai. Coba lagi.", "The report could not be marked as done. Try again.")),
        key: (f?.key ?? 0) + 1,
      }));
      // A refused action usually means the report changed (a reply elsewhere, or the customer asked
      // Catera): fetch it again so the next tap sends the current version.
      void reload();
    }
  });

  return (
    <>
      {draftKey ? (
        <SheetOutcome dirty={open && !sent && reply !== ""} sent={sent} onDiscard={() => drafts.delete(draftKey)} />
      ) : (
        <View style={{ gap: 4 }}>
          <Text variant="bodyStrong">{`${shortDate(i.service_date, locale)} · ${mealLabel(i.meal, locale)}`}</Text>
          <Text variant="meta">{i.package_name}</Text>
        </View>
      )}
      <ListCard inset={0} tone={cardTone}>
        <View style={{ paddingVertical: nativeLayout.space.md, gap: nativeLayout.space.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: nativeLayout.space.md }}>
            <Text variant="rowTitle" style={{ flex: 1 }}>
              {i.subject}
            </Text>
            <View testID="report-status" style={{ minHeight: 22, paddingHorizontal: 12, borderRadius: 11, backgroundColor: inSheet ? c.surface : c.sage, justifyContent: "center" }}>
              <Text variant="label" style={{ color: c.charcoal }}>
                {reportStatus(i.status, t)}
              </Text>
            </View>
          </View>
          {i.description ? (
            <Text variant="bodyL" selectable>
              {i.description}
            </Text>
          ) : null}
        </View>
        <KeyValueRow label={t("Dikirim", "Sent")} value={sentAt(i.created_at, locale)} />
      </ListCard>
      {replies.length ? (
        <ListCard inset={0} tone={cardTone}>
          {replies.map((e) => (
            <View key={e.id} style={{ paddingVertical: nativeLayout.space.md, gap: 2 }}>
              <Text variant="label">{t(...eventLabels[e.action])}</Text>
              <Text variant="bodyL" selectable>
                {e.body}
              </Text>
              <Text variant="meta" style={{ fontVariant: ["tabular-nums"] }}>
                {sentAt(e.created_at, locale)}
              </Text>
            </View>
          ))}
        </ListCard>
      ) : null}
      {open ? (
        <>
          {hint ? <Text variant="meta">{hint}</Text> : null}
          <Field
            label={t("Balasan untuk pelanggan", "Reply to the customer")}
            multiline
            value={text}
            onChangeText={setText}
            maxLength={2000}
            style={{ minHeight: 88, textAlignVertical: "top", paddingTop: 12 }}
            // A field validation: the Field's own error line and edge, never a loose danger caption (spec 5.2).
            error={tooShort ? t("Tulis minimal 5 karakter.", "Write at least 5 characters.") : undefined}
          />
          {!reply ? (
            <Text variant="meta">{`${t("Pelanggan akan menerima", "The customer will receive")}: “${RESOLVE_NOTE}”`}</Text>
          ) : null}
        </>
      ) : (
        <Text variant="meta">
          {i.status === "resolved"
            ? t("Laporan ini sudah selesai.", "This report is done.")
            : t("Catera sedang meninjau laporan ini.", "Catera is reviewing this report.")}
        </Text>
      )}
      {/* After a refused action the report may have closed meanwhile: the reason still shows. */}
      {failure && !open ? <FormError message={failure.message} failureKey={failure.key} /> : null}
      {i.customerPhone ? (
        <GlyphRow
          minHeight={nativeLayout.row.info}
          glyph={<DecorativeIcon name="logo-whatsapp" size={20} color={c.forest} />}
          title={t("Chat WhatsApp", "WhatsApp chat")}
          trailing={<DecorativeIcon name="chevron-forward" size={20} color={c.muted} />}
          onPress={() => void Linking.openURL(whatsappUrl("", i.customerPhone!))}
        />
      ) : null}
      {/* The actions are pinned to the foot (the sheet's footer, the page's footer), with a failed send above them. */}
      {open ? (
        <PinnedActions>
          {failure ? <FormError message={failure.message} failureKey={failure.key} /> : null}
          <ReplyActions
            reply={(style) => (
              <Button
                label={t("Balas", "Reply")}
                busy={busy && which === "deliveryIssue.respond"}
                disabled={reply.length < MIN_BODY || (busy && which !== "deliveryIssue.respond")}
                onPress={() => void act("deliveryIssue.respond")}
                style={style}
              />
            )}
            resolve={(style) => (
              <Button
                variant="secondary"
                label={t("Tandai selesai", "Mark as done")}
                busy={busy && which === "deliveryIssue.resolve"}
                disabled={tooShort || (busy && which !== "deliveryIssue.resolve")}
                onPress={() => void act("deliveryIssue.resolve")}
                style={style}
              />
            )}
          />
        </PinnedActions>
      ) : null}
    </>
  );
}

/**
 * The reply sheet's guard and close, drawn with the reply box: typed text asks before the sheet drops it ("Buang
 * balasan?"), and once sent the sheet closes with "Balasan terkirim", after the guard has seen it clean, so closing
 * never asks. Draws nothing.
 */
function SheetOutcome({ dirty, sent, onDiscard }: { dirty: boolean; sent: boolean; onDiscard: () => void }) {
  const { t } = useMobile();
  const toast = useToast();
  const closed = useRef(false);
  useUnsavedGuard(dirty, t("balasan", "reply"), { t, nounEn: "reply", voice: "kamu", onDiscard });
  useEffect(() => {
    if (!sent || closed.current) return;
    closed.current = true;
    router.back();
    toast.show({ message: t("Balasan terkirim", "Reply sent"), tone: "success" });
  }, [sent, toast, t]);
  return null;
}
