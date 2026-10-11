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
  PressableScale,
  SheetBody,
  SheetHeader,
  Skeleton,
  SkeletonGroup,
  Text,
  useColors,
  useToast,
  useUnsavedGuard,
} from "@catera/mobile-ui";
import { markReview } from "./reviewMark";

/**
 * Words typed and not sent, per person and plan, in memory only. Android's bottom sheet closes on a swipe before
 * anything can ask (`useUnsavedGuard`), so the review waits here and comes back when the sheet opens again for that
 * plan. Sending, "Nanti saja" or "Buang" drops it; closing the app forgets it.
 */
const drafts = new Map<string, { rating: number; body: string }>();

/** The sheet's frame: the title row over the scrolling content, in one FadeSwap so the form fades in as one block. */
function Frame({ title, swapKey, children }: { title: string; swapKey: string; children: ReactNode }) {
  const { t } = useMobile();
  return (
    <View style={{ flex: 1 }}>
      <SheetHeader title={title} closeLabel={t("Tutup", "Close")} />
      <SheetBody>
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
 * row as dealt with (`markReview`), so it leaves "Menunggu Anda" under the sheet. Sending closes the sheet with the toast
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
  const [rating, setRating] = useState(() => drafts.get(draftKey)?.rating ?? 5);
  const [body, setBody] = useState(() => drafts.get(draftKey)?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [finished, setFinished] = useState<"" | "sent" | "later">("");
  const closed = useRef(false);

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
    if (finished === "sent") toast.show({ message: t("Ulasan terkirim", "Review sent"), tone: "success" });
    router.back();
  }, [finished, toast, t]);

  const keep = (next: { rating?: number; body?: string }) => {
    const value = { rating: next.rating ?? rating, body: next.body ?? body };
    if (value.body.trim()) drafts.set(draftKey, value);
    else drafts.delete(draftKey);
  };

  if (!subscription)
    return (
      <Frame title={t("Ulasan", "Review")} swapKey={state.loading ? "loading" : "missing"}>
        {state.loading ? (
          <ReviewSkeleton />
        ) : (
          <>
            <Text selectable={!!state.error} style={{ color: state.error ? palette.danger : palette.muted }}>
              {state.error || t("Paket tidak ditemukan.", "Plan not found.")}
            </Text>
            {state.error ? <Button label={t("Coba lagi", "Try again")} onPress={() => void state.reload()} /> : null}
          </>
        )}
      </Frame>
    );

  const caterer = subscription.snapshot.offer.caterer;

  async function send() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await command("review.save", {
        subscriptionId: id,
        rating,
        food: rating,
        delivery: rating,
        value: rating,
        body,
      });
      drafts.delete(draftKey);
      markReview(markKey, "done");
      setFinished("sent");
    } catch (e) {
      const code = (e as { code?: string }).code || (e as Error).message;
      setError(errorLabel(code, locale) || t("Belum berhasil. Coba lagi.", "That didn't work. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Frame title={t(`Ulasan untuk ${caterer}`, `Your review of ${caterer}`)} swapKey="ready">
      <View testID="review-sheet" style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <PressableScale
              key={n}
              accessibilityRole="button"
              accessibilityLabel={t(`${n} bintang`, `${n} stars`)}
              accessibilityState={{ selected: n <= rating }}
              haptic="select"
              onPress={() => {
                setRating(n);
                keep({ rating: n });
              }}
              style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}
            >
              {/* Outline + muted (5.8:1) for unselected, filled + ink for selected: shape and colour both carry the state. */}
              <Ionicons
                name={n <= rating ? "star" : "star-outline"}
                size={28}
                color={n <= rating ? palette.sunriseInk : palette.muted}
              />
            </PressableScale>
          ))}
        </View>
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
        {error ? (
          <Text selectable style={{ color: palette.danger }}>
            {error}
          </Text>
        ) : null}
        <Button label={t("Kirim ulasan", "Send review")} disabled={busy} onPress={() => void send()} />
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
      </View>
    </Frame>
  );
}
