import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  dayLabel,
  errorLabel,
  jakartaDay,
  recapCandidates,
  renewalDue,
  todayPlates,
  trialFollowUp,
  upcomingRows,
  type CustomerState,
  type Plate as PlateData,
  type Subscription,
} from "@catera/domain";
import { useData, useMobile, type MobileRuntime } from "@catera/mobile-core";
import {
  Button,
  Field,
  fontFor,
  MoodHeader,
  PhotoRing,
  PressableRow,
  PressableScale,
  Screen,
  Text,
  themedStyles,
  useColors,
  useMood,
  useMoodColors,
} from "@catera/mobile-ui";
import { ChatKatering } from "../help/ChatKatering";
import { EmptyHome } from "./EmptyHome";
import { jakartaClock, photoUri, Plate, sentences } from "./Plate";
import { RecapCard } from "./RecapCard";
import { RenewalCard, TrialCard } from "./RenewalCard";
import { UpcomingRows } from "./UpcomingRows";
import { MenuDueRows } from "./MenuDueRows";
import { TomorrowEntry } from "../tomorrow/TomorrowRow";
import { loadCachedCustomer, saveCachedCustomer } from "./offline";
import { remainingLabel } from "../remaining";

type LoadedCustomer = { data: CustomerState; savedAt: string | null };

async function loadCustomer(runtime: MobileRuntime, key: string): Promise<LoadedCustomer> {
  try {
    const data = await runtime.api.customer();
    await saveCachedCustomer(key, { savedAt: new Date().toISOString(), data });
    return { data, savedAt: null };
  } catch (e) {
    const cached = await loadCachedCustomer(key);
    if (cached) return { data: cached.data, savedAt: cached.savedAt };
    throw e;
  }
}

/** Subscriptions that still serve days: the package line and renewal card are about these. */
const isLive = (s: Subscription) => s.status === "active";

/** Asked once, when 3 or fewer days remain or after the final delivery (review.save needs one delivered day). */
function reviewCandidate(state: CustomerState): Subscription | undefined {
  return state.subscriptions.find(
    (s) =>
      s.status !== "cancelled" &&
      s.remaining <= 3 &&
      state.deliveries.some((d) => d.subscription_id === s.id && d.status === "delivered"),
  );
}

/** Beranda: today's plate, the next days, renewal and the package line. */
export function Beranda() {
  const { actor, ready } = useMobile();
  const c = useColors();
  const styles = useStyles();
  if (!ready)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.forest} />
      </View>
    );
  if (!actor) return <EmptyHome />;
  return <SignedInHome actorId={actor.id} />;
}

/** Plates that need the customer now. The mood must not hide them behind the other meal's hero. */
const NEEDS_YOU: PlateData["state"][] = ["due", "on_the_way", "failed"];

/**
 * The compact row for the meal the mood is not on: its ring, when it comes and its first dish. One tap switches to it.
 * When that plate needs the customer (it should have arrived, is on the way, or failed), its status sentence shows here
 * too, so "needs you now" stays visible; the actions are one tap away, on the hero.
 */
function OtherMealRow({ plate, apiBase, onPress }: { plate: PlateData; apiBase: string; onPress: () => void }) {
  const { t } = useMobile();
  const c = useColors();
  const styles = useStyles();
  const dinner = plate.meal === "dinner";
  const label = dinner ? t("Malam ini", "Dinner tonight") : t("Siang ini", "Lunch today");
  const dish = plate.dishes[0] ?? plate.packageName;
  const status = NEEDS_YOU.includes(plate.state) ? sentences(plate, t)[0] : "";
  return (
    <PressableScale
      testID="other-meal-row"
      accessibilityRole="button"
      haptic="select"
      onPress={onPress}
      style={styles.otherMeal}
    >
      {/* The row is the button and speaks for the ring. */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <PhotoRing
          uri={photoUri(plate.image, apiBase)}
          size={60}
          ring={dinner ? "forest" : "sunrise"}
          accessibilityLabel={dish}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" style={{ lineHeight: 18, fontVariant: ["tabular-nums"] }}>
          {plate.window ? `${label} · ${plate.window}` : label}
        </Text>
        <Text style={{ fontFamily: fontFor("700") }}>{dish}</Text>
        {status ? (
          <Text testID="other-meal-status" style={{ fontFamily: fontFor("700"), color: c.sunriseInk }}>
            {status}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

function SignedInHome({ actorId }: { actorId: string }) {
  const { runtime, t, locale } = useMobile();
  const c = useColors();
  const styles = useStyles();
  const { mood, setMood } = useMood();
  const palette = useMoodColors();
  const home = useData(`home:customer`, () => loadCustomer(runtime, actorId));
  // Menu choices that are due; Beranda still shows without them (offline or a failed feed).
  const actions = useData("home:actions", () => runtime.api.customerActions(20).catch(() => null));
  const state = home.data?.data;
  const now = new Date();

  if (!state)
    return (
      <Screen header={<MoodHeader title={t("Beranda", "Home")} />}>
        {home.loading ? (
          <ActivityIndicator color={c.forest} />
        ) : (
          <View style={{ gap: 4, alignItems: "flex-start" }}>
            <Text selectable testID="home-error" style={{ color: c.danger }}>
              {home.error}
            </Text>
            <Button variant="text" label={t("Coba lagi", "Try again")} onPress={() => void home.reload()} />
          </View>
        )}
      </Screen>
    );

  const plates = todayPlates(state, now);
  const rows = upcomingRows(state, now, 3, locale);
  const live = state.subscriptions.filter(isLive);
  // Plans that ended lately and were not renewed; the card itself checks whether its recap was already seen.
  const recaps = recapCandidates(state, now);
  const recap = recaps.length ? <RecapCard candidates={recaps} /> : null;
  if (!plates.length && !rows.length && !live.length) return <EmptyHome lead={recap} />;
  const savedAt = home.data?.savedAt;

  const today = jakartaDay(now);
  const meal = mood === "siang" ? "lunch" : "dinner";
  const heroPlate = plates.find((p) => p.meal === meal);
  const otherPlate = plates.find((p) => p.meal !== meal);
  // A second delivery of either meal stays a card below, so no plate with an action is ever dropped.
  const morePlates = plates.filter((p) => p !== heroPlate && p !== otherPlate);
  const lead = mood === "siang" ? t("Siang ini,", "Lunch today,") : t("Malam ini,", "Dinner tonight,");
  // Only a dish is lowercased; a package name keeps its own casing.
  const dish = heroPlate ? (heroPlate.dishes[0]?.toLowerCase() ?? heroPlate.packageName) : "";
  const headline = heroPlate ? `${lead}\n${dish}.` : `${lead}\n${t("tidak ada antaran.", "no delivery.")}`;
  const next = rows[0];
  const nextLabel = next ? (locale === "id" ? next.label : dayLabel(next.date, today, "en")) : "";
  // "Berikutnya" names a later day, so it is only true when nothing else is left today.
  const laterToday = !!otherPlate && !["arrived", "failed", "reported"].includes(otherPlate.state);
  const meta =
    !heroPlate && !laterToday && next ? t(`Berikutnya ${nextLabel}`, `Next ${nextLabel}`) : dayLabel(today, today, locale);

  return (
    <Screen
      header={
        <MoodHeader
          meta={meta}
          toggle
          arc
          overlap={heroPlate ? 58 : 0}
          title={
            <Text
              testID="home-title"
              variant="title"
              accessibilityRole="header"
              style={{ color: palette.headerText }}
            >
              {headline}
            </Text>
          }
        />
      }
    >
      {heroPlate ? (
        // One frame for the hero whichever meal it shows, so its fill cross-fades when the mood switches.
        <Plate
          key="hero"
          variant="hero"
          plate={heroPlate}
          apiBase={runtime.apiBase}
          offline={!!savedAt}
        />
      ) : null}
      {savedAt ? (
        <Text variant="caption" style={{ color: c.sunriseInk, fontVariant: ["tabular-nums"] }}>
          {t("Terakhir diperbarui", "Last updated")} {jakartaClock(savedAt)} ·{" "}
          {t("tidak ada koneksi", "no connection")}
        </Text>
      ) : home.error ? (
        <Text selectable variant="caption" style={{ color: c.danger }}>
          {home.error}
        </Text>
      ) : null}
      {otherPlate ? (
        <OtherMealRow
          plate={otherPlate}
          apiBase={runtime.apiBase}
          onPress={() => setMood(mood === "siang" ? "malam" : "siang")}
        />
      ) : null}
      {morePlates.map((p) => (
        <Plate key={`${p.deliveryId}:${p.meal}`} plate={p} apiBase={runtime.apiBase} offline={!!savedAt} />
      ))}
      <TomorrowEntry state={state} now={now} />
      {savedAt ? null : <MenuDueRows items={actions.data?.items ?? []} />}
      <UpcomingRows rows={rows} />
      {recap}
      {live.filter((s) => renewalDue(s, state.subscriptions)).map((s) => (
        <RenewalCard key={s.id} subscription={s} />
      ))}
      {live.filter((s) => trialFollowUp(s, state.subscriptions)).map((s) => (
        <TrialCard key={s.id} subscription={s} />
      ))}
      {live.map((s) => (
        <PackageLine
          key={s.id}
          subscription={s}
          phone={state.deliveries.find((d) => d.subscription_id === s.id && d.catererPhone)?.catererPhone ?? ""}
        />
      ))}
      {savedAt ? null : <ReviewPrompt state={state} />}
    </Screen>
  );
}

/** One running plan: the line opens its plan detail; the chat button beside it stays its own control. */
function PackageLine({ subscription: s, phone }: { subscription: Subscription; phone: string }) {
  const { t } = useMobile();
  const c = useColors();
  const styles = useStyles();
  const offer = s.snapshot.offer;
  return (
    <View style={styles.packageLine}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t(`${offer.name}, lihat detail paket`, `${offer.name}, see plan details`)}
        onPress={() => router.push(`/subscriptions/${encodeURIComponent(s.id)}` as never)}
        style={styles.packageOpen}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fontFor("700") }}>{offer.name}</Text>
          <Text variant="caption">
            {offer.caterer} · {remainingLabel(s.remaining, t)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.muted} />
      </PressableScale>
      <ChatKatering phone={phone} variant="text" />
    </View>
  );
}

function ReviewPrompt({ state }: { state: CustomerState }) {
  const { runtime, command, t, locale } = useMobile();
  // The `checked` updater below names its argument `c`, so the palette keeps a longer name here.
  const palette = useColors();
  const styles = useStyles();
  const candidate = reviewCandidate(state);
  const id = candidate?.id;
  const key = id ? runtime.storageKey(`review.${id}`) : "";
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!key) return;
    let live = true;
    void SecureStore.getItemAsync(key)
      .catch(() => null)
      .then((v) => {
        if (!live) return;
        setChecked((c) => ({ ...c, [key]: true }));
        if (v) setHidden((h) => ({ ...h, [key]: true }));
      });
    return () => {
      live = false;
    };
  }, [key]);

  if (!candidate || !checked[key] || hidden[key]) return null;
  const caterer = candidate.snapshot.offer.caterer;

  function hide(value: "dismissed" | "done") {
    setHidden((h) => ({ ...h, [key]: true }));
    void SecureStore.setItemAsync(key, value).catch(() => undefined);
  }

  async function send() {
    setBusy(true);
    setError("");
    try {
      await command("review.save", {
        subscriptionId: candidate!.id,
        rating,
        food: rating,
        delivery: rating,
        value: rating,
        body,
      });
      hide("done");
    } catch (e) {
      const code = (e as { code?: string }).code || (e as Error).message;
      setError(errorLabel(code, locale) || t("Belum berhasil. Coba lagi.", "That didn't work. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.review}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <PressableRow
          accessibilityRole="button"
          onPress={() => setOpen((o) => !o)}
          style={{ flex: 1, minHeight: 48, justifyContent: "center" }}
        >
          <Text style={{ fontFamily: fontFor("700") }}>
            {t(`Bagaimana ${caterer} selama ini?`, `How has ${caterer} been so far?`)}
          </Text>
        </PressableRow>
        <Button variant="text" label={t("Nanti saja", "Not now")} onPress={() => hide("dismissed")} />
      </View>
      {open ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <PressableScale
                key={n}
                accessibilityRole="button"
                accessibilityLabel={t(`${n} bintang`, `${n} stars`)}
                accessibilityState={{ selected: n <= rating }}
                haptic="select"
                onPress={() => setRating(n)}
                style={styles.star}
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
            onChangeText={setBody}
            multiline
            maxLength={1000}
          />
          {error ? (
            <Text selectable style={{ color: palette.danger }}>
              {error}
            </Text>
          ) : null}
          <Button label={t("Kirim ulasan", "Send review")} disabled={busy} onPress={() => void send()} />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.canvas },
  otherMeal: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12 },
  packageLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: c.line,
  },
  packageOpen: { flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  review: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  star: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
}));
