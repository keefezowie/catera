import { useEffect, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { errorLabel } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  FadeSwap,
  Field,
  FormError,
  PressableScale,
  ReadError,
  SheetBody,
  SheetHeader,
  Skeleton,
  SkeletonGroup,
  Text,
  useColors,
  useStackedLayout,
  useToast,
  useUnsavedGuard,
} from "@catera/mobile-ui";
import { markReview } from "./reviewMark";

/**
 * Words typed and not sent, per person and plan, in memory only. Android's bottom sheet closes on a swipe before
 * anything can ask (`useUnsavedGuard`), so the review waits here and comes back when the sheet opens again for that
 * plan. Sending, "Nanti saja" or "Buang" drops it; closing the app forgets it.
 */
const drafts = new Map<string, { rating: number; parts: Parts; body: string }>();

/** The three sub-ratings `review.save` takes beside the overall one. */
const PARTS = ["food", "delivery", "value"] as const;
type Part = (typeof PARTS)[number];
/** Sub-ratings the customer changed; one left out follows the overall rating. */
type Parts = Partial<Record<Part, number>>;

/**
 * Five stars, each a button named "{prefix}{n} bintang". Outline + muted (5.8:1) for unselected, filled + forest for
 * selected: shape and colour both carry the state.
 */
function Stars({
  value,
  prefix = "",
  target,
  glyph,
  onPick,
}: {
  value: number;
  prefix?: string;
  target: number;
  glyph: number;
  onPick: (n: number) => void;
}) {
  const { t } = useMobile();
  const palette = useColors();
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <PressableScale
          key={n}
          accessibilityRole="button"
          accessibilityLabel={t(`${prefix}${n} bintang`, `${prefix}${n} stars`)}
          accessibilityState={{ selected: n <= value }}
          haptic="select"
          onPress={() => onPick(n)}
          style={{ width: target, height: target, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons
            name={n <= value ? "star" : "star-outline"}
            size={glyph}
            color={n <= value ? palette.forest : palette.muted}
          />
        </PressableScale>
      ))}
    </View>
  );
}

/** The sheet's frame: the title row over the scrolling content, in one FadeSwap so the form fades in as one block. */
function Frame({ title, swapKey, children, footer }: { title: string; swapKey: string; children: ReactNode; footer?: ReactNode }) {
  const { t } = useMobile();
  return (
    <View style={{ flex: 1 }}>
      <SheetHeader title={title} closeLabel={t("Tutup", "Close")} />
      <SheetBody footer={footer}>
        <FadeSwap swapKey={swapKey} style={{ gap: 12 }}>
          {children}
        </FadeSwap>
      </SheetBody>
    </View>
  );
}

function ReviewSkeleton() {
  const { t } = useMobile();
  return (
    <SkeletonGroup label={t("Memuat ulasan", "Loading the review")}>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} width={48} height={48} radius={24} />
          ))}
        </View>
        <Skeleton height={88} radius={10} />
        <Skeleton height={48} radius={10} />
      </View>
    </SkeletonGroup>
  );
}

/**
 * `/ulasan/{subscriptionId}`: the review as a native form sheet over Beranda (`sheetOptions({ detents: "form" })`): the
 * stars, a few words and "Kirim ulasan", with "Nanti saja" to put it off for good. Either answer marks the plan's review
 * row as dealt with (`markReview`), so it leaves "Perlu kamu urus" under the sheet. Sending closes the sheet with the toast
 * "Ulasan terkirim"; a failure stays in the sheet.
 */
export function ReviewRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const { actor, ready, t } = useMobile();
  const id = String(params.id ?? "");
  if (!ready || !actor)
    return (
      <Frame title={t("Ulasan", "Review")} swapKey={ready ? "signin" : "loading"}>
        {ready ? (
          <Button
            label={t("Masuk", "Sign in")}
            onPress={() => router.push({ pathname: "/login", params: { next: `/ulasan/${id}` } } as never)}
          />
        ) : (
          <ReviewSkeleton />
        )}
      </Frame>
    );
  return <Review key={`${actor.id}:${id}`} actorId={actor.id} id={id} />;
}

function Review({ actorId, id }: { actorId: string; id: string }) {
  const { runtime, command, t, locale } = useMobile();
  const palette = useColors();
  const toast = useToast();
  const state = useData(`ulasan:${id}`, () => runtime.api.customer());
  const subscription = state.data?.subscriptions.find((s) => s.id === id);
  const draftKey = `${actorId}:${id}`;
  const markKey = runtime.storageKey(`review.${id}`);
  // No stars until the customer picks: a preset rating would be sent as theirs.
  const [rating, setRating] = useState(() => drafts.get(draftKey)?.rating ?? 0);
  const [parts, setParts] = useState<Parts>(() => drafts.get(draftKey)?.parts ?? {});
  const [body, setBody] = useState(() => drafts.get(draftKey)?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failures, setFailures] = useState(0);
  const [finished, setFinished] = useState<"" | "sent" | "later">("");
  const closed = useRef(false);
  // Set before the first await, so a second tap in the same frame never sends twice.
  const sending = useRef(false);
  const stacked = useStackedLayout(340);

  // Typed words ask before the sheet closes; the stars alone do not. A sent or put-off review has nothing to lose.
  useUnsavedGuard(!finished && body.trim() !== "", t("ulasan", "review"), {
    t,
    nounEn: "review",
    onDiscard: () => drafts.delete(draftKey),
  });

  // After the guard has seen `finished`, so closing never asks.
  useEffect(() => {
    if (!finished || closed.current) return;
    closed.current = true;
    router.back();
    if (finished === "sent") toast.show({ message: t("Ulasan terkirim", "Review sent"), tone: "success" });
  }, [finished, toast, t]);

  const keep = (next: { rating?: number; parts?: Parts; body?: string }) => {
    const value = { rating: next.rating ?? rating, parts: next.parts ?? parts, body: next.body ?? body };
    if (value.body.trim()) drafts.set(draftKey, value);
    else drafts.delete(draftKey);
  };

  if (!subscription)
    return (
      <Frame title={t("Ulasan", "Review")} swapKey={state.loading ? "loading" : "missing"}>
        {state.loading ? (
          <ReviewSkeleton />
        ) : (
          state.error ? (
            <ReadError message={state.error} onRetry={() => void state.reload()} />
          ) : (
            <Text style={{ color: palette.muted }}>{t("Paket tidak ditemukan.", "Plan not found.")}</Text>
          )
        )}
      </Frame>
    );

  const caterer = subscription.snapshot.offer.caterer;

  const partLabel: Record<Part, string> = {
    food: t("Rasa", "Taste"),
    delivery: t("Pengantaran", "Delivery"),
    value: t("Harga", "Price"),
  };

  async function send() {
    if (busy || sending.current || !rating) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      await command("review.save", {
        subscriptionId: id,
        rating,
        food: parts.food ?? rating,
        delivery: parts.delivery ?? rating,
        value: parts.value ?? rating,
        body,
      });
      drafts.delete(draftKey);
      markReview(markKey, "done");
      setFinished("sent");
    } catch (e) {
      const code = (e as { code?: string }).code || (e as Error).message;
      setError(errorLabel(code, locale) || t("Ulasannya belum terkirim. Coba lagi.", "Your review didn't send. Try again."));
      setFailures((n) => n + 1);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <Frame
      title={t(`Ulasan untuk ${caterer}`, `Your review of ${caterer}`)}
      swapKey="ready"
      footer={
        <>
          {error ? <FormError message={error} failureKey={failures} /> : null}
          {rating ? null : (
            <Text testID="review-hint" variant="meta" style={{ color: palette.muted }}>
              {t("Pilih bintang dulu.", "Pick a star rating first.")}
            </Text>
          )}
          <Button
            label={t("Kirim ulasan", "Send review")}
            busy={busy}
            disabled={!rating}
            onPress={() => void send()}
          />
          <Button
            variant="text"
            label={t("Nanti saja", "Not now")}
            disabled={busy}
            onPress={() => {
              drafts.delete(draftKey);
              markReview(markKey, "dismissed");
              setFinished("later");
            }}
          />
        </>
      }
    >
      <View testID="review-sheet" style={{ gap: 12 }}>
        <Stars
          value={rating}
          target={48}
          glyph={28}
          onPick={(n) => {
            setRating(n);
            keep({ rating: n });
          }}
        />
        {/* Once the overall rating is picked: Rasa, Pengantaran and Harga start at it and can each be changed. */}
        {rating
          ? PARTS.map((part) => (
              <View
                key={part}
                testID={`review-part-${part}`}
                style={{
                  flexDirection: stacked ? "column" : "row",
                  alignItems: stacked ? "flex-start" : "center",
                  justifyContent: "space-between",
                  gap: stacked ? 2 : 12,
                }}
              >
                <Text variant="body" style={{ flexShrink: 1 }}>
                  {partLabel[part]}
                </Text>
                <Stars
                  value={parts[part] ?? rating}
                  prefix={`${partLabel[part]} `}
                  target={44}
                  glyph={22}
                  onPick={(n) => {
                    const next = { ...parts, [part]: n };
                    setParts(next);
                    keep({ parts: next });
                  }}
                />
              </View>
            ))
          : null}
        <Field
          label={t("Cerita singkat (opsional)", "A few words (optional)")}
          value={body}
          onChangeText={(text) => {
            setBody(text);
            keep({ body: text });
          }}
          multiline
          maxLength={1000}
        />
      </View>
    </Frame>
  );
}
