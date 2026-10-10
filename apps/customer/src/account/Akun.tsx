import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";
import type { Locale } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  MoodHeader,
  Screen,
  Segmented,
  Text,
  themedStyles,
  useColors,
  useMoodColors,
  useThemePreference,
  type ThemePreference,
} from "@catera/mobile-ui";
import { failureText } from "./failure";
import { usePush } from "./push";
import { Row, SectionLabel } from "./Row";
import { SignInFirst } from "./SignInFirst";
import { remainingLabel } from "../remaining";
import { planHref } from "../hrefs";
import { goToTab } from "../nav";

/** "6281234567890" (as Supabase keeps it) → "0812-3456-7890". */
export function localPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("62")) digits = "0" + digits.slice(2);
  return [digits.slice(0, 4), digits.slice(4, 8), digits.slice(8)].filter(Boolean).join("-");
}

/** Akun: who is signed in, active packages and the account screens. No caterer or admin links. */
export function Akun() {
  const { actor, ready, t } = useMobile();
  const c = useColors();
  const styles = useStyles();
  if (!ready)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.forest} />
      </View>
    );
  if (!actor)
    return (
      <SignInFirst title={t("Akun", "Account")} next="/akun" headerTestID="akun-header">
        <Language />
        <Appearance />
      </SignInFirst>
    );
  return <Account key={actor.id} />;
}

function Language() {
  const { locale, setLocale, t } = useMobile();
  return (
    <View style={{ gap: 8 }}>
      <SectionLabel>{t("Bahasa", "Language")}</SectionLabel>
      <Segmented<Locale>
        options={[
          { value: "id", label: "Indonesia" },
          { value: "en", label: "English" },
        ]}
        value={locale}
        onChange={setLocale}
      />
    </View>
  );
}

/** System follows the phone's own light or dark setting; the other two are the user's explicit choice. */
function Appearance() {
  const { t } = useMobile();
  const { preference, setPreference } = useThemePreference();
  return (
    <View style={{ gap: 8 }}>
      <SectionLabel>{t("Tampilan", "Appearance")}</SectionLabel>
      <Segmented<ThemePreference>
        options={[
          { value: "system", label: t("Sistem", "System") },
          { value: "light", label: t("Terang", "Light") },
          { value: "dark", label: t("Gelap", "Dark") },
        ]}
        value={preference}
        onChange={setPreference}
      />
    </View>
  );
}

/** The signed-in phone number (or email) from the device's own session. */
function useContact() {
  const { runtime } = useMobile();
  const [contact, setContact] = useState("");
  useEffect(() => {
    let live = true;
    void runtime.supabase?.auth
      .getSession()
      .then(({ data }) => {
        const user = data.session?.user;
        if (live) setContact(user?.phone ? localPhone(user.phone) : (user?.email ?? ""));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [runtime]);
  return contact;
}

function Account() {
  const { actor, runtime, logout, t, locale } = useMobile();
  const c = useColors();
  const mood = useMoodColors();
  const customer = useData("akun:customer", () => runtime.api.customer());
  const contact = useContact();
  const push = usePush();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = (customer.data?.subscriptions ?? []).filter((s) => s.status === "active");

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await logout();
      goToTab("index");
    } catch (e) {
      setError(failureText(e, locale, t));
      setBusy(false);
    }
  }

  return (
    <Screen
      header={
        // The tab bar already names this tab, so the meta row stays empty rather than repeating "Akun".
        <MoodHeader testID="akun-header" title={actor?.name ?? ""}>
          {contact ? <Text style={{ color: mood.headerMeta, fontVariant: ["tabular-nums"] }}>{contact}</Text> : null}
        </MoodHeader>
      }
    >
      <View>
        <SectionLabel>{t("Paket aktif", "Active packages")}</SectionLabel>
        {customer.loading && !customer.data ? (
          <ActivityIndicator color={c.forest} style={{ alignSelf: "flex-start", marginTop: 8 }} />
        ) : customer.error && !customer.data ? (
          <View style={{ gap: 8, marginTop: 6 }}>
            <Text selectable style={{ color: c.danger }}>
              {customer.error}
            </Text>
            <Button variant="secondary" label={t("Coba lagi", "Try again")} onPress={() => void customer.reload()} />
          </View>
        ) : active.length ? (
          active.map((s, i) => (
            <Row
              key={s.id}
              first={i === 0}
              label={s.snapshot.offer.name}
              caption={`${s.snapshot.offer.caterer} · ${remainingLabel(s.remaining, t)}`}
              onPress={() => router.push(planHref(s.id, s.snapshot.offer.name) as never)}
            />
          ))
        ) : (
          <Text style={{ color: c.muted, marginTop: 6 }}>{t("Belum ada paket aktif.", "No active packages.")}</Text>
        )}
      </View>

      <View>
        <Row first label={t("Alamat", "Addresses")} onPress={() => router.push("/alamat" as never)} />
        <Row label={t("Disimpan", "Saved")} onPress={() => router.push("/disimpan" as never)} />
        <Row label={t("Riwayat pembayaran", "Payment history")} onPress={() => router.push("/pembayaran" as never)} />
        <Row label={t("Bantuan dan laporan", "Help and reports")} onPress={() => router.push("/bantuan" as never)} />
        <Row
          label={t("Notifikasi", "Notifications")}
          value={push.on === null ? undefined : push.on ? t("Aktif", "On") : t("Nonaktif", "Off")}
          onPress={() => router.push("/notifications" as never)}
        />
      </View>

      <Language />
      <Appearance />

      {error ? (
        <Text selectable style={{ color: c.danger }}>
          {error}
        </Text>
      ) : null}
      <Button variant="secondary" label={t("Keluar", "Sign out")} disabled={busy} onPress={() => void signOut()} />
    </Screen>
  );
}

const useStyles = themedStyles((c) => ({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.canvas },
}));
