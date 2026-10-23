import { useState } from "react";
import { View } from "react-native";
import { addDays, jakartaDay, type Notice } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  FadeSwap,
  fontFor,
  PressableRow,
  ReadError,
  Screen,
  StateArt,
  Text,
  themedStyles,
  useBusy,
  useColors,
} from "@catera/mobile-ui";
import { customerLink } from "../links";
import { longDay } from "../schedule/dates";
import { jakartaClock } from "../today/Plate";
import { SignInFirst } from "./SignInFirst";
import { openLink } from "../nav";
import { ListSkeleton } from "../skeletons";

/**
 * Notifikasi: the latest updates under Hari ini, Kemarin and Sebelumnya, each opening its screen. An unread update has a
 * dot and a bolder line. "Tandai semua dibaca" reads every unread one, in order, and shows only while one is unread.
 * Push on this phone is Pengaturan's switch.
 */
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

type DayGroup = "today" | "yesterday" | "earlier";

/** Which heading an update sits under, by its Jakarta day. */
function dayGroup(n: Notice, today: string): DayGroup {
  const day = jakartaDay(new Date(n.created_at));
  return day === today ? "today" : day === addDays(today, -1) ? "yesterday" : "earlier";
}

function Updates() {
  const { runtime, command, t, locale } = useMobile();
  const c = useColors();
  const styles = useStyles();
  const customer = useData("notifications:customer", () => runtime.api.customer());
  // Updates read on this screen, so their dots go at once and do not wait for the refresh.
  const [readHere, setReadHere] = useState<ReadonlySet<string>>(new Set());
  const notes = customer.data?.notifications ?? [];
  const unread = (n: Notice) => !n.read_at && !readHere.has(n.id);
  const unreadNotes = notes.filter(unread);
  const markRead = (id: string) => setReadHere((now) => new Set(now).add(id));

  async function open(n: Notice) {
    // Marking read is a courtesy; the update itself still opens if it fails.
    if (unread(n)) {
      await command("notification.read", { id: n.id })
        .then(() => markRead(n.id))
        .catch(() => undefined);
    }
    openLink(customerLink(n.href));
  }

  // One pass at a time: a second tap while the reads run sends nothing. There is no bulk read, so each unread update is
  // read in order; a failure stops the pass and the refresh shows what is still unread.
  const [marking, markAll] = useBusy(async () => {
    try {
      for (const n of unreadNotes) {
        await command("notification.read", { id: n.id });
        markRead(n.id);
      }
    } catch {
      // The rows that stayed unread keep their dots.
    }
    await customer.reload();
  });

  const today = jakartaDay(new Date());
  const groups = [
    { key: "today" as const, title: t("Hari ini", "Today") },
    { key: "yesterday" as const, title: t("Kemarin", "Yesterday") },
    { key: "earlier" as const, title: t("Sebelumnya", "Earlier") },
  ]
    .map((g) => ({ ...g, notes: notes.filter((n) => dayGroup(n, today) === g.key) }))
    .filter((g) => g.notes.length > 0);

  return (
    <Screen>
      {/* The updates fade in from their skeleton as one block. */}
      <FadeSwap swapKey={customer.data ? "ready" : customer.error ? "error" : "loading"}>
        {!customer.data ? (
          customer.error ? (
            <ReadError art message={customer.error} onRetry={() => void customer.reload()} />
          ) : (
            <ListSkeleton rows={4} label={t("Memuat notifikasi", "Loading notifications")} />
          )
        ) : notes.length ? (
          <View style={{ gap: 16 }}>
            {unreadNotes.length ? (
              <Button
                variant="text"
                label={t("Tandai semua dibaca", "Mark all as read")}
                busy={marking}
                onPress={() => void markAll()}
                style={styles.markAll}
              />
            ) : null}
            {groups.map((group) => (
              <View key={group.key}>
                <Text variant="label" accessibilityRole="header">
                  {group.title}
                </Text>
                {group.notes.map((n, i) => {
                  const fresh = unread(n);
                  const day = jakartaDay(new Date(n.created_at));
                  return (
                    <PressableRow
                      key={n.id}
                      testID="notification-row"
                      accessibilityRole="button"
                      onPress={() => void open(n)}
                      style={[styles.row, i > 0 && styles.divider]}
                    >
                      <View
                        testID={fresh ? "unread-dot" : undefined}
                        style={[styles.dot, { backgroundColor: fresh ? c.forest : "transparent" }]}
                      />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={fresh ? { fontFamily: fontFor("700") } : undefined}>{n.body}</Text>
                        <Text variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
                          {group.key === "earlier"
                            ? `${longDay(day, locale)} · ${jakartaClock(n.created_at)}`
                            : jakartaClock(n.created_at)}
                        </Text>
                      </View>
                    </PressableRow>
                  );
                })}
              </View>
            ))}
          </View>
        ) : (
          <View style={{ gap: 6 }}>
            <StateArt pose="tidur" style={{ marginBottom: 6 }} />
            <Text variant="heading" style={{ textAlign: "center" }}>
              {t("Belum ada kabar baru.", "No new updates yet.")}
            </Text>
            <Text style={{ color: c.muted, textAlign: "center" }}>
              {t("Kabar soal makananmu dan permintaan bantuan muncul di sini.", "Updates on your meals and help requests show up here.")}
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
  markAll: { alignSelf: "flex-end" },
}));
