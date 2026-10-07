import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { jakartaDay, type Notice } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, Card, colors, Screen, Text } from "@catera/mobile-ui";
import { customerLink } from "../links";
import { longDay } from "../schedule/dates";
import { jakartaClock } from "../today/Plate";
import { usePush } from "./push";
import { SignInFirst } from "./SignInFirst";

/** Notifikasi: push on this phone (Aktif / Nonaktif) and the latest updates, each opening its screen. */
export function NotificationsScreen() {
  const { actor, ready, t } = useMobile();
  if (!ready)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  if (!actor) return <SignInFirst title={t("Notifikasi", "Notifications")} next="/notifications" />;
  return <Updates key={actor.id} />;
}

function PushCard() {
  const { t } = useMobile();
  const push = usePush();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontWeight: "700" }}>{t("Notifikasi di HP ini", "Notifications on this phone")}</Text>
          <Text variant="caption">
            {t("Kabar pengantaran, pembayaran dan bantuan.", "Delivery, payment and help updates.")}
          </Text>
        </View>
        {push.on === null ? null : (
          <Text variant="label" style={{ color: push.on ? colors.forest : colors.muted }}>
            {push.on ? t("Aktif", "On") : t("Nonaktif", "Off")}
          </Text>
        )}
      </View>
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      {push.on === false ? (
        <Button
          variant="secondary"
          label={t("Aktifkan", "Turn on")}
          disabled={busy}
          onPress={() => {
            setBusy(true);
            setError("");
            push
              .enable()
              .catch((e: Error) => setError(e.message || t("Belum berhasil. Coba lagi.", "That didn't work. Try again.")))
              .finally(() => setBusy(false));
          }}
        />
      ) : null}
    </Card>
  );
}

function Updates() {
  const { runtime, command, t, locale } = useMobile();
  const customer = useData("notifications:customer", () => runtime.api.customer());
  const notes = customer.data?.notifications ?? [];

  async function open(n: Notice) {
    // Marking read is a courtesy; the update itself still opens if it fails.
    if (!n.read_at) await command("notification.read", { id: n.id }).catch(() => undefined);
    router.push(customerLink(n.href) as never);
  }

  return (
    <Screen>
      <PushCard />
      {!customer.data ? (
        customer.error ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.danger }}>{customer.error}</Text>
            <Button variant="secondary" label={t("Coba lagi", "Try again")} onPress={() => void customer.reload()} />
          </View>
        ) : (
          <ActivityIndicator color={colors.forest} />
        )
      ) : notes.length ? (
        <View>
          {notes.map((n, i) => (
            <Pressable
              key={n.id}
              accessibilityRole="button"
              onPress={() => void open(n)}
              style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && { opacity: 0.7 }]}
            >
              <View style={[styles.dot, { backgroundColor: n.read_at ? "transparent" : colors.forest }]} />
              <View style={{ flex: 1, gap: 2 }}>
                {!n.read_at ? <Text variant="label">{t("Baru", "New")}</Text> : null}
                <Text>{n.body}</Text>
                <Text variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
                  {`${longDay(jakartaDay(new Date(n.created_at)), locale)} · ${jakartaClock(n.created_at)}`}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          <Text variant="heading">{t("Belum ada kabar baru.", "No new updates yet.")}</Text>
          <Text style={{ color: colors.muted }}>
            {t("Kabar makanan dan bantuan akan hadir di sini.", "Meal and support updates will appear here.")}
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
  row: { minHeight: 52, flexDirection: "row", gap: 10, paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
});
