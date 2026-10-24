import { useRef, useState } from "react";
import { View } from "react-native";
import * as Crypto from "expo-crypto";
import { nativeLayout } from "@catera/design-tokens";
import { areaOptions } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { AuthScreen, Button, Chip, Field, fontFor, FormError, Text, useColors } from "@catera/mobile-ui";
import { goToTab } from "../nav";
import { catererSlug, e164Indonesia } from "../onboarding";
import { useFormRun } from "../useFormRun";

/** Sign-up: business name, WhatsApp number (verified by SMS) and kitchen area. */
export function Daftar() {
  const { runtime, t, locale, signedIn, command } = useMobile();
  const c = useColors();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const { busy, failure, run } = useFormRun(
    locale,
    t("Belum bisa mendaftar. Periksa datanya, lalu coba lagi.", "Could not register. Check the details and try again."),
  );
  // A retry after a failed seller.create reuses the verified actor, the verify requestId and the slug suffix.
  const verified = useRef<Awaited<ReturnType<typeof runtime.verifyPhoneOtp>> | null>(null);
  const verifyId = useRef(Crypto.randomUUID());
  const slugSuffix = useRef(Crypto.randomUUID().replace(/-/g, "").slice(0, 4));
  const [kept, setKept] = useState(false);
  const ready = name.trim().length >= 3 && phone.replace(/\D/g, "").length >= 9 && !!area;

  const sendCode = () =>
    run(async () => {
      await runtime.sendPhoneOtp(e164Indonesia(phone));
      setSent(true);
    });

  // The old number's session is dropped first, or a refresh could sign into its half-registered profile.
  const changeNumber = () =>
    run(async () => {
      if (verified.current) await runtime.signOut();
      setSent(false);
      setCode("");
      setKept(false);
      verified.current = null;
      verifyId.current = Crypto.randomUUID();
      slugSuffix.current = Crypto.randomUUID().replace(/-/g, "").slice(0, 4);
    });

  const missing = [
    name.trim().length < 3 ? t("nama usaha (minimal 3 huruf)", "business name (at least 3 letters)") : "",
    phone.replace(/[^0-9]/g, "").length < 9 ? t("nomor WhatsApp", "WhatsApp number") : "",
    !area ? t("lokasi dapur", "kitchen area") : "",
  ].filter(Boolean);

  const reason = t(`Lengkapi ${missing.join(", ")} dulu.`, `Fill in the ${missing.join(", ")} first.`);

  const create = () =>
    run(async () => {
      verified.current ??= await runtime.verifyPhoneOtp(e164Indonesia(phone), code.trim(), name.trim(), verifyId.current);
      const actor = verified.current;
      setKept(true);
      await command("seller.create", {
        name: name.trim(),
        slug: catererSlug(name, slugSuffix.current),
        description: "",
        areas: [area],
      });
      await signedIn(actor);
      goToTab("index");
    });

  return (
    <AuthScreen
      revealKey={failure?.key}
      footer={
        sent ? (
          <Button
            label={t("Buat dapur saya", "Create my kitchen")}
            busy={busy}
            disabled={!kept && code.trim().length < 6}
            onPress={create}
          />
        ) : (
          <>
            <Button
              label={t("Kirim kode", "Send code")}
              busy={busy}
              disabled={!ready}
              accessibilityHint={ready ? undefined : reason}
              onPress={sendCode}
            />
            <View style={{ minHeight: 18 }}>
              {!ready ? (
                <Text testID="daftar-reason" variant="meta">
                  {reason}
                </Text>
              ) : null}
            </View>
          </>
        )
      }
    >
      <View style={{ gap: nativeLayout.groupGap }}>
        <Text variant="title">{t("Kelola katering dari satu HP", "Run your catering from one phone")}</Text>
        <Text variant="bodyL" style={{ color: c.muted }}>
          {t(
            "Daftar masak, rute antar, dan semua pelangganmu di satu tempat. Gratis untuk pelanggan yang kamu bawa sendiri.",
            "Cooking lists, delivery routes and all your customers in one place. Free for customers you bring yourself.",
          )}
        </Text>
      </View>
      <Field
        label={t("Nama usaha katering", "Catering business name")}
        value={name}
        onChangeText={setName}
        editable={!sent}
        autoCapitalize="words"
      />
      <Field
        label={t("Nomor WhatsApp", "WhatsApp number")}
        hint={t("Kami kirim kode lewat SMS ke nomor ini.", "We'll text a code to this number.")}
        value={phone}
        onChangeText={setPhone}
        editable={!sent}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
      />
      <View style={{ gap: nativeLayout.groupGap }}>
        {/* The same 13 bold ink as the fields' own labels. */}
        <Text variant="meta" style={{ color: c.charcoal, fontFamily: fontFor("700") }}>
          {t("Lokasi dapur", "Kitchen area")}
        </Text>
        {/* 34 chips reach their 48 target by 7 of slop above and below, so the wrapped rows sit 14 apart. */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: nativeLayout.groupGap, rowGap: 48 - nativeLayout.control.chip }}>
          {areaOptions.map((a) => (
            <Chip key={a} label={a} selected={area === a} onPress={() => !sent && setArea(a)} />
          ))}
        </View>
      </View>
      {sent ? (
        <Field
          label={t("Kode dari SMS", "Code from SMS")}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          maxLength={6}
          autoFocus
        />
      ) : null}
      {sent ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: nativeLayout.groupGap }}>
          <Button variant="text" label={t("Ganti nomor", "Change number")} disabled={busy} onPress={changeNumber} />
          {kept ? null : <Button variant="text" label={t("Kirim ulang kode", "Resend code")} busy={busy} onPress={sendCode} />}
        </View>
      ) : null}
      {failure ? <FormError message={failure.message} failureKey={failure.key} /> : null}
    </AuthScreen>
  );
}
