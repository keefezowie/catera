import { useRef, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { addDays, jakartaDay, type Notice } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  FadeSwap,
  fontFor,
  PressableRow,
  ReadError,
  Screen,
  Text,
  themedStyles,
  useBusy,
  useColors,
  useToast,
} from "@catera/mobile-ui";
import { customerLink } from "../links";
import { longDay } from "../schedule/dates";
import { jakartaClock } from "../today/Plate";
import { SignInFirst } from "./SignInFirst";
import { EmptyArt } from "../discover/EmptyArt";
import { openLink } from "../nav";
import { usePullToRefresh } from "../refresh";
import { ListSkeleton } from "../skeletons";

/**
 * Notifikasi: the latest updates under Hari ini, Kemarin and Sebelumnya, each opening its screen. An unread update has a
 * dot and a bolder line. "Tandai semua dibaca" reads every unread one, a few at once, and shows only while one is unread.
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

const READS_AT_ONCE = 5;

/** Which heading an update sits under, by its Jakarta day. */
function dayGroup(n: Notice, today: string): DayGroup {
  const day = jakartaDay(new Date(n.created_at));
  return day === today ? "today" : day === addDays(today, -1) ? "yesterday" : "earlier";
}

function Updates() {
  const { runtime, command, invalidate, t, locale } = useMobile();
  const c = useColors();
  const styles = useStyles();
  const toast = useToast();
  const customer = useData("notifications:customer", () => runtime.api.customer());
  const pull = usePullToRefresh(customer.reload);
  // Updates read on this screen, so their dots go at once and do not wait for the refresh.
  const [readHere, setReadHere] = useState<ReadonlySet<string>>(new Set());
  const notes = customer.data?.notifications ?? [];
  const unread = (n: Notice) => !n.read_at && !readHere.has(n.id);
  const unreadNotes = notes.filter(unread);
  const markRead = (id: string) => setReadHere((now) => new Set(now).add(id));

  // A double tap on a row would push its screen twice. Only for a moment, so the row still opens after coming back.
  const lastOpen = useRef({ id: "", at: 0 });
  function open(n: Notice) {
    const at = Date.now();
    if (lastOpen.current.id === n.id && at - lastOpen.current.at < 1000) return;
    lastOpen.current = { id: n.id, at };
    // Marking read is a courtesy: the update opens at once, and never waits on it or minds if it fails.
    if (unread(n)) {
      markRead(n.id);
      void command("notification.read", { id: n.id }).catch(() => undefined);
    }
    openLink(customerLink(n.href));
  }

  // One pass at a time: a second tap while the reads run sends nothing. There is no bulk read, so unread updates are
  // read a few at once; a batch with a failure ends the pass and the refresh shows what is still unread. Each read is
  // sent quietly and the app reloads once for the whole pass (this screen with it), not once per update.
  const [marking, markAll] = useBusy(async () => {
    let sent = 0;
    let failed = false;
    for (let i = 0; i < unreadNotes.length && !failed; i += READS_AT_ONCE) {
      const batch = unreadNotes.slice(i, i + READS_AT_ONCE);
      const results = await Promise.allSettled(
        batch.map((n) => command("notification.read", { id: n.id }, { refresh: false }).then(() => markRead(n.id))),
      );
      sent += results.filter((r) => r.status === "fulfilled").length;
      failed = results.some((r) => r.status === "rejected");
    }
    // The rows that stayed unread keep their dots, and the action stays to try again.
    if (failed) toast.show({ message: t("Belum semua ditandai dibaca. Coba lagi.", "Not all marked as read. Try again."), tone: "error" });
    if (sent) invalidate();
    else await customer.reload();
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
    <Screen refreshControl={customer.data ? pull : undefined}>
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
                  const when =
                    group.key === "earlier" ? `${longDay(day, locale)} · ${jakartaClock(n.created_at)}` : jakartaClock(n.created_at);
                  return (
                    <PressableRow
                      key={n.id}
                      testID="notification-row"
                      accessibilityRole="button"
                      accessibilityLabel={`${fresh ? `${t("Belum dibaca", "Unread")}, ` : ""}${n.body}, ${when}`}
                      onPress={() => open(n)}
                      style={[styles.row, i > 0 && styles.divider]}
                    >
                      <View
                        testID={fresh ? "unread-dot" : undefined}
                        style={[styles.dot, { backgroundColor: fresh ? c.forest : "transparent" }]}
                      />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={fresh ? { fontFamily: fontFor("700") } : undefined}>{n.body}</Text>
                        <Text variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
                          {when}
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
            <View style={{ marginBottom: 6 }}>
              <EmptyArt name="empty-kentongan-lid" />
            </View>
            <Text variant="heading" style={{ textAlign: "center" }}>
              {t("Belum ada notifikasi baru.", "No new notifications yet.")}
            </Text>
            <Text style={{ color: c.muted, textAlign: "center" }}>
              {t("Info soal makananmu dan permintaan bantuan muncul di sini.", "Updates on your meals and help requests show up here.")}
            </Text>
            {/* The canvas way to the push switch: Pengaturan holds the notification toggle. */}
            <View style={{ paddingTop: 10 }}>
              <Button
                variant="secondary"
                label={t("Pengaturan notifikasi", "Notification settings")}
                onPress={() => router.push("/pengaturan" as never)}
              />
            </View>
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
