import { useEffect, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { signInSentence } from "../account/SignInFirst";
import { closeSheetFor } from "../nav";
import { dayLabel, errorLabel, jakartaDay, mealLabel, type Delivery } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  Card,
  ChoiceList,
  FadeSwap,
  Field,
  FormError,
  ReadError,
  SheetBody,
  SheetHeader,
  sheetSidePadding,
  Skeleton,
  SkeletonGroup,
  Text,
  useColors,
  useToast,
  useUnsavedGuard,
} from "@catera/mobile-ui";
import { ChatKatering, catererPhoneOf } from "./ChatKatering";

type Kind = "belum" | "kurang" | "layak";

/** The subject goes to the caterer as written here (Indonesian), whatever language the app is in. */
const KINDS: { id: Kind; subject: string; en: string }[] = [
  { id: "belum", subject: "Belum sampai", en: "Has not arrived" },
  { id: "kurang", subject: "Ada yang kurang atau salah", en: "Something is missing or wrong" },
  { id: "layak", subject: "Makanannya tidak layak dimakan", en: "The food isn't fit to eat" },
];
/** The command needs a body of at least five characters; the note is optional for the customer. */
const WITHOUT_NOTE = "Tanpa catatan tambahan.";

/**
 * Notes typed and not sent, per person and delivery, in memory only. Android's bottom sheet closes on a swipe before
 * anything can ask (`useUnsavedGuard`), so the note waits here and comes back when Ada masalah opens again for that
 * day. Sending or choosing "Buang" drops it; closing the app forgets it.
 */
const drafts = new Map<string, string>();

/**
 * Opens Bantuan from the sheet: every sheet above the tabs closes (this one and the day sheet under it, if it sat over
 * one), and Bantuan opens in the tab beneath them.
 */
function toBantuan() {
  closeSheetFor("/bantuan");
}

/**
 * Ada masalah: a form sheet over its Hari. The delivery it is about sits in a card at the top (the day, the meal and the
 * caterer, whose name may take two lines and is never cut to one), then the meal (on a day of two), three choices of
 * what happened as radio rows, an optional note and the send button.
 */
export function ReportProblem() {
  const params = useLocalSearchParams<{ id: string; meal?: string; jenis?: string }>();
  const { actor, ready, t } = useMobile();
  const c = useColors();
  const { id } = params;
  const query = new URLSearchParams(
    Object.entries({ meal: params.meal, jenis: params.jenis }).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  ).toString();
  // Before the session is known, and when it says nobody is signed in, one Sheet: the sign-in prompt fades in from the
  // skeleton through the same FadeSwap. Only the skeleton holds the context line; a sign-in prompt has no day to name.
  if (!ready || !actor)
    return (
      <Sheet swapKey={ready ? "signin" : "loading"} context={ready ? undefined : null}>
        {ready ? (
          <>
            <Text style={{ color: c.muted }}>{signInSentence(t)}</Text>
            <Button
              label={t("Masuk", "Sign in")}
              onPress={() =>
                router.push({ pathname: "/login", params: { next: `/masalah/${id}${query ? `?${query}` : ""}` } } as never)
              }
            />
          </>
        ) : (
          <ReportSkeleton />
        )}
      </Sheet>
    );
  return <Report key={`${actor.id}:${id}`} actorId={actor.id} id={id} meal={params.meal} jenis={params.jenis} />;
}

/**
 * The sheet's frame: the title row ("Ada masalah", with the day under it once known) over the scrolling content. The
 * content sits in one FadeSwap keyed by `swapKey`, so the form fades in from its skeleton as one block. The header
 * holds its context line (`holdContextLine`) on every render: while the day is read, `context` is null and a skeleton
 * keeps the day's line, then the day lands as one line, so the header keeps its height when the form lands.
 */
function Sheet({
  context,
  swapKey,
  children,
  footer,
}: {
  context?: string | null;
  swapKey: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { t } = useMobile();
  return (
    <View style={{ flex: 1 }}>
      <SheetHeader
        title={t("Ada masalah", "Report a problem")}
        context={context}
        holdContextLine
        closeLabel={t("Tutup", "Close")}
      />
      <SheetBody footer={footer}>
        <FadeSwap swapKey={swapKey} style={{ gap: 16 }}>
          {children}
        </FadeSwap>
      </SheetBody>
    </View>
  );
}

/** The shape of the choices while the day loads. */
function ReportSkeleton() {
  const { t } = useMobile();
  return (
    <SkeletonGroup label={t("Memuat pengantaran", "Loading the delivery")}>
      <View style={{ gap: 8 }}>
        <Skeleton width="45%" height={14} />
        <Skeleton height={56} radius={12} />
        <Skeleton height={56} radius={12} />
        <Skeleton height={56} radius={12} />
      </View>
    </SkeletonGroup>
  );
}

function Report({ actorId, id, meal: wanted, jenis }: { actorId: string; id: string; meal?: string; jenis?: string }) {
  const { runtime, command, t, locale } = useMobile();
  const c = useColors();
  const toast = useToast();
  const state = useData(`report:${id}`, () => runtime.api.customer(`?deliveryId=${encodeURIComponent(id)}`));
  const draftKey = `${actorId}:${id}`;
  const [kind, setKind] = useState<Kind | "">(KINDS.some((k) => k.id === jenis) ? (jenis as Kind) : "");
  const [note, setNote] = useState(() => drafts.get(draftKey) ?? "");
  const [meal, setMeal] = useState<string | undefined>(wanted);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failures, setFailures] = useState(0);
  const [sent, setSent] = useState(false);
  const closed = useRef(false);
  const d: Delivery | undefined = state.data?.deliveries.find((x) => x.id === id);
  const meals = (d?.meals ?? []).filter((m) => m.status !== "cancelled");
  const current = meals.find((m) => m.meal === meal) ?? meals[0];

  // Typed text asks before the sheet closes; choices alone do not. A sent report, or a meal already reported (no form),
  // has nothing left to lose.
  useUnsavedGuard(!sent && !current?.issue && note.trim() !== "", t("laporan", "report"), {
    t,
    nounEn: "report",
    onDiscard: () => drafts.delete(draftKey),
  });

  // The report is in: the sheet closes back to the page under it, and a toast carries the outcome with a way to it.
  // After the guard has seen `sent`, so closing never asks.
  useEffect(() => {
    if (!sent || closed.current) return;
    closed.current = true;
    toast.show({
      message: t("Laporan terkirim", "Report sent"),
      // The toast outlives the sheet, and a day sheet may be on top by the time it is tapped: Bantuan is a page of the tab,
      // so the sheets close and it opens there, never behind a sheet or in a second tabs instance.
      action: { label: t("Lihat", "View"), onPress: toBantuan },
      tone: "success",
    });
    router.back();
  }, [sent, toast, t]);

  const writeNote = (text: string) => {
    setNote(text);
    if (text.trim()) drafts.set(draftKey, text);
    else drafts.delete(draftKey);
  };

  // The same Sheet (and its FadeSwap) in every state below, so the form fades in from this skeleton.
  if (!d && state.loading)
    return (
      <Sheet swapKey="loading" context={null}>
        <ReportSkeleton />
      </Sheet>
    );

  // A day with every meal cancelled has nothing to report: say so rather than offer a form that cannot send.
  if (!d || !current)
    return (
      <Sheet swapKey="missing">
        {state.error ? (
          <ReadError message={state.error} onRetry={() => void state.reload()} />
        ) : (
          <Text style={{ color: c.muted }}>{t("Pengantaran tidak ditemukan.", "Delivery not found.")}</Text>
        )}
      </Sheet>
    );

  const caterer = d.offer.caterer;
  // The header's held line names the package; the day, the meal and the caterer are in the card, where nothing is cut.
  const context = d.offer.name;
  const day = dayLabel(d.service_date, jakartaDay(new Date()), locale);

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
      drafts.delete(draftKey);
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
            "Kamu bisa melapor mulai hari pengantaran, setelah jam antarnya mulai.",
            "You can report from the delivery day, once the delivery window starts.",
          ),
        );
      } else setError(errorLabel(code, locale) || t("Laporannya belum terkirim. Coba lagi.", "Your report didn't send. Try again."));
      setFailures((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      context={context}
      swapKey="ready"
      footer={
        current.issue ? undefined : (
          <>
            {error ? <FormError message={error} failureKey={failures} /> : null}
            <Button label={t("Kirim laporan", "Send report")} busy={busy} disabled={!kind} onPress={() => void send()} />
          </>
        )
      }
    >
      <Card testID="delivery-card" style={{ gap: 2 }}>
        <Text variant="heading">
          {`${day} · ${mealLabel(current.meal, locale)}`}
        </Text>
        <Text numberOfLines={2} style={{ color: c.muted }}>
          {caterer}
        </Text>
      </Card>
      {meals.length > 1 ? (
        <View style={{ gap: 4 }}>
          <Text variant="label">{t("Makan yang mana?", "Which meal?")}</Text>
          <View style={{ marginHorizontal: -sheetSidePadding() }}>
            <ChoiceList
              label={t("Makan yang mana?", "Which meal?")}
              value={current.meal}
              onChange={setMeal}
              options={meals.map((m) => ({ value: m.meal, label: mealLabel(m.meal, locale) }))}
            />
          </View>
        </View>
      ) : null}
      {current.issue ? (
        <>
          <Card tone="sage">
            <Text>{t("Laporan untuk makan ini sudah terkirim.", "A report for this meal was already sent.")}</Text>
          </Card>
          <Button label={t("Lihat laporan saya", "See my reports")} onPress={toBantuan} />
        </>
      ) : (
        <>
          <View style={{ gap: 4 }}>
            <Text variant="label">{t("Apa yang terjadi?", "What happened?")}</Text>
            <View style={{ marginHorizontal: -sheetSidePadding() }}>
              <ChoiceList<Kind>
                label={t("Apa yang terjadi?", "What happened?")}
                value={kind || null}
                onChange={setKind}
                options={KINDS.map((k) => ({ value: k.id, label: t(k.subject, k.en) }))}
              />
            </View>
          </View>
          <Field
            label={t("Catatan (boleh dikosongkan)", "Note (optional)")}
            multiline
            value={note}
            onChangeText={writeNote}
            maxLength={2000}
            style={{ minHeight: 88, textAlignVertical: "top", paddingTop: 12 }}
          />
          <ChatKatering
            phone={catererPhoneOf(d)}
            variant="text"
            label={t(`Atau chat ${caterer} di WhatsApp dulu`, `Or chat ${caterer} on WhatsApp first`)}
          />
        </>
      )}
    </Sheet>
  );
}

