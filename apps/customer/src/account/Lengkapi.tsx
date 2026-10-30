import { useEffect, useState } from "react";
import { BackHandler, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { localCustomerPhone, type Actor } from "@catera/domain";
import { useMobile, type MobileRuntime } from "@catera/mobile-core";
import {
  authFields,
  AuthHeading,
  AuthScreen,
  Button,
  Field,
  FormError,
  StepHeader,
  Text,
  useColors,
  useFieldCheck,
} from "@catera/mobile-ui";
import { accountMessage } from "./accountMessages";
import { e164, phoneCheck } from "./phone";
import { useAction } from "./useAction";

/** What Lengkapi akun opens with: the name to suggest, where it came from, and a number already on the account. */
export type LengkapiInfo = { actorId: string; provider: string; name: string; phone: string; /** The profile's name now. */ current: string };

const DEFAULT_NAME = "Pelanggan";
const flagKey = (actorId: string) => `catera.onboarded.${actorId.replace(/[^\w.-]/g, "")}`;

/**
 * Whether Lengkapi akun should show after this sign-in: never finished or skipped (the `catera_onboarded` flag in the
 * Supabase user metadata, or this phone's own copy of it), and the profile still has the default name or no phone.
 * Null when it should not, and on any failure: it must never stand between a person and the app.
 */
export async function lengkapiNeeded(runtime: MobileRuntime, actor: Actor | null): Promise<LengkapiInfo | null> {
  if (!runtime.supabase || !actor) return null;
  try {
    if (await SecureStore.getItemAsync(flagKey(actor.id))) return null;
    const { data } = await runtime.supabase.auth.getSession();
    const user = data?.session?.user;
    if (!user) return null;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    if (meta.catera_onboarded) {
      await SecureStore.setItemAsync(flagKey(actor.id), "1");
      return null;
    }
    const name = (actor.name ?? "").trim();
    const defaultName = !name || name === DEFAULT_NAME;
    if (!defaultName && actor.phone) return null;
    const fromProvider = [meta.full_name, meta.name].find((v): v is string => typeof v === "string" && !!v.trim()) ?? "";
    return {
      actorId: actor.id,
      provider: String(user.app_metadata?.provider ?? ""),
      name: defaultName ? fromProvider.trim() : name,
      current: name,
      phone: actor.phone ? localCustomerPhone(actor.phone).replace(/-/g, " ") : "",
    };
  } catch {
    return null;
  }
}

/** Finished or skipped: on this phone at once (so it never shows again offline), and in the account when it can. */
async function markOnboarded(runtime: MobileRuntime, actorId: string) {
  await SecureStore.setItemAsync(flagKey(actorId), "1").catch(() => undefined);
  // Not awaited: offline the account write must not hold the person here; the local flag already counts.
  void runtime.supabase?.auth.updateUser({ data: { catera_onboarded: true } }).catch(() => undefined);
}

/** Lengkapi akun: the name (step 1), then the WhatsApp number (step 2, "Nanti saja" skips it). */
export function Lengkapi({ info, onDone }: { info: LengkapiInfo; onDone: () => void }) {
  const { runtime, command, refresh, t } = useMobile();
  const c = useColors();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(info.name);
  const [phone, setPhone] = useState(info.phone);
  const action = useAction(accountMessage);
  const nameChecks = useFieldCheck({
    name: {
      value: name,
      check: (v) =>
        v.replace(/[^\p{L}]/gu, "").length >= 2 ? "" : t("Tulis namamu, minimal 2 huruf.", "Enter your name, at least 2 letters."),
    },
  });
  const phoneChecks = useFieldCheck({
    phone: {
      value: phone,
      check: phoneCheck(t, t("Isi nomor WhatsApp-mu, atau pilih Nanti saja.", "Enter your WhatsApp number, or choose Later.")),
    },
  });
  const hint =
    info.provider === "google" && info.name
      ? t("Dari akun Google-mu. Ubah kalau perlu.", "From your Google account. Change it if you need to.")
      : info.provider === "apple" && info.name
        ? t("Dari akun Apple-mu. Ubah kalau perlu.", "From your Apple account. Change it if you need to.")
        : undefined;

  // Android's back on step 2 returns to the name, like the step header's back.
  useEffect(() => {
    if (step !== 2) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setStep(1);
      return true;
    });
    return () => sub.remove();
  }, [step]);

  const save = (withPhone: boolean) =>
    action.run(async () => {
      // Nanti saja with the name as it is sends nothing, so skipping works offline too.
      if (!withPhone && name.trim() === info.current) {
        await markOnboarded(runtime, info.actorId);
        onDone();
        return;
      }
      const payload: { name: string; phone?: string } = { name: name.trim() };
      if (withPhone) payload.phone = e164(phone) ?? phone;
      await command("profile.update", payload);
      await markOnboarded(runtime, info.actorId);
      await refresh();
      onDone();
    });

  const error = action.error ? <FormError message={action.error} failureKey={action.failures} testID="lengkapi-error" /> : null;

  if (step === 1)
    return (
      <AuthScreen
        revealKey={action.failures}
        footer={<Button label={t("Lanjut", "Continue")} onPress={() => nameChecks.submit(() => setStep(2))} />}
      >
        <StepHeader step={1} total={2} />
        <AuthHeading title={t("Halo! Siapa namamu?", "Hi! What's your name?")} subtitle={t("Katering menulis nama ini di label antaranmu.", "Caterers write this name on your delivery label.")} />
        <Field
          label={t("Nama", "Name")}
          {...authFields.name}
          {...nameChecks.fieldProps("name")}
          value={name}
          onChangeText={setName}
          hint={hint}
          returnKeyType="next"
          onSubmitEditing={() => nameChecks.submit(() => setStep(2))}
        />
      </AuthScreen>
    );

  return (
    <AuthScreen
      revealKey={action.failures}
      footer={
        <View style={{ gap: 8 }}>
          <Button variant="text" label={t("Nanti saja", "Later")} disabled={action.busy} style={{ alignSelf: "center" }} onPress={() => void save(false)} />
          <Button label={t("Selesai", "Done")} busy={action.busy} onPress={() => phoneChecks.submit(() => void save(true))} />
        </View>
      }
    >
      <StepHeader step={2} total={2} onBack={() => setStep(1)} />
      <View style={{ gap: 8, paddingTop: 8 }}>
        <Text variant="display" accessibilityRole="header">
          {t("Nomor WhatsApp-mu", "Your WhatsApp number")}
        </Text>
        <Text style={{ color: c.muted }}>
          {t(
            "Katering dan kurir menghubungimu lewat nomor ini kalau ada kendala saat antar.",
            "Caterers and couriers use this number if something comes up during delivery.",
          )}
        </Text>
      </View>
      <Field
        label={t("Nomor WhatsApp", "WhatsApp number")}
        {...authFields.phone}
        {...phoneChecks.fieldProps("phone")}
        value={phone}
        onChangeText={setPhone}
        placeholder="0812…"
        editable={!action.busy}
        hint={t("Contoh: 0812 3456 7890. Kami tidak mengirim kode ke sini.", "Example: 0812 3456 7890. We don't send codes here.")}
        returnKeyType="done"
        onSubmitEditing={() => phoneChecks.submit(() => void save(true))}
      />
      {error}
    </AuthScreen>
  );
}
