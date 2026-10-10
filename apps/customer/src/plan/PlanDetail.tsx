import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import {
  dayLabel,
  jakartaDay,
  planDetail,
  shortDate,
  type CustomerState,
  type PlanDetail as PlanData,
  type UpcomingRow,
} from "@catera/domain";
import { useData, useMobile, useTrack, type MobileRuntime } from "@catera/mobile-core";
import {
  Button,
  HeaderIconButton,
  linkTitle,
  MoodFill,
  Photo,
  PhotoRing,
  PressableRow,
  Screen,
  StickyAction,
  Text,
  themedStyles,
  useColors,
  useMoodColors,
  useScreenNavigation,
} from "@catera/mobile-ui";
import { SignInFirst } from "../account/SignInFirst";
import { catererPhoneOf, openCatererChat } from "../help/ChatKatering";
import { remainingLabel } from "../remaining";
import { loadCachedCustomer } from "../today/offline";
import { jakartaClock, photoUri } from "../today/Plate";
import { dayHref } from "../hrefs";
import { goToTab } from "../nav";

type LoadedPlan = { data: CustomerState; savedAt: string | null };

/** The read Beranda makes, without writing the offline copy: a failed read falls back to the last good one. */
async function loadPlan(runtime: MobileRuntime, key: string): Promise<LoadedPlan> {
  try {
    return { data: await runtime.api.customer(), savedAt: null };
  } catch (e) {
    const cached = await loadCachedCustomer(key);
    if (cached) return { data: cached.data, savedAt: cached.savedAt };
    throw e;
  }
}

const tabular = { fontVariant: ["tabular-nums" as const] };
const HERO_RADIUS = 28;

/**
 * /subscriptions/{id}: one plan, what is left of it and what comes next. It sits under the native header, whose back
 * returns to the tab root behind it, even from a cold link. The plan's name is the screen's native title; a link that
 * knows the name carries it as `title`, so "Paket" never shows while the plan loads. A read that fails or comes back
 * without the plan names the screen "Paket" again: the carried name was never checked against a record.
 */
export function PlanDetailScreen() {
  const params = useLocalSearchParams<{ id: string; title?: string }>();
  const { id } = params;
  const { actor, ready, t } = useMobile();
  const c = useColors();
  const carried = linkTitle(params);
  const generic = t("Paket", "Plan");
  if (!ready)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.canvas }}>
        <ActivityIndicator color={c.forest} />
      </View>
    );
  const planId = String(id ?? "");
  if (!actor)
    return (
      <SignInFirst title={carried ?? generic} next={`/subscriptions/${encodeURIComponent(planId)}`}>
        <Button variant="text" label={t("Ke Beranda", "Go to Beranda")} onPress={() => goToTab("index")} />
      </SignInFirst>
    );
  return <Plan key={`${actor.id}:${planId}`} id={planId} actorId={actor.id} carried={carried} generic={generic} />;
}

function Plan({ id, actorId, carried, generic }: { id: string; actorId: string; carried?: string; generic: string }) {
  const { runtime, t, locale } = useMobile();
  const c = useColors();
  const track = useTrack();
  const read = useData("plan:customer", () => loadPlan(runtime, actorId));
  const state = read.data?.data;
  const savedAt = read.data?.savedAt ?? null;
  // A status the screen has no words for (not active, completed or cancelled) reads as not found, never as a blank plan.
  const plan = useMemo(() => {
    const detail = state ? planDetail(state, id, new Date(), locale) : null;
    return detail && (detail.status !== "other" || detail.sub.status === "cancelled") ? detail : null;
  }, [state, id, locale]);

  // Once per open, however often the read comes round again.
  const counted = useRef(false);
  useEffect(() => {
    if (!plan || counted.current) return;
    counted.current = true;
    track("plan_sheet_opened");
  }, [plan, track]);

  // Chat with the kitchen sits at the trailing end of the native bar, as on the approved canvas, and only while the
  // read carries the caterer's verified number for this plan; without one the bar has no button at all.
  const navigation = useScreenNavigation();
  const phone = catererPhoneOf(state?.deliveries.find((d) => d.subscription_id === id && d.catererPhone));
  const caterer = plan?.offer.caterer ?? "";
  useLayoutEffect(() => {
    if (!navigation) return;
    navigation.setOptions({
      headerRight:
        plan && phone
          ? () => (
              <HeaderIconButton
                icon="chat"
                slot="trailing"
                label={caterer ? t(`Chat ${caterer}`, `Chat ${caterer}`) : t("Chat katering", "Chat caterer")}
                onPress={() => openCatererChat(phone)}
              />
            )
          : undefined,
    });
  }, [navigation, plan, phone, caterer, t]);

  if (!plan) {
    const loading = !state && read.loading;
    return (
      <Screen nativeTitle={loading ? (carried ?? generic) : generic}>
        {loading ? (
          <Text style={{ color: c.muted }}>{t("Memuat paket…", "Loading plan…")}</Text>
        ) : !state ? (
          <View style={{ gap: 8, alignItems: "flex-start" }}>
            <Text variant="heading" accessibilityRole="text" selectable style={{ color: c.danger }}>
              {t("Belum bisa memuat", "Couldn't load yet")}
            </Text>
            {read.error ? (
              <Text selectable style={{ color: c.danger }}>
                {read.error}
              </Text>
            ) : null}
            <Button variant="secondary" label={t("Coba lagi", "Try again")} onPress={() => void read.reload()} />
          </View>
        ) : (
          // The read came back without this plan (another account's, or gone from a stale link), or in a status this screen cannot name.
          <View style={{ gap: 8, alignItems: "flex-start" }}>
            <Text variant="heading" accessibilityRole="text">
              {t("Paket tidak ditemukan.", "Plan not found.")}
            </Text>
            <Button variant="secondary" label={t("Ke Beranda", "Go to Beranda")} onPress={() => goToTab("index")} />
          </View>
        )}
      </Screen>
    );
  }

  const offline = !!savedAt;
  const cancelled = plan.sub.status === "cancelled";
  const { action } = plan;
  // Renewing and buying need the network, so a copy kept from before the connection dropped offers neither.
  // A cancelled plan offers nothing either: it names what happened and its dates.
  const footer = offline || cancelled ? null : action.kind === "renew" ? (
    <StickyAction
      label={t("Lanjutkan paket", "Continue this plan")}
      onPress={() => {
        track("renew_started");
        router.push(action.href as never);
      }}
    />
  ) : action.kind === "trial" ? (
    <StickyAction
      label={t("Lanjutkan dengan paket penuh", "Continue with the full plan")}
      onPress={() => router.push(action.href as never)}
    />
  ) : null;

  return (
    <Screen nativeTitle={plan.offer.name} footer={footer}>
      {plan.offer.caterer ? (
        <Text testID="plan-caterer" selectable style={{ color: c.muted, marginTop: -8 }}>
          {plan.offer.caterer}
        </Text>
      ) : null}
      <Hero plan={plan} apiBase={runtime.apiBase} />
      {offline ? (
        <Text variant="caption" style={[{ color: c.sunriseInk }, tabular]}>
          {t("Terakhir diperbarui", "Last updated")} {jakartaClock(savedAt)} · {t("tidak ada koneksi", "no connection")}
        </Text>
      ) : null}
      {cancelled ? null : <Upcoming rows={plan.upcoming} apiBase={runtime.apiBase} />}
    </Screen>
  );
}

/** The screen's one raised card, on the mood's hero fill: the package photo, what is left of the plan and its dates. */
function Hero({ plan, apiBase }: { plan: PlanData; apiBase: string }) {
  const { t, locale } = useMobile();
  const palette = useMoodColors();
  const styles = useStyles();
  const photo = plan.offer.image ?? "";
  // The screen only reaches here for an active, completed or cancelled plan.
  const headline =
    plan.status === "active"
      ? remainingLabel(plan.remaining, t)
      : plan.status === "completed"
        ? t("Paket selesai", "Plan finished")
        : t("Paket dibatalkan", "Plan cancelled");
  return (
    <View testID="plan-hero" style={{ padding: 10, borderRadius: HERO_RADIUS, borderCurve: "continuous" }}>
      <MoodFill surface="hero" testID="plan-hero-fill" radius={HERO_RADIUS} heroShadow />
      {photo ? (
        <View style={styles.photoFrame}>
          <Photo testID="plan-photo" uri={photoUri(photo, apiBase)} style={{ width: "100%", height: 168 }} />
        </View>
      ) : null}
      <View style={{ paddingHorizontal: 8, paddingTop: 12, paddingBottom: 8, gap: 2 }}>
        {/* The screen's one heading is the package name in the header, so this headline is plain text. */}
        <Text variant="title" accessibilityRole="text" selectable style={[{ color: palette.heroText }, tabular]}>
          {headline}
        </Text>
        <Text selectable style={[{ color: palette.heroMeta }, tabular]}>
          {/* A one-day plan names its day once. */}
          {plan.startsOn === plan.endsOn
            ? shortDate(plan.startsOn, locale)
            : `${shortDate(plan.startsOn, locale)} – ${shortDate(plan.endsOn, locale)}`}
        </Text>
        {plan.action.kind === "renewed" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 6 }}>
            <Ionicons name="checkmark-circle" size={18} color={palette.heroText} />
            <Text variant="label" style={{ color: palette.heroText, flexShrink: 1 }}>
              {t("Sudah diperpanjang", "Already renewed")}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** This plan's next days: a ring with the day's photo (lunch sunrise, dinner forest), the day and its dishes. */
function Upcoming({ rows, apiBase }: { rows: UpcomingRow[]; apiBase: string }) {
  const { t, locale } = useMobile();
  const c = useColors();
  const styles = useStyles();
  const today = jakartaDay(new Date());
  return (
    <View>
      <Text variant="label" style={{ marginBottom: 4 }}>
        {t("Berikutnya", "Coming up")}
      </Text>
      {rows.length ? (
        rows.map((row, i) => {
          const day = locale === "id" ? row.label : dayLabel(row.date, today, "en");
          const dishes = row.dishes || t("Menu belum ditentukan", "Menu not set yet");
          return (
            <PressableRow
              key={row.deliveryId}
              testID="plan-upcoming-row"
              accessibilityRole="button"
              accessibilityLabel={`${day}, ${dishes}`}
              onPress={() => router.push(dayHref(row.deliveryId, row.date, locale) as never)}
              style={[styles.row, i > 0 && styles.divider]}
            >
              {/* The row is the button and speaks for the ring. */}
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <PhotoRing
                  uri={photoUri(row.image, apiBase)}
                  size={60}
                  ring={row.meal === "dinner" ? "forest" : "sunrise"}
                  accessibilityLabel={dishes}
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="label" style={[{ lineHeight: 18 }, tabular]}>
                  {day}
                </Text>
                <Text>{dishes}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            </PressableRow>
          );
        })
      ) : (
        <Text style={{ color: c.muted }}>{t("Tidak ada antaran mendatang.", "No upcoming deliveries.")}</Text>
      )}
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  // The soft ground of the photo inside, so the frame reads as one tile while the photo loads or if it never does.
  photoFrame: { borderRadius: 20, borderCurve: "continuous", overflow: "hidden", backgroundColor: c.sage },
  row: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  divider: { borderTopWidth: 1, borderTopColor: c.line },
}));
