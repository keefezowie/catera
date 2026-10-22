import { View } from "react-native";
import { router } from "expo-router";
import { nativeLayout } from "@catera/design-tokens";
import { planLabel, shortDate, type CustomerState, type Subscription } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { FadeSwap, ReadError, Screen, Text, themedStyles, useColors } from "@catera/mobile-ui";
import { SignInFirst } from "../account/SignInFirst";
import { DecorativeIcon, ListCard, MediaRow } from "../layout";
import { remainingLabel } from "../remaining";
import { planHref } from "../hrefs";
import { usePullToRefresh } from "../refresh";
import { PlanListSkeleton } from "../skeletons";
import { photoUri } from "../today/photoUri";

/**
 * Paket saya: the running plans under "Aktif" (soonest end first) and, only when the read holds any, the finished ones
 * under "Selesai" (most recently ended first), each a card of 72 rows with the package photo. A row opens the plan
 * detail. Loading (the same two sections' shape), a failed read with the puzzled mascot and "Coba lagi", and no plan
 * each say so; the sections fade in from the skeleton as one block.
 */
export function PlanList({
  customer,
}: {
  customer: { data: CustomerState | null; loading: boolean; error: string; reload: () => Promise<void> };
}) {
  const loading = customer.loading && !customer.data;
  const failed = !!customer.error && !customer.data;
  return (
    <FadeSwap swapKey={loading ? "loading" : failed ? "error" : "ready"}>
      <PlanSections customer={customer} loading={loading} failed={failed} />
    </FadeSwap>
  );
}

/** The plans Paket saya lists: running ones by their end date, then name; finished ones the latest end first. */
function splitPlans(all: Subscription[], locale: string): { active: Subscription[]; finished: Subscription[] } {
  const active = all
    .filter((s) => s.status === "active")
    .sort(
      (a, b) =>
        a.ends_on.localeCompare(b.ends_on) ||
        (a.snapshot?.offer?.name ?? "").localeCompare(b.snapshot?.offer?.name ?? "", locale) ||
        a.starts_on.localeCompare(b.starts_on),
    );
  const finished = all.filter((s) => s.status === "completed").sort((a, b) => b.ends_on.localeCompare(a.ends_on));
  return { active, finished };
}

function PlanSections({
  customer,
  loading,
  failed,
}: {
  customer: { data: CustomerState | null; error: string; reload: () => Promise<void> };
  loading: boolean;
  failed: boolean;
}) {
  const { t, locale, runtime } = useMobile();
  const c = useColors();
  const styles = useStyles();
  if (loading) return <PlanListSkeleton />;
  if (failed) return <ReadError art message={customer.error} onRetry={() => void customer.reload()} />;
  const all = customer.data?.subscriptions ?? [];
  const { active, finished } = splitPlans(all, locale);
  const row = (s: Subscription, meta: string) => (
    <MediaRow
      key={s.id}
      testID={`plan-row-${s.id}`}
      wrap
      image={s.snapshot.offer.image ? photoUri(s.snapshot.offer.image, runtime.apiBase) : null}
      title={s.status === "active" ? planLabel(s, all, locale) : s.snapshot.offer.name}
      meta={meta}
      trailing={<DecorativeIcon name="chevron-forward" size={20} color={c.muted} />}
      onPress={() => router.push(planHref(s.id, s.snapshot.offer.name) as never)}
    />
  );
  const count = active.length === 1 ? t("1 paket", "1 plan") : t(`${active.length} paket`, `${active.length} plans`);
  return (
    <View style={styles.sections}>
      <View>
        <SectionHeading title={t("Aktif", "Active")} count={active.length ? count : undefined} />
        {active.length ? (
          <View testID="plan-row-list">
            <ListCard>
              {active.map((s) => row(s, `${s.snapshot.offer.caterer} · ${remainingLabel(s.remaining, t)}`))}
            </ListCard>
          </View>
        ) : (
          <Text variant="bodyL" style={{ color: c.muted }}>
            {t("Belum ada paket aktif.", "No active plans.")}
          </Text>
        )}
      </View>
      {finished.length ? (
        <View>
          <SectionHeading title={t("Selesai", "Finished")} />
          <View testID="plan-finished-list">
            <ListCard>
              {finished.map((s) => row(s, `${s.snapshot.offer.caterer} · ${shortDate(s.ends_on, locale)}`))}
            </ListCard>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** A section's `section` heading with its count at the end, 12 above the card. */
function SectionHeading({ title, count }: { title: string; count?: string }) {
  const styles = useStyles();
  return (
    <View testID="plan-section" style={styles.heading}>
      <Text variant="section" style={styles.title}>
        {title}
      </Text>
      {count ? <Text variant="meta">{count}</Text> : null}
    </View>
  );
}

/** Paket saya: every plan, opened from the plans row at the end of Beranda and from Akun's first tile. */
export function PaketSaya() {
  const { actor, ready, t } = useMobile();
  // Before the session is known the page is already the list's shape under its title.
  if (!ready)
    return (
      <Screen nativeTitle={t("Paket saya", "My plans")}>
        <PlanListSkeleton />
      </Screen>
    );
  if (!actor) return <SignInFirst title={t("Paket saya", "My plans")} next="/paket-saya" />;
  return <Plans key={actor.id} />;
}

function Plans() {
  const { runtime, t } = useMobile();
  const customer = useData("paket-saya:customer", () => runtime.api.customer());
  // Pulling down reads the plans again; the rows stay until the answer lands.
  const pull = usePullToRefresh(customer.reload);
  return (
    <Screen nativeTitle={t("Paket saya", "My plans")} refreshControl={customer.data ? pull : undefined}>
      <PlanList customer={customer} />
    </Screen>
  );
}

const useStyles = themedStyles(() => ({
  // Sections sit 32 apart; each heading is 12 above its card.
  sections: { gap: nativeLayout.sectionGap },
  heading: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: nativeLayout.space.md,
    marginBottom: nativeLayout.headingGap,
  },
  title: { flex: 1 },
}));
