import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import {
  errorLabel,
  renewalDue,
  todayPlates,
  upcomingRows,
  type CustomerState,
  type Subscription,
} from "@catera/domain";
import { useData, useMobile, type MobileRuntime } from "@catera/mobile-core";
import { Button, colors, Field, FONT, Screen, Text } from "@catera/mobile-ui";
import { ChatKatering } from "../help/ChatKatering";
import { EmptyHome } from "./EmptyHome";
import { jakartaClock, Plate } from "./Plate";
import { RenewalCard } from "./RenewalCard";
import { UpcomingRows } from "./UpcomingRows";
import { loadCachedCustomer, saveCachedCustomer } from "./offline";

type LoadedCustomer = { data: CustomerState; savedAt: string | null };

async function loadCustomer(runtime: MobileRuntime, key: string): Promise<LoadedCustomer> {
  try {
    const data = await runtime.api.customer();
    await saveCachedCustomer(key, { savedAt: new Date().toISOString(), data });
    return { data, savedAt: null };
  } catch (e) {
    const cached = await loadCachedCustomer(key);
    if (cached) return { data: cached.data, savedAt: cached.savedAt };
    throw e;
  }
}

/** Subscriptions that still serve days: the package line and renewal card are about these. */
const isLive = (s: Subscription) => s.status === "active";

/** Asked once, when 3 or fewer days remain or after the final delivery (review.save needs one delivered day). */
function reviewCandidate(state: CustomerState): Subscription | undefined {
  return state.subscriptions.find(
    (s) =>
      s.status !== "cancelled" &&
      s.remaining <= 3 &&
      state.deliveries.some((d) => d.subscription_id === s.id && d.status === "delivered"),
  );
}

function greeting(t: (id: string, en: string) => string, now: Date) {
  const hour = (now.getUTCHours() + 7) % 24;
  if (hour < 11) return t("Selamat pagi", "Good morning");
  if (hour < 15) return t("Selamat siang", "Good afternoon");
  if (hour < 18) return t("Selamat sore", "Good afternoon");
  return t("Selamat malam", "Good evening");
}

/** Beranda: today's plate, the next days, renewal and the package line. */
export function Beranda() {
  const { actor, ready } = useMobile();
  if (!ready)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  if (!actor) return <EmptyHome />;
  return <SignedInHome actorId={actor.id} name={actor.name} />;
}

function SignedInHome({ actorId, name }: { actorId: string; name: string }) {
  const { runtime, t } = useMobile();
  const home = useData(`home:customer`, () => loadCustomer(runtime, actorId));
  const state = home.data?.data;
  const now = new Date();

  if (!state)
    return home.loading ? (
      <View style={styles.center}>
        <ActivityIndicator color={colors.forest} />
      </View>
    ) : (
      <Screen>
        <Text variant="title">Beranda</Text>
        <Text>{home.error}</Text>
        <Button label={t("Coba lagi", "Try again")} onPress={() => void home.reload()} />
      </Screen>
    );

  const plates = todayPlates(state, now);
  const rows = upcomingRows(state, now, 3);
  const live = state.subscriptions.filter(isLive);
  if (!plates.length && !rows.length && !live.length) return <EmptyHome />;
  const savedAt = home.data?.savedAt;
  const firstName = name.trim().split(/\s+/)[0] ?? "";

  return (
    <Screen>
      <View style={{ gap: 2 }}>
        <Text variant="caption">{greeting(t, now)}{firstName ? `, ${firstName}` : ""}</Text>
        <Text variant="title">{t("Hari ini", "Today")}</Text>
      </View>
      {savedAt ? (
        <Text variant="caption" style={{ color: colors.sunriseInk, fontVariant: ["tabular-nums"] }}>
          {t("Terakhir diperbarui", "Last updated")} {jakartaClock(savedAt)} ·{" "}
          {t("tidak ada koneksi", "no connection")}
        </Text>
      ) : home.error ? (
        <Text variant="caption" style={{ color: colors.danger }}>
          {home.error}
        </Text>
      ) : null}
      {plates.map((p) => (
        <Plate key={`${p.deliveryId}:${p.meal}`} plate={p} apiBase={runtime.apiBase} offline={!!savedAt} />
      ))}
      {!plates.length ? (
        <Text style={{ color: colors.muted }}>{t("Tidak ada pengantaran hari ini.", "No delivery today.")}</Text>
      ) : null}
      <UpcomingRows rows={rows} />
      {live.filter(renewalDue).map((s) => (
        <RenewalCard key={s.id} subscription={s} />
      ))}
      {live.map((s) => (
        <PackageLine
          key={s.id}
          subscription={s}
          phone={state.deliveries.find((d) => d.subscription_id === s.id && d.catererPhone)?.catererPhone ?? ""}
        />
      ))}
      {savedAt ? null : <ReviewPrompt state={state} />}
    </Screen>
  );
}

function PackageLine({ subscription: s, phone }: { subscription: Subscription; phone: string }) {
  const { t } = useMobile();
  const offer = s.snapshot.offer;
  return (
    <View style={styles.packageLine}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontWeight: "700" }}>{offer.name}</Text>
        <Text variant="caption">
          {offer.caterer} · {t(`${s.remaining} hari lagi`, `${s.remaining} days to go`)}
        </Text>
      </View>
      <ChatKatering phone={phone} variant="text" />
    </View>
  );
}

function ReviewPrompt({ state }: { state: CustomerState }) {
  const { runtime, command, t, locale } = useMobile();
  const candidate = reviewCandidate(state);
  const id = candidate?.id;
  const key = id ? runtime.storageKey(`review.${id}`) : "";
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!key) return;
    let live = true;
    void SecureStore.getItemAsync(key)
      .catch(() => null)
      .then((v) => {
        if (!live) return;
        setChecked((c) => ({ ...c, [key]: true }));
        if (v) setHidden((h) => ({ ...h, [key]: true }));
      });
    return () => {
      live = false;
    };
  }, [key]);

  if (!candidate || !checked[key] || hidden[key]) return null;
  const caterer = candidate.snapshot.offer.caterer;

  function hide(value: "dismissed" | "done") {
    setHidden((h) => ({ ...h, [key]: true }));
    void SecureStore.setItemAsync(key, value).catch(() => undefined);
  }

  async function send() {
    setBusy(true);
    setError("");
    try {
      await command("review.save", {
        subscriptionId: candidate!.id,
        rating,
        food: rating,
        delivery: rating,
        value: rating,
        body,
      });
      hide("done");
    } catch (e) {
      const code = (e as { code?: string }).code || (e as Error).message;
      setError(errorLabel(code, locale) || t("Belum berhasil. Coba lagi.", "That didn't work. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.review}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setOpen((o) => !o)}
          style={{ flex: 1, minHeight: 48, justifyContent: "center" }}
        >
          <Text style={{ fontWeight: "700" }}>
            {t(`Bagaimana ${caterer} selama ini?`, `How has ${caterer} been so far?`)}
          </Text>
        </Pressable>
        <Button variant="text" label={t("Nanti saja", "Not now")} onPress={() => hide("dismissed")} />
      </View>
      {open ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                accessibilityRole="button"
                accessibilityLabel={t(`${n} bintang`, `${n} stars`)}
                accessibilityState={{ selected: n <= rating }}
                onPress={() => setRating(n)}
                style={styles.star}
              >
                <Text style={{ fontFamily: FONT, fontSize: 24, color: n <= rating ? colors.forest : "#CFD3C6" }}>★</Text>
              </Pressable>
            ))}
          </View>
          <Field
            label={t("Cerita singkat (opsional)", "A few words (optional)")}
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={1000}
          />
          {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
          <Button label={t("Kirim ulasan", "Send review")} disabled={busy} onPress={() => void send()} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
  packageLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  review: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  star: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
