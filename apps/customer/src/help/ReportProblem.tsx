import { useEffect, useRef, useState, type ReactNode } from "react";
import { Text as RNText, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { dayLabel, errorLabel, jakartaDay, mealLabel, type Delivery } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  Card,
  FadeSwap,
  Field,
  fontFor,
  PressableScale,
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

/**
 * Notes typed and not sent, per person and delivery, in memory only. Android's bottom sheet closes on a swipe before
 * anything can ask (`useUnsavedGuard`), so the note waits here and comes back when Ada masalah opens again for that
 * day. Sending or choosing "Buang" drops it; closing the app forgets it.
 */
const drafts = new Map<string, string>();

/** Opens Bantuan from the sheet: the sheet closes, and Bantuan opens over the page it sat on (Hari). */
function toBantuan() {
  router.back();
  router.push("/bantuan" as never);
}

/** Ada masalah: a form sheet over its Hari with three choices, an optional note and the send button. */
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
            <Text style={{ color: c.muted }}>
              {t("Masuk untuk melihat paket dan jadwal antar Anda.", "Sign in to see your packages and deliveries.")}
            </Text>
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
function Sheet({ context, swapKey, children }: { context?: string | null; swapKey: string; children: ReactNode }) {
  const { t } = useMobile();
  return (
    <View style={{ flex: 1 }}>
      <SheetHeader
        title={t("Ada masalah", "Report a problem")}
        context={context}
        holdContextLine
        closeLabel={t("Tutup", "Close")}
      />
      <SheetBody>
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
  const styles = useStyles();
  const toast = useToast();
  const state = useData(`report:${id}`, () => runtime.api.customer(`?deliveryId=${encodeURIComponent(id)}`));
  const draftKey = `${actorId}:${id}`;
  const [kind, setKind] = useState<Kind | "">(KINDS.some((k) => k.id === jenis) ? (jenis as Kind) : "");
  const [note, setNote] = useState(() => drafts.get(draftKey) ?? "");
  const [meal, setMeal] = useState<string | undefined>(wanted);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
      action: { label: t("Lihat", "View"), onPress: () => router.push("/bantuan" as never) },
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
        <Text selectable={!!state.error} style={{ color: state.error ? c.danger : c.muted }}>
          {state.error || t("Pengantaran tidak ditemukan.", "Delivery not found.")}
        </Text>
        {state.error ? <Button label={t("Coba lagi", "Try again")} onPress={() => void state.reload()} /> : null}
      </Sheet>
    );

  const caterer = d.offer.caterer;
  const context = `${dayLabel(d.service_date, jakartaDay(new Date()), locale)} · ${d.offer.name} · ${caterer}`;

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
    <Sheet context={context} swapKey="ready">
      {meals.length > 1 ? (
        <View style={{ flexDirection: "row", gap: 8 }} accessibilityRole="radiogroup">
          {meals.map((m) => {
            const checked = m.meal === current.meal;
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
                <RNText style={[styles.choiceLabel, { color: checked ? c.cream : c.charcoal }]}>
                  {mealLabel(m.meal, locale)}
                </RNText>
              </PressableScale>
            );
          })}
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
                  <RNText style={[styles.choiceLabel, { color: checked ? c.cream : c.charcoal }]}>
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
            onChangeText={writeNote}
            maxLength={2000}
            style={{ minHeight: 88, textAlignVertical: "top", paddingTop: 12 }}
          />
          {error ? (
            <Text selectable variant="caption" style={{ color: c.danger }}>
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
    </Sheet>
  );
}

const useStyles = themedStyles((c) => ({
  choice: {
    minHeight: 56,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  mealChoice: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  on: { backgroundColor: c.forest, borderColor: c.forest },
  choiceLabel: { fontSize: 15, fontFamily: fontFor("700") },
}));
