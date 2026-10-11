import { Image, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { mealLabel, reportableMeals, shortDate, statusLabel, type Delivery } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, Card, FadeSwap, linkTitle, Screen, Text, themedStyles, useColors } from "@catera/mobile-ui";
import { SignInFirst } from "../account/SignInFirst";
import { ChatKatering, catererPhoneOf } from "../help/ChatKatering";
import { photoUri } from "../today/Plate";
import { DaySkeleton } from "../skeletons";
import { DayMore } from "./DayMore";

/** One delivery day: what is coming, where, and the way into Ubah hari. */
export function DayScreen() {
  const params = useLocalSearchParams<{ id: string; title?: string }>();
  const { id } = params;
  const { actor, ready, t } = useMobile();
  // The bar keeps the day the link carried while the session is read; only the day itself waits.
  if (!ready)
    return (
      <Screen>
        <DaySkeleton />
      </Screen>
    );
  // Signed out, the screen keeps the day its link carried as its title ("Senin 12 Okt").
  if (!actor)
    return <SignInFirst title={linkTitle(params) ?? t("Hari", "Day")} next={`/hari/${id}`} />;
  return <Day key={`${actor.id}:${id}`} id={id} />;
}

const dishesOf = (d: Delivery, meal: "lunch" | "dinner") =>
  (d.offer.menus?.find((m) => m.meal === meal)?.items ?? []).map((i) => i.name).filter(Boolean).join(", ");

function Day({ id }: { id: string }) {
  const { runtime, t, locale } = useMobile();
  const c = useColors();
  const styles = useStyles();
  const state = useData(`day:${id}`, () => runtime.api.customer(`?deliveryId=${encodeURIComponent(id)}`));
  const d = state.data?.deliveries.find((x) => x.id === id);

  // While the day loads the bar keeps the day its link carried. A failed read or a day that is not there names the
  // screen "Hari": the carried day was never checked against a record.
  if (!d)
    return (
      <Screen title={state.loading ? undefined : t("Hari", "Day")}>
        {/* The day fades in from its skeleton as one block (the same FadeSwap as the loaded day below). */}
        <FadeSwap swapKey={state.loading ? "loading" : "missing"} style={{ gap: 16 }}>
          {state.loading ? (
            <DaySkeleton />
          ) : (
            <>
              <Text selectable={!!state.error} style={{ color: state.error ? c.danger : c.muted }}>
                {state.error || t("Pengantaran tidak ditemukan.", "Delivery not found.")}
              </Text>
              {state.error ? <Button label={t("Coba lagi", "Try again")} onPress={() => void state.reload()} /> : null}
            </>
          )}
        </FadeSwap>
      </Screen>
    );

  const meals = (d.meals ?? []).filter((m) => m.status !== "cancelled");
  const closed = d.status === "cancelled" || meals.every((m) => m.status === "delivered");
  const photo = d.offer.menus?.find((m) => m.meal === meals[0]?.meal)?.image || d.offer.image;
  const customerPicks = d.offer.menuSelectionMode === "customer";
  // Ada masalah only for a meal that is due or past (today or yesterday in Jakarta, never ahead) and
  // has no open report yet; a meal already reported is followed up from Bantuan.
  const openReport = (meal: string) =>
    (d.meals ?? []).some((m) => m.meal === meal && !!m.issue && m.issue.status !== "resolved");
  const reportTarget = reportableMeals(d, new Date()).find((meal) => !openReport(meal));
  return (
    // The day is the bar's title ("Senin 12 Okt"), so the body starts with the photo and the package.
    <Screen
      title={shortDate(d.service_date, locale)}
      footer={
        closed ? null : (
          <Button
            label={t("Ubah hari", "Change this day")}
            accessibilityLabel={t("Ubah hari", "Change this day")}
            onPress={() => router.push(`/ubah-hari/${encodeURIComponent(d.id)}` as never)}
          />
        )
      }
    >
      <FadeSwap swapKey="ready" style={{ gap: 16 }}>
        {photo ? (
          <Image source={{ uri: photoUri(photo, runtime.apiBase) }} style={styles.photo} accessibilityIgnoresInvertColors />
        ) : null}
        <Text variant="caption">
          {d.offer.name} · {d.offer.caterer}
        </Text>
        {meals.map((m) => (
          // Each meal is a row with its own "…": the day's other actions for that meal (spec 5.3).
          <Card key={m.meal} style={{ flexDirection: "row", alignItems: "flex-start", gap: 4 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="label" style={{ fontVariant: ["tabular-nums"] }}>
                {mealLabel(m.meal, locale)} · {d.offer.windows?.[m.meal]} · {statusLabel(m.status, locale)}
              </Text>
              {dishesOf(d, m.meal) ? <Text>{dishesOf(d, m.meal)}</Text> : null}
            </View>
            <View style={{ marginTop: -10, marginEnd: -10 }}>
              <DayMore delivery={d} meal={m.meal} />
            </View>
          </Card>
        ))}
        <View style={{ gap: 2 }}>
          <Text variant="label">{t("Diantar ke", "Delivered to")}</Text>
          <Text>
            {[d.address.label, d.address.line, d.address.area].filter(Boolean).join(" · ")}
          </Text>
          {d.address.instructions ? <Text variant="caption">{d.address.instructions}</Text> : null}
        </View>
        {customerPicks ? (
          <Button
            variant="secondary"
            label={t("Lihat atau pilih menu", "View or choose menu")}
            onPress={() =>
              router.push(
                `/subscriptions/${d.subscription_id}/menu?date=${d.service_date}&meal=${meals[0]?.meal ?? "lunch"}` as never,
              )
            }
          />
        ) : null}
        <ChatKatering phone={catererPhoneOf(d)} />
        {reportTarget ? (
          <Button
            variant="text"
            label={t("Ada masalah", "Report a problem")}
            onPress={() => router.push(`/masalah/${encodeURIComponent(d.id)}?meal=${reportTarget}` as never)}
          />
        ) : null}
      </FadeSwap>
    </Screen>
  );
}

const useStyles = themedStyles((c) => ({
  photo: { width: "100%", height: 180, borderRadius: 16, backgroundColor: c.sage },
}));
