import { PackageContents } from "./package-contents";
import type { Offer } from "@catera/domain";
import { useState } from "react";
import { View, Image } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { currency, mealLabel, price } from "@catera/domain";
import { useNative, nativeApi, useData } from "./context";
import { nativeReturnPath, nativeSignInPath } from "./auth";
import {
  Screen,
  Txt,
  Btn,
  Run,
  Field,
  Panel,
  Photo,
  Select,
  LanguageSelect,
  Qty,
  Facts,
  Empty,
  styles,
} from "./ui";
export function Comparison() {
  const { offers, compare, t, locale } = useNative();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const resolved = useData<{ offers: Offer[] }>(
    "comparison:" + compare.join(","),
    async () => ({
      offers: (
        await Promise.all(compare.map((id) => nativeApi.offer(id)))
      ).flatMap((item) => (item.offer ? [item.offer] : [])),
    }),
  );
  const selected =
    resolved.data?.offers ||
    offers.filter((offer) => compare.includes(offer.id));
  const [qty, setQty] = useState(1);
  return (
    <Screen title={t("Pilih yang paling pas.", "Find your best fit.")}>
      {next && (
        <Btn
          secondary
          label={t("Kembali ke paket", "Back to packages")}
          onPress={() => router.replace(nativeReturnPath(next) as never)}
        />
      )}
      {resolved.error && (
        <>
          <Txt style={styles.error}>{resolved.error}</Txt>
          <Btn
            secondary
            label={t("Coba lagi", "Retry")}
            onPress={resolved.reload}
          />
        </>
      )}
      <Txt>
        {t(
          "Jumlah porsi sama untuk setiap paket.",
          "The same portion quantity applies to every package.",
        )}
      </Txt>
      <Qty value={qty} onChange={setQty} />
      {selected.map((o) => (
        <Panel key={o.id}>
          <Photo src={o.image} height={150} />
          <Txt kind="heading">{o.name}</Txt>
          <PackageContents offer={o} />
          <Txt kind="small">{o.caterer}</Txt>
          <Facts
            rows={[
              [
                t("Total paket", "Package total"),
                currency(price(o, qty).total, locale),
              ],
              [
                t("Per porsi / hari", "Per portion / day"),
                currency(price(o, qty).total / o.days / qty, locale),
              ],
              [
                t("Jumlah makanan", "Meal count"),
                o.days * (o.meal === "both" ? 2 : 1) +
                  " " +
                  t("kali makan per porsi", "meals per portion"),
              ],
              [t("Durasi", "Duration"), o.days + " " + t("hari", "days")],
              [t("Waktu makan", "Meal time"), mealLabel(o.meal, locale)],
              [
                t("Jadwal", "Schedule"),
                o.flexible ? t("Fleksibel", "Flexible") : t("Tetap", "Fixed"),
              ],
              [
                t("Trial", "Trial"),
                o.trialPrice
                  ? currency(o.trialPrice * qty, locale)
                  : t("Tidak tersedia", "Unavailable"),
              ],
              [t("Pengantaran", "Delivery"), t("Termasuk", "Included")],
            ]}
          />
          <Btn
            label={t("Lihat paket", "View package")}
            onPress={() => router.push(("/package/" + o.id) as never)}
          />
        </Panel>
      ))}
      {!compare.length && (
        <Empty
          title={t(
            "Pilih hingga tiga paket dari Jelajah.",
            "Choose up to three packages from Discover.",
          )}
        />
      )}
    </Screen>
  );
}
export function LoginScreen() {
  const { demo, demoLogin, login, passwordLogin, t } = useNative();
  const p = useLocalSearchParams<{ next?: string }>();
  const [phone, setPhone] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [token, setToken] = useState(""),
    [name, setName] = useState(""),
    [sent, setSent] = useState(false),
    [method, setMethod] = useState<"email" | "phone">("email");
  const next = nativeReturnPath(p.next);
  return (
    <Screen
      title={t(
        "Hari yang baik, dimulai dari makan.",
        "A good day starts with a good meal.",
      )}
    >
      <LanguageSelect />
      <Image
        source={require("../../../packages/brand/assets/welcome.png")}
        style={{ width: 220, height: 200, alignSelf: "center" }}
        resizeMode="contain"
      />
      {demo ? (
        <Run
          label={t(
            "Jelajah sebagai pelanggan demo",
            "Explore as a demo customer",
          )}
          successMessage=""
          action={async () => {
            await demoLogin();
            router.replace(next as never);
          }}
        />
      ) : (
        <>
          <Select
            label={t("Metode masuk", "Sign-in method")}
            value={method}
            onChange={(v) => setMethod(v as "email" | "phone")}
            options={[
              {
                label: t("Email & kata sandi", "Email & password"),
                value: "email",
              },
              { label: t("Kode ponsel", "Phone code"), value: "phone" },
            ]}
          />
          {method === "email" ? (
            <>
              <Field
                label={t("Email", "Email")}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={254}
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
                placeholder={t("nama@contoh.com", "name@example.com")}
              />
              <Field
                label={t("Kata sandi", "Password")}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={256}
                value={password}
                onChangeText={setPassword}
                autoComplete="password"
              />
              <Run
                label={t("Masuk", "Sign in")}
                successMessage=""
                action={async () => {
                  const actor = await passwordLogin(email, password);
                  router.replace(nativeSignInPath(actor, next) as never);
                }}
              />
              <Btn
                secondary
                label={t("Lupa kata sandi?", "Forgot password?")}
                onPress={() =>
                  router.push({
                    pathname: "/recover" as never,
                    params: { next },
                  })
                }
              />
              <Btn
                secondary
                label={t(
                  "Buat akun / verifikasi email",
                  "Create account / verify email",
                )}
                onPress={() =>
                  router.push({
                    pathname: "/register" as never,
                    params: { next },
                  })
                }
              />
            </>
          ) : (
            <>
              <Field
                label={t("Nomor ponsel", "Phone number")}
                keyboardType="phone-pad"
                autoComplete="tel"
                value={phone}
                onChangeText={setPhone}
                placeholder="+6281234567890"
                editable={!sent}
              />
              {sent && (
                <>
                  <Field
                    label={t("Kode OTP", "Verification code")}
                    value={token}
                    onChangeText={setToken}
                    keyboardType="number-pad"
                    autoComplete="sms-otp"
                    maxLength={6}
                  />
                  <Field
                    label={t("Nama", "Name")}
                    value={name}
                    onChangeText={setName}
                    autoComplete="name"
                  />
                </>
              )}
              <Run
                key={sent ? "verify" : "send"}
                label={
                  sent
                    ? t("Verifikasi & masuk", "Verify & sign in")
                    : t("Kirim kode OTP", "Send verification code")
                }
                successMessage=""
                action={async () => {
                  if (!sent) {
                    await nativeApi.request("auth/send", { phone });
                    setSent(true);
                  } else {
                    const actor = await login(phone, token, name);
                    router.replace(nativeSignInPath(actor, next) as never);
                  }
                }}
              />
              {sent && (
                <Btn
                  secondary
                  label={t(
                    "Ubah nomor / kirim ulang",
                    "Change number / resend",
                  )}
                  onPress={() => {
                    setSent(false);
                    setToken("");
                  }}
                />
              )}
            </>
          )}
        </>
      )}
    </Screen>
  );
}
