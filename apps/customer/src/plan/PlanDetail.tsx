import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import {
  dayLabel,
  jakartaDay,
  mealLabel,
  planDetail,
  shortDate,
  type CustomerState,
  type PlanDetail as PlanData,
  type UpcomingRow,
} from "@catera/domain";
import { nativeLayout } from "@catera/design-tokens";
import { useData, useMobile, useTrack, type MobileRuntime } from "@catera/mobile-core";
import {
  Button,
  ConnectionBanner,
  FadeSwap,
  HeaderIconButton,
  linkTitle,
  MoodFill,
  Photo,
  ReadError,
  Screen,
  StickyAction,
  Text,
  useColors,
  useMoodColors,
  useScreenNavigation,
} from "@catera/mobile-ui";
import { SignInFirst } from "../account/SignInFirst";
import { catererPhoneOf, openCatererChat } from "../help/ChatKatering";
import { remainingLabel } from "../remaining";
import { StaleCopy } from "../staleCopy";
import { loadCachedCustomer } from "../today/offline";
import { photoUri } from "../today/photoUri";
import { dayHref } from "../hrefs";
import { goToTab } from "../nav";
import { PlanSkeleton } from "../skeletons";
import { ListCard, MediaRow, SectionHeader } from "../layout";
import { HERO_RADIUS } from "../today/Plate";
import { HeroPhotoFrame } from "../today/HeroPhoto";

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
  const carried = linkTitle(params);
  const generic = t("Paket", "Plan");
  if (!ready)
    return (
      <Screen nativeTitle={carried ?? generic}>
        <PlanSkeleton />
      </Screen>
    );
  const planId = String(id ?? "");
  if (!actor)
    return (
      <SignInFirst title={carried ?? generic} next={`/subscriptions/${encodeURIComponent(planId)}`}>
        <Button variant="text" label={t("Ke Beranda", "Go to Home")} onPress={() => goToTab("index")} />
      </SignInFirst>
    );
  return <Plan key={`${actor.id}:${planId}`} id={planId} actorId={actor.id} carried={carried} generic={generic} />;
}

function Plan({ id, actorId, carried, generic }: { id: string; actorId: string; carried?: string; generic: string }) {
  const { runtime, t, locale } = useMobile();
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
        {/* The plan fades in from its skeleton as one block (the same FadeSwap as the loaded page below). */}
        <FadeSwap swapKey={loading ? "loading" : "missing"} style={{ gap: 16 }}>
          {loading ? (
            <PlanSkeleton />
          ) : !state ? (
            <ReadError
              art
              message={read.error || t("Belum bisa memuat paket", "Couldn't load this package")}
              onRetry={() => void read.reload()}
            />
          ) : (
            // The read came back without this plan (another account's, or gone from a stale link), or in a status this screen cannot name.
            <View style={{ gap: 8, alignItems: "flex-start" }}>
              <Text variant="heading" accessibilityRole="text">
                {t("Paket tidak ditemukan.", "Plan not found.")}
              </Text>
              <Button variant="secondary" label={t("Ke Beranda", "Go to Home")} onPress={() => goToTab("index")} />
            </View>
          )}
        </FadeSwap>
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
      <FadeSwap swapKey="ready" style={{ gap: nativeLayout.space.lg }}>
        <Hero plan={plan} apiBase={runtime.apiBase} />
        {/* Mounted whatever the page shows; it appears only while the phone is offline, naming the time of this copy. */}
        <ConnectionBanner lastSeen={savedAt ? new Date(savedAt) : undefined} onRetry={() => void read.reload()} />
        <StaleCopy savedAt={savedAt} onRetry={read.reload} />
        {cancelled ? null : <Upcoming rows={plan.upcoming} apiBase={runtime.apiBase} />}
      </FadeSwap>
    </Screen>
  );
}

/**
 * The screen's one raised card, Beranda's hero card on the mood's hero fill: the package photo at 16:10 across its top
 * (inside the 1.5 edge), then a body of 16 padding: the kitchen and meal as a meta line, what is left of the plan in
 * `heroTitle`, and its dates.
 */
function Hero({ plan, apiBase }: { plan: PlanData; apiBase: string }) {
  const { t, locale } = useMobile();
  const c = useColors();
  const palette = useMoodColors();
  const photo = plan.offer.image ?? "";
  // The screen only reaches here for an active, completed or cancelled plan.
  const headline =
    plan.status === "active"
      ? remainingLabel(plan.remaining, t)
      : plan.status === "completed"
        ? t("Paket selesai", "Plan finished")
        : t("Paket dibatalkan", "Plan cancelled");
  const meta = [plan.offer.caterer, mealLabel(plan.offer.meal, locale).toLowerCase()].filter(Boolean).join(" · ");
  return (
    <View testID="plan-hero" style={{ borderRadius: HERO_RADIUS, borderCurve: "continuous" }}>
      <MoodFill surface="hero" testID="plan-hero-fill" radius={HERO_RADIUS} heroShadow />
      {photo ? (
        // The soft ground of the photo inside, so the frame reads as one tile while the photo loads or if it never does.
        <HeroPhotoFrame ratio={nativeLayout.ratio.card} testID="plan-photo-frame" style={{ backgroundColor: c.sage }}>
          <Photo testID="plan-photo" uri={photoUri(photo, apiBase)} style={StyleSheet.absoluteFill} />
        </HeroPhotoFrame>
      ) : null}
      <View testID="plan-hero-body" style={{ padding: nativeLayout.cardPadding, gap: nativeLayout.space.md }}>
        <View style={{ gap: 2 }}>
          <Text variant="meta" selectable style={{ color: palette.heroMeta }}>
            {meta}
          </Text>
          {/* The screen's one heading is the package name in the header, so this headline is plain text. */}
          <Text variant="heroTitle" accessibilityRole="text" selectable style={[{ color: palette.heroText }, tabular]}>
            {headline}
          </Text>
          <Text variant="meta" selectable style={[{ color: palette.heroMeta }, tabular]}>
            {/* A one-day plan names its day once. */}
            {plan.startsOn === plan.endsOn
              ? shortDate(plan.startsOn, locale)
              : t(`${shortDate(plan.startsOn, locale)} sampai ${shortDate(plan.endsOn, locale)}`, `${shortDate(plan.startsOn, locale)} to ${shortDate(plan.endsOn, locale)}`)}
          </Text>
        </View>
        {plan.action.kind === "renewed" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
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

/**
 * This plan's next days: "Berikutnya" over one card of 72 rows, each a 56 thumb (a dashed tile while the day's menu is
 * not set), the date in `rowTitle` and the dishes as one truncated `meta` line. The row opens the day's sheet, where
 * the full list and every action are, so a row has no menu of its own. The date may wrap at large text; the dishes do not.
 */
function Upcoming({ rows, apiBase }: { rows: UpcomingRow[]; apiBase: string }) {
  const { t, locale } = useMobile();
  const c = useColors();
  const today = jakartaDay(new Date());
  return (
    // 16 from the screen's own gap and 16 more: the section sits 32 under whatever is above it.
    <View style={{ marginTop: nativeLayout.space.lg }}>
      <SectionHeader title={t("Berikutnya", "Coming up")} />
      {rows.length ? (
        <ListCard>
          {rows.map((row) => (
            <MediaRow
              key={row.deliveryId}
              testID="plan-upcoming-row"
              image={photoUri(row.image, apiBase)}
              notSet={!row.dishes}
              title={locale === "id" ? row.label : dayLabel(row.date, today, "en")}
              meta={row.dishes || t("Menu belum diisi", "Menu not set yet")}
              trailing="chevron"
              wrap="title"
              onPress={() => router.push(dayHref(row.deliveryId, row.date, locale) as never)}
            />
          ))}
        </ListCard>
      ) : (
        <Text variant="bodyL" style={{ color: c.muted }}>
          {t("Belum ada pengantaran berikutnya.", "No upcoming deliveries.")}
        </Text>
      )}
    </View>
  );
}
