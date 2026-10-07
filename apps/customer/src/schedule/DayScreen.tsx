import { useState } from "react";
import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { dayLabel, jakartaDay, mealLabel, statusLabel, type Delivery } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, Card, colors, Screen, Text } from "@catera/mobile-ui";
import { SignInFirst } from "../account/SignInFirst";
import { ChatKatering, catererPhoneOf } from "../help/ChatKatering";
import { photoUri } from "../today/Plate";
import { ChangeDaySheet } from "./ChangeDaySheet";

/** One delivery day: what is coming, where, and the way into Ubah hari. */
export function DayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { actor, ready, t } = useMobile();
  if (!ready)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  if (!actor) return <SignInFirst title={t("Hari", "Day")} next={`/hari/${id}`} />;
  return <Day key={`${actor.id}:${id}`} id={id} />;
}

const dishesOf = (d: Delivery, meal: "lunch" | "dinner") =>
  (d.offer.menus?.find((m) => m.meal === meal)?.items ?? []).map((i) => i.name).filter(Boolean).join(", ");

function Day({ id }: { id: string }) {
  const { runtime, t, locale } = useMobile();
  const state = useData(`day:${id}`, () => runtime.api.customer(`?deliveryId=${encodeURIComponent(id)}`));
  const [sheet, setSheet] = useState(false);
  const [notice, setNotice] = useState("");
  const d = state.data?.deliveries.find((x) => x.id === id);

  if (!d)
    return (
      <Screen>
        {state.loading ? (
          <ActivityIndicator color={colors.forest} />
        ) : (
          <>
            <Text variant="title">{t("Hari", "Day")}</Text>
            <Text style={{ color: state.error ? colors.danger : colors.muted }}>
              {state.error || t("Pengantaran tidak ditemukan.", "Delivery not found.")}
            </Text>
            {state.error ? <Button label={t("Coba lagi", "Try again")} onPress={() => void state.reload()} /> : null}
          </>
        )}
      </Screen>
    );

  const meals = d.meals.filter((m) => m.status !== "cancelled");
  const closed = d.status === "cancelled" || meals.every((m) => m.status === "delivered");
  const photo = d.offer.menus?.find((m) => m.meal === meals[0]?.meal)?.image || d.offer.image;
  const customerPicks = d.offer.menuSelectionMode === "customer";
  return (
    <Screen
      footer={
        closed ? null : (
          <Button label={t("Ubah hari", "Change this day")} accessibilityLabel={t("Ubah hari", "Change this day")} onPress={() => setSheet(true)} />
        )
      }
    >
      {photo ? (
        <Image source={{ uri: photoUri(photo, runtime.apiBase) }} style={styles.photo} accessibilityIgnoresInvertColors />
      ) : null}
      <View style={{ gap: 2 }}>
        <Text variant="title" style={{ fontVariant: ["tabular-nums"] }}>
          {dayLabel(d.service_date, jakartaDay(new Date()), locale)}
        </Text>
        <Text variant="caption">
          {d.offer.name} · {d.offer.caterer}
        </Text>
      </View>
      {notice ? (
        <Card tone="sage">
          <Text>{notice}</Text>
        </Card>
      ) : null}
      {meals.map((m) => (
        <Card key={m.meal} style={{ gap: 4 }}>
          <Text variant="label" style={{ fontVariant: ["tabular-nums"] }}>
            {mealLabel(m.meal, locale)} · {d.offer.windows?.[m.meal]} · {statusLabel(m.status, locale)}
          </Text>
          {dishesOf(d, m.meal) ? <Text>{dishesOf(d, m.meal)}</Text> : null}
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
      <Button
        variant="text"
        label={t("Ada masalah", "Report a problem")}
        onPress={() => router.push(`/masalah/${encodeURIComponent(d.id)}?meal=${meals[0]?.meal ?? "lunch"}` as never)}
      />
      {sheet ? (
        <ChangeDaySheet
          delivery={d}
          addresses={state.data?.addresses ?? []}
          onClose={() => setSheet(false)}
          onDone={setNotice}
          onStale={() => void state.reload()}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
  photo: { width: "100%", height: 180, borderRadius: 16, backgroundColor: colors.sage },
});
