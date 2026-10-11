import { View } from "react-native";
import { jakartaDay, type Notice } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, FadeSwap, PressableRow, Screen, StateArt, Text, themedStyles, useColors } from "@catera/mobile-ui";
import { customerLink } from "../links";
import { longDay } from "../schedule/dates";
import { jakartaClock } from "../today/Plate";
import { SignInFirst } from "./SignInFirst";
import { openLink } from "../nav";
import { ListSkeleton } from "../skeletons";

/** Notifikasi: the latest updates, each opening its screen. Push on this phone is Pengaturan's switch. */
export function NotificationsScreen() {
  const { actor, ready, t } = useMobile();
  if (!ready)
    return (
      <Screen>
        <ListSkeleton rows={4} label={t("Memuat notifikasi", "Loading notifications")} />
      </Screen>
    );
  if (!actor) return <SignInFirst title={t("Notifikasi", "Notifications")} next="/notifications" />;
  return <Updates key={actor.id} />;
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
      {/* The updates fade in from their skeleton as one block. */}
      <FadeSwap swapKey={customer.data ? "ready" : customer.error ? "error" : "loading"}>
        {!customer.data ? (
          customer.error ? (
            <View style={{ gap: 8 }}>
              <StateArt pose="bingung" style={{ marginBottom: 4 }} />
              <Text selectable style={{ color: c.danger, textAlign: "center" }}>
                {customer.error}
              </Text>
              <Button variant="secondary" label={t("Coba lagi", "Try again")} onPress={() => void customer.reload()} />
            </View>
          ) : (
            <ListSkeleton rows={4} label={t("Memuat notifikasi", "Loading notifications")} />
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
            <StateArt pose="tidur" style={{ marginBottom: 6 }} />
            <Text variant="heading" style={{ textAlign: "center" }}>
              {t("Belum ada kabar baru.", "No new updates yet.")}
            </Text>
            <Text style={{ color: c.muted, textAlign: "center" }}>
              {t("Kabar makanan dan bantuan akan hadir di sini.", "Meal and support updates will appear here.")}
            </Text>
          </View>
        )}
      </FadeSwap>
    </Screen>
  );
}

const useStyles = themedStyles((c) => ({
  row: { minHeight: 52, flexDirection: "row", gap: 10, paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: c.line },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
}));
