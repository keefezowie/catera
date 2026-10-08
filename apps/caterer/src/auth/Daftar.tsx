import { useState } from "react";
import { View } from "react-native";
import * as Crypto from "expo-crypto";
import { router } from "expo-router";
import { areaOptions, errorLabel } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { Button, Chip, colors, Field, Screen, Text } from "@catera/mobile-ui";
import { catererSlug, e164Indonesia } from "../onboarding";

/** Sign-up: business name, WhatsApp number (verified by SMS) and kitchen area. */
export function Daftar() {
  const { runtime, t, locale, signedIn, command } = useMobile();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = name.trim().length >= 3 && phone.replace(/\D/g, "").length >= 9 && !!area;

  async function run(step: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await step();
    } catch (e) {
      setError(
        errorLabel((e as Error).message, locale) ||
          t("Belum berhasil. Coba lagi.", "That didn't work. Try again."),
      );
    } finally {
      setBusy(false);
    }
  }

  const sendCode = () =>
    run(async () => {
      await runtime.sendPhoneOtp(e164Indonesia(phone));
      setSent(true);
    });

  const create = () =>
    run(async () => {
      const actor = await runtime.verifyPhoneOtp(
        e164Indonesia(phone),
        code.trim(),
        name.trim(),
        Crypto.randomUUID(),
      );
      await command("seller.create", {
        name: name.trim(),
        slug: catererSlug(name, Crypto.randomUUID().replace(/-/g, "").slice(0, 4)),
        description: "",
        areas: [area],
      });
      await signedIn(actor);
      router.replace("/");
    });

  return (
    <Screen
      footer={
        sent ? (
          <Button
            label={t("Buat dapur saya", "Create my kitchen")}
            disabled={busy || code.trim().length < 6}
            onPress={create}
          />
        ) : (
          <Button label={t("Kirim kode", "Send code")} disabled={busy || !ready} onPress={sendCode} />
        )
      }
    >
      <View style={{ gap: 8 }}>
        <Text variant="title">{t("Kelola katering dari satu HP", "Run your catering from one phone")}</Text>
        <Text style={{ color: colors.muted }}>
          {t(
            "Daftar masak, rute antar, dan semua pelanggan Anda di satu tempat. Gratis untuk pelanggan yang Anda bawa sendiri.",
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
      />
      <View style={{ gap: 8 }}>
        <Text variant="label">{t("Lokasi dapur", "Kitchen area")}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
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
          maxLength={6}
          autoFocus
        />
      ) : null}
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
    </Screen>
  );
}
