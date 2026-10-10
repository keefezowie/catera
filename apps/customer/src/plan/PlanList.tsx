import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";
import { planLabel, type CustomerState } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, Screen, Text, themedStyles, useColors } from "@catera/mobile-ui";
import { Row } from "../account/Row";
import { SignInFirst } from "../account/SignInFirst";
import { remainingLabel } from "../remaining";
import { planHref } from "../hrefs";

/**
 * The running plans as plain rows: the plan's name (with its dates when another running plan has the same name), its
 * kitchen and the days left. A row opens the plan detail. Loading, a failed read with "Coba lagi", and no plan each
 * say so. Akun's "Paket aktif" and Paket saya both show it.
 */
export function PlanList({
  customer,
}: {
  customer: { data: CustomerState | null; loading: boolean; error: string; reload: () => Promise<void> };
}) {
  const { t, locale } = useMobile();
  const c = useColors();
  if (customer.loading && !customer.data)
    return <ActivityIndicator color={c.forest} style={{ alignSelf: "flex-start", marginTop: 8 }} />;
  if (customer.error && !customer.data)
    return (
      <View style={{ gap: 8, marginTop: 6 }}>
        <Text selectable style={{ color: c.danger }}>
          {customer.error}
        </Text>
        <Button variant="secondary" label={t("Coba lagi", "Try again")} onPress={() => void customer.reload()} />
      </View>
    );
  const all = customer.data?.subscriptions ?? [];
  const active = all.filter((s) => s.status === "active");
  if (!active.length)
    return <Text style={{ color: c.muted, marginTop: 6 }}>{t("Belum ada paket aktif.", "No active packages.")}</Text>;
  return (
    <View>
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
  const c = useColors();
  const styles = useStyles();
  if (!ready)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.forest} />
      </View>
    );
  if (!actor) return <SignInFirst title={t("Paket aktif", "Active plans")} next="/paket-saya" />;
  return <Plans key={actor.id} />;
}

function Plans() {
  const { runtime, t } = useMobile();
  const customer = useData("paket-saya:customer", () => runtime.api.customer());
  return (
    <Screen nativeTitle={t("Paket aktif", "Active plans")}>
      <PlanList customer={customer} />
    </Screen>
  );
}

const useStyles = themedStyles((c) => ({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.canvas },
}));
