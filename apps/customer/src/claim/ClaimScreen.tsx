import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Crypto from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { errorLabel, localCustomerPhone, phoneMatchesMask, shortDate, type ClaimPreview } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { Button, Card, colors, Field, Screen, Text } from "@catera/mobile-ui";
import { e164Indonesia } from "../account/Masuk";

/** Failures worth retrying; every other code means this link cannot be used. */
const TRANSIENT = ["REQUEST_TIMEOUT", "REQUEST_FAILED", "INVALID_API_RESPONSE", "AUTH_RATE_LIMITED", "RATE_LIMITED", "NOT_CONFIGURED"];
const codeOf = (e: unknown) => (e as { code?: string }).code || (e as Error).message || "";
const transient = (e: unknown) => {
  const code = codeOf(e);
  return !(e as { code?: string }).code || TRANSIENT.includes(code);
};

type Step = "lihat" | "nomor" | "kode";

/** A caterer's claim link: the package first, then the SMS code, then Beranda. */
export function ClaimScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { runtime, command, signedIn, t, locale } = useMobile();
  const [preview, setPreview] = useState<ClaimPreview | null>(null);
  const [dead, setDead] = useState(false);
  const [offline, setOffline] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [step, setStep] = useState<Step>("lihat");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState(false);
  // A used SMS code cannot be verified twice: a retry after a dropped claim goes straight to it.
  const verified = useRef("");

  // Read once per token: after a claim the same token answers NOT_FOUND.
  useEffect(() => {
    let live = true;
    setOffline(false);
    runtime.api
      .claimPreview(String(token ?? ""))
      .then((p) => live && setPreview(p))
      .catch((e) => {
        if (!live) return;
        if (transient(e)) setOffline(true);
        else setDead(true);
      });
    return () => {
      live = false;
    };
  }, [runtime, token, attempt]);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      const c = codeOf(e);
      setError(
        c === "INVALID_OTP"
          ? t("Kode belum cocok. Periksa SMS lalu coba lagi.", "That code doesn't match. Check the SMS and try again.")
          : errorLabel(c, locale) || t("Belum berhasil. Coba lagi.", "That didn't work. Try again."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    const number = e164Indonesia(phone);
    if (verified.current !== number) {
      const actor = await runtime.verifyPhoneOtp(number, code.trim(), name.trim(), Crypto.randomUUID());
      verified.current = number;
      await signedIn(actor);
    }
    let result: { status?: string };
    try {
      result = await command<{ status?: string }>("customer.claim", { token: String(token) });
    } catch (e) {
      if (transient(e)) throw e;
      setDead(true);
      return;
    }
    if (result.status === "review") setReview(true);
    else router.replace("/" as never);
  }

  // A link can open the app cold with no screen behind this one (and no header): always
  // leave a way into the app.
  const home = (
    <Button variant="secondary" label={t("Ke Beranda", "Go to Home")} onPress={() => router.replace("/" as never)} />
  );
  if (dead)
    return (
      <Screen>
        <Header />
        <Text style={{ fontWeight: "700" }} testID="claim-dead">
          {t(
            "Tautan ini tidak bisa dipakai. Minta tautan baru ke katering Anda.",
            "This link can't be used. Ask your caterer for a new one.",
          )}
        </Text>
        {home}
      </Screen>
    );
  if (offline)
    return (
      <Screen>
        <Header />
        <Text>{t("Belum bisa memuat. Periksa koneksi lalu coba lagi.", "Couldn't load. Check your connection and try again.")}</Text>
        <Button label={t("Coba lagi", "Try again")} onPress={() => setAttempt((n) => n + 1)} />
        {home}
      </Screen>
    );
  if (!preview)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  const katering = preview.catererName;
  if (review)
    return (
      <Screen>
        <Header />
        <Text variant="title">{t("Perlu dicek dulu", "Needs a check first")}</Text>
        <Text>
          {t(
            `${katering} perlu memeriksa langganan ini dulu. Pengantaran Anda tetap berjalan.`,
            `${katering} needs to check this subscription first. Your deliveries continue.`,
          )}
        </Text>
        <Button label={t("Ke Beranda", "Go to Home")} onPress={() => router.replace("/" as never)} />
      </Screen>
    );

  if (step === "lihat")
    return (
      <Screen
        footer={
          <View style={{ gap: 10 }}>
            <Button
              label={t(`Lanjut dengan ${preview.maskedPhone}`, `Continue with ${preview.maskedPhone}`)}
              onPress={() => setStep("nomor")}
            />
            <Text variant="caption" style={{ textAlign: "center" }}>
              {t(
                `Bukan nomor Anda? Minta ${katering} mengirim tautan baru.`,
                `Not your number? Ask ${katering} to send a new link.`,
              )}
            </Text>
          </View>
        }
      >
        <Header />
        <View style={{ gap: 8 }}>
          <Text style={styles.from}>{t(`Dari ${katering}`, `From ${katering}`)}</Text>
          <Text style={styles.h1}>{t("Langganan Anda sekarang ada di Catera", "Your subscription is now on Catera")}</Text>
          <Text>
            {t(
              `Sudah dibayar ke ${katering}, tidak ada tagihan baru. Di sini Anda bisa melihat menu, tahu kapan makanan berangkat, dan memindah hari.`,
              `Already paid to ${katering}, no new bill. Here you can see the menu, know when your food leaves, and move days.`,
            )}
          </Text>
        </View>
        <Card>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.forest }}>{preview.packageName}</Text>
          <Fact label={t("Sisa", "Left")} value={t(`${preview.remainingDays} hari`, `${preview.remainingDays} days`)} />
          {preview.nextDate ? (
            <Fact
              label={t("Berikutnya", "Next")}
              value={shortDate(preview.nextDate, locale) + (preview.nextWindow ? `, ${preview.nextWindow}` : "")}
            />
          ) : null}
          <Fact label={t("Alamat", "Address")} value={preview.addressLabel} />
        </Card>
      </Screen>
    );

  const sent = step === "kode";
  return (
    <Screen>
      <Header
        onBack={() => {
          setStep(sent ? "nomor" : "lihat");
          setCode("");
          setError("");
        }}
      />
      <View style={{ gap: 8 }}>
        <Text style={styles.h1}>
          {sent ? t("Masukkan kode dari SMS", "Enter the code from the SMS") : t("Nomor HP Anda", "Your phone number")}
        </Text>
        <Text>
          {sent
            ? t(
                `Kami kirim 6 angka ke ${localCustomerPhone(e164Indonesia(phone))}, nomor yang dicatat ${katering}.`,
                `We sent 6 digits to ${localCustomerPhone(e164Indonesia(phone))}, the number ${katering} recorded.`,
              )
            : t(
                `Tulis nomor yang dicatat ${katering} (${preview.maskedPhone}). Kami kirim kode lewat SMS.`,
                `Enter the number ${katering} recorded (${preview.maskedPhone}). We'll text you a code.`,
              )}
        </Text>
      </View>
      {!sent ? (
        <>
          <Field
            label={t("Nomor HP", "Phone number")}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder="0812…"
            autoFocus
          />
          <Button
            label={t("Kirim kode", "Send code")}
            disabled={busy || phone.replace(/\D/g, "").length < 9}
            onPress={() =>
              run(async () => {
                const number = e164Indonesia(phone);
                // Another number could never claim this link: say so before any SMS.
                if (!phoneMatchesMask(number, preview.maskedPhone)) {
                  setError(
                    t(
                      `Nomor ini berbeda dengan yang dicatat ${katering}. Pakai nomor yang Anda berikan ke ${katering}, atau minta ${katering} memperbarui nomor Anda.`,
                      `This number differs from the one ${katering} has. Use the number you gave ${katering}, or ask ${katering} to update it.`,
                    ),
                  );
                  return;
                }
                await runtime.sendPhoneOtp(number);
                setStep("kode");
              })
            }
          />
        </>
      ) : (
        <>
          <Field
            label={t("Kode", "Code")}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="sms-otp"
            maxLength={6}
            autoFocus
          />
          <Field
            label={t("Nama Anda", "Your name")}
            value={name}
            onChangeText={setName}
            autoComplete="name"
            maxLength={100}
          />
          <Button
            label={t("Sambungkan langganan", "Connect subscription")}
            disabled={busy || code.trim().length < 6 || !name.trim()}
            onPress={() => run(connect)}
          />
          <Text variant="caption" style={{ textAlign: "center" }}>
            {t(
              "Dengan melanjutkan, Anda setuju dengan Ketentuan dan Kebijakan Privasi Catera.",
              "By continuing, you agree to Catera's Terms and Privacy Policy.",
            )}
          </Text>
        </>
      )}
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
    </Screen>
  );
}

function Header({ onBack }: { onBack?: () => void }) {
  const { t } = useMobile();
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t("Kembali", "Back")} onPress={onBack} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.forest} />
        </Pressable>
      ) : null}
      <Image
        source={require("../../../../packages/brand/assets/wordmark.png")}
        accessibilityLabel="Catera"
        style={{ height: 24, width: 72 }}
        resizeMode="contain"
      />
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 16 }}>
      <Text style={{ color: colors.muted, width: 84, fontSize: 14 }}>{label}</Text>
      <Text style={{ flex: 1, fontWeight: "700", fontSize: 14 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
  header: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4 },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  from: { fontSize: 14, fontWeight: "700", color: colors.sunriseInk },
  h1: { fontSize: 28, lineHeight: 32, fontWeight: "800", letterSpacing: -0.5, color: colors.forest },
});
