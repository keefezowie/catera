import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { errorLabel, jakartaDay, type Locale, type Notice } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, Card, fontFor, PressableRow, Screen, Text, themedStyles, useColors } from "@catera/mobile-ui";
import { customerLink } from "../links";
import { longDay } from "../schedule/dates";
import { jakartaClock } from "../today/Plate";
import { usePush } from "./push";
import { SignInFirst } from "./SignInFirst";
import { openLink } from "../nav";

/** Notifikasi: push on this phone (Aktif / Nonaktif) and the latest updates, each opening its screen. */
export function NotificationsScreen() {
  const { actor, ready, t } = useMobile();
  const c = useColors();
  const styles = useStyles();
  if (!ready)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.forest} />
      </View>
    );
  if (!actor) return <SignInFirst title={t("Notifikasi", "Notifications")} next="/notifications" />;
  return <Updates key={actor.id} />;
}

/** The shared label for a code (e.g. REQUEST_TIMEOUT); the phone's own sentence (permission, no EAS
 * project); never a bare code. */
function pushError(e: unknown, locale: Locale, t: (id: string, en: string) => string): string {
  const message = (e as Error)?.message ?? "";
  const code = (e as { code?: string })?.code || message;
  return (
    errorLabel(code, locale) ||
    (/\s/.test(message) ? message : t("Notifikasi belum bisa diaktifkan. Coba lagi.", "Notifications could not be turned on. Try again."))
  );
}

function PushCard() {
  const { t, locale } = useMobile();
  const c = useColors();
  const push = usePush();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fontFor("700") }}>{t("Notifikasi di HP ini", "Notifications on this phone")}</Text>
          <Text variant="caption">
            {t("Kabar pengantaran, pembayaran dan bantuan.", "Delivery, payment and help updates.")}
          </Text>
        </View>
        {push.on === null ? null : (
          <Text variant="label" style={{ color: push.on ? c.forest : c.muted }}>
            {push.on ? t("Aktif", "On") : t("Nonaktif", "Off")}
          </Text>
        )}
      </View>
      {error ? (
        <Text selectable style={{ color: c.danger }}>
          {error}
        </Text>
      ) : null}
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
              .catch((e: unknown) => setError(pushError(e, locale, t)))
              .finally(() => setBusy(false));
          }}
        />
      ) : null}
    </Card>
  );
}

function Updates() {
  const { runtime, command, t, locale } = useMobile();
  const c = useColors();
  const styles = useStyles();
  const customer = useData("notifications:customer", () => runtime.api.customer());
  const notes = customer.data?.notifications ?? [];

  async function open(n: Notice) {
    // Marking read is a courtesy; the update itself still opens if it fails.
    if (!n.read_at) await command("notification.read", { id: n.id }).catch(() => undefined);
    openLink(customerLink(n.href));
  }

  return (
    <Screen>
      <PushCard />
      {!customer.data ? (
        customer.error ? (
          <View style={{ gap: 8 }}>
            <Text selectable style={{ color: c.danger }}>
              {customer.error}
            </Text>
            <Button variant="secondary" label={t("Coba lagi", "Try again")} onPress={() => void customer.reload()} />
          </View>
        ) : (
          <ActivityIndicator color={c.forest} />
        )
      ) : notes.length ? (
        <View>
          {notes.map((n, i) => (
            <PressableRow
              key={n.id}
              accessibilityRole="button"
              onPress={() => void open(n)}
              style={[styles.row, i > 0 && styles.divider]}
            >
              <View style={[styles.dot, { backgroundColor: n.read_at ? "transparent" : c.forest }]} />
              <View style={{ flex: 1, gap: 2 }}>
                {!n.read_at ? <Text variant="label">{t("Baru", "New")}</Text> : null}
                <Text>{n.body}</Text>
                <Text variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
                  {`${longDay(jakartaDay(new Date(n.created_at)), locale)} · ${jakartaClock(n.created_at)}`}
                </Text>
              </View>
            </PressableRow>
          ))}
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          <Text variant="heading">{t("Belum ada kabar baru.", "No new updates yet.")}</Text>
          <Text style={{ color: c.muted }}>
            {t("Kabar makanan dan bantuan akan hadir di sini.", "Meal and support updates will appear here.")}
          </Text>
        </View>
      )}
    </Screen>
  );
}

const useStyles = themedStyles((c) => ({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.canvas },
  row: { minHeight: 52, flexDirection: "row", gap: 10, paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: c.line },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
}));
