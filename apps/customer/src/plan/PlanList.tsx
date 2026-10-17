import { View } from "react-native";
import { router } from "expo-router";
import { planLabel, type CustomerState } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { FadeSwap, ReadError, Screen, Text, useColors } from "@catera/mobile-ui";
import { Row } from "../account/Row";
import { SignInFirst } from "../account/SignInFirst";
import { remainingLabel } from "../remaining";
import { planHref } from "../hrefs";
import { usePullToRefresh } from "../refresh";
import { ListSkeleton } from "../skeletons";

/**
 * The running plans as plain rows: the plan's name (with its dates when another running plan has the same name), its
 * kitchen and the days left. A row opens the plan detail. Loading (two skeleton rows), a failed read with "Coba lagi",
 * and no plan each say so; the rows fade in from the skeleton as one block. Akun's "Paket aktif" and Paket saya both
 * show it. Where the list is the whole page (Paket saya, `art`), its failed read leads with the puzzled mascot (spec
 * 7.2); inside Akun the page around it still stands, so the failure stays the compact line.
 */
export function PlanList({
  customer,
  art = false,
}: {
  customer: { data: CustomerState | null; loading: boolean; error: string; reload: () => Promise<void> };
  art?: boolean;
}) {
  const loading = customer.loading && !customer.data;
  const failed = !!customer.error && !customer.data;
  return (
    <FadeSwap swapKey={loading ? "loading" : failed ? "error" : "ready"}>
      <PlanRows customer={customer} loading={loading} failed={failed} art={art} />
    </FadeSwap>
  );
}

function PlanRows({
  customer,
  loading,
  failed,
  art,
}: {
  customer: { data: CustomerState | null; error: string; reload: () => Promise<void> };
  loading: boolean;
  failed: boolean;
  art: boolean;
}) {
  const { t, locale } = useMobile();
  const c = useColors();
  if (loading) return <ListSkeleton rows={2} label={t("Memuat paket", "Loading plans")} />;
  if (failed)
    return (
      <View style={{ marginTop: 6 }}>
        <ReadError art={art} message={customer.error} onRetry={() => void customer.reload()} />
      </View>
    );
  const all = customer.data?.subscriptions ?? [];
  // By name, then by start date, so plans that share a name sit together in date order.
  const active = all
    .filter((s) => s.status === "active")
    .sort(
      (a, b) =>
        (a.snapshot?.offer?.name ?? "").localeCompare(b.snapshot?.offer?.name ?? "", locale) ||
        a.starts_on.localeCompare(b.starts_on),
    );
  if (!active.length)
    return <Text style={{ color: c.muted, marginTop: 6 }}>{t("Belum ada paket aktif.", "No active plans.")}</Text>;
  return (
    <View testID="plan-row-list">
      {active.map((s, i) => (
        <Row
          key={s.id}
          first={i === 0}
          label={planLabel(s, all, locale)}
          caption={`${s.snapshot.offer.caterer} · ${remainingLabel(s.remaining, t)}`}
          onPress={() => router.push(planHref(s.id, s.snapshot.offer.name) as never)}
        />
      ))}
    </View>
  );
}

/** Paket saya: every running plan, opened from the plans row at the end of Beranda. */
export function PaketSaya() {
  const { actor, ready, t } = useMobile();
  // Before the session is known the page is already the list's shape under its title.
  if (!ready)
    return (
      <Screen nativeTitle={t("Paket aktif", "Active plans")}>
        <ListSkeleton rows={2} label={t("Memuat paket", "Loading plans")} />
      </Screen>
    );
  if (!actor) return <SignInFirst title={t("Paket aktif", "Active plans")} next="/paket-saya" />;
  return <Plans key={actor.id} />;
}

function Plans() {
  const { runtime, t } = useMobile();
  const customer = useData("paket-saya:customer", () => runtime.api.customer());
  // Pulling down reads the plans again; the rows stay until the answer lands.
  const pull = usePullToRefresh(customer.reload);
  return (
    <Screen nativeTitle={t("Paket aktif", "Active plans")} refreshControl={customer.data ? pull : undefined}>
      <PlanList customer={customer} art />
    </Screen>
  );
}
