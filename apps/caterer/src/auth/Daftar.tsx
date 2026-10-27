import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, BackHandler, View } from "react-native";
import * as Crypto from "expo-crypto";
import { nativeLayout } from "@catera/design-tokens";
import { areaOptions } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import {
  authFields,
  AuthOutcome,
  AuthScreen,
  Button,
  Chip,
  CodeInput,
  countdownText,
  Field,
  fontFor,
  FieldMessage,
  FormError,
  ResendButton,
  Text,
  useColors,
  useFieldCheck,
  useResendTimer,
} from "@catera/mobile-ui";
import { useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { goToTab } from "../nav";
import { catererSlug, e164Indonesia } from "../onboarding";
import { useFormRun } from "../useFormRun";
import { areaCheck, canRetry, nameCheck, phoneCheck, rateText, serverFallback, wrongCode } from "./checks";

/** Sign-up: business name, WhatsApp number (verified by SMS) and kitchen area. */
export function Daftar() {
  const { runtime, t, locale, signedIn, command } = useMobile();
  const c = useColors();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [misses, setMisses] = useState(0);
  // The registered kitchen: its name for the outcome, and the session that signs in when "Buka Hari ini" is pressed.
  const [done, setDone] = useState<{ name: string; actor: Awaited<ReturnType<typeof runtime.verifyPhoneOtp>> } | null>(null);
  const { busy, failure, run } = useFormRun(locale, serverFallback(t));
  // Which button is waiting, so only it spins.
  const [waiting, setWaiting] = useState<"" | "step" | "resend">("");
  const go = (which: "step" | "resend", step: () => Promise<unknown>) =>
    run(async () => {
      setWaiting(which);
      try {
        await step();
      } finally {
        setWaiting("");
      }
    });
  // The last step, so "Coba lagi" repeats it.
  const last = useRef<(() => void) | null>(null);
  const navigation = useNavigation();
  const [left, setLeft] = useState(false);
  const leaving = useRef(false);
  const resend = useResendTimer(60);
  const rate = useResendTimer(60);
  // A retry after a failed seller.create reuses the verified actor, the verify requestId and the slug suffix.
  const verified = useRef<Awaited<ReturnType<typeof runtime.verifyPhoneOtp>> | null>(null);
  const verifyId = useRef(Crypto.randomUUID());
  const slugSuffix = useRef(Crypto.randomUUID().replace(/-/g, "").slice(0, 4));
  const [kept, setKept] = useState(false);
  const codeRef = useRef<{ focus(): void }>(null);
  const firstChip = useRef<View>(null);

  const form = useFieldCheck({
    name: { value: name, check: nameCheck(t) },
    phone: { value: phone, check: phoneCheck(t) },
    area: { value: area, check: areaCheck(t) },
  });
  const nameField = form.fieldProps("name");
  const phoneField = form.fieldProps("phone");
  const areaField = form.fieldProps("area");
  // The area has no text input: focus for it means the first chip.
  (areaField.inputRef as { current: unknown }).current = {
    focus: () => {
      const node = firstChip.current;
      if (node) AccessibilityInfo.sendAccessibilityEvent(node, "focus");
    },
  };

  const failCode = failure?.code;
  useEffect(() => {
    if (failure?.code === "AUTH_RATE_LIMITED") rate.restart();
    if (failure?.code === "INVALID_OTP") {
      setMisses((n) => n + 1);
      codeRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per failure
  }, [failure?.key]);

  // The one exit from the outcome: sign in, then Hari ini. Every other way out (header back, swipe, hardware back) goes here.
  const open = async () => {
    if (leaving.current) return;
    leaving.current = true;
    try {
      if (done) await signedIn(done.actor);
    } catch {
      leaving.current = false;
      return;
    }
    setLeft(true);
    // The prevention lifts on the next render; leave after it, or the router would be stopped by our own guard.
    await new Promise((r) => setTimeout(r, 0));
    goToTab("index");
  };
  useEffect(() => {
    if (done) navigation.setOptions({ headerBackVisible: false, headerLeft: () => null, gestureEnabled: false });
  }, [done, navigation]);
  usePreventRemove(!!done && !left, () => void open());
  useEffect(() => {
    if (!done) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      void open();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open reads done, which is what this depends on
  }, [done]);

  const sendCode = () => {
    last.current = sendCode;
    form.submit(
      () =>
        void go("step", async () => {
          await runtime.sendPhoneOtp(e164Indonesia(phone));
          setSent(true);
          setMisses(0);
          resend.restart();
        }),
    );
  };

  const resendCode = () => {
    last.current = resendCode;
    return go("resend", async () => {
      await runtime.sendPhoneOtp(e164Indonesia(phone));
      setCode("");
      setMisses(0);
      resend.restart();
    });
  };

  // The old number's session is dropped first, or a refresh could sign into its half-registered profile.
  const changeNumber = () =>
    run(async () => {
      if (verified.current) await runtime.signOut();
      setSent(false);
      setCode("");
      setMisses(0);
      setKept(false);
      verified.current = null;
      verifyId.current = Crypto.randomUUID();
      slugSuffix.current = Crypto.randomUUID().replace(/-/g, "").slice(0, 4);
    });

  const create = (entered = code) => {
    last.current = () => void create(entered);
    return go("step", async () => {
      try {
        verified.current ??= await runtime.verifyPhoneOtp(e164Indonesia(phone), entered.trim(), name.trim(), verifyId.current);
      } catch (e) {
        if (((e as { code?: string }).code || (e as Error).message) === "INVALID_OTP") setCode("");
        throw e;
      }
      const actor = verified.current;
      setKept(true);
      await command("seller.create", {
        name: name.trim(),
        slug: catererSlug(name, slugSuffix.current),
        description: "",
        areas: [area],
      });
      setDone({ name: name.trim(), actor });
    });
  };

  if (done)
    return (
      <AuthOutcome
        title={t("Dapurmu siap", "Your kitchen is ready")}
        body={t(`${done.name} sudah terdaftar. Mulai dengan menambah menu.`, `${done.name} is registered. Start by adding a menu.`)}
        primary={{ label: t("Buka Hari ini", "Open Today"), onPress: () => void open() }}
        play
      />
    );

  const limited = failCode === "AUTH_RATE_LIMITED" && rate.left > 0;
  const wait = countdownText(rate.left);
  const wrongOtp = failCode === "INVALID_OTP";
  const waitLabel = t(`Coba lagi dalam ${wait}`, `Try again in ${wait}`);

  return (
    <AuthScreen
      revealKey={failure?.key}
      footer={
        sent ? (
          <Button
            label={limited ? waitLabel : t("Buat dapur saya", "Create my kitchen")}
            busy={waiting === "step"}
            disabled={limited || (!kept && code.length < 6)}
            onPress={() => void create()}
          />
        ) : (
          <Button label={limited ? waitLabel : t("Kirim kode", "Send code")} busy={waiting === "step"} disabled={limited} onPress={sendCode} />
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
        {...authFields.name}
        {...nameField}
        label={t("Nama usaha katering", "Catering business name")}
        value={name}
        onChangeText={setName}
        editable={!sent}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => phoneField.inputRef.current?.focus()}
      />
      <Field
        {...authFields.phone}
        {...phoneField}
        label={t("Nomor WhatsApp", "WhatsApp number")}
        hint={t("Kami kirim kode lewat SMS ke nomor ini.", "We'll text a code to this number.")}
        value={phone}
        onChangeText={setPhone}
        editable={!sent}
        returnKeyType="go"
        onSubmitEditing={sendCode}
      />
      <View style={{ gap: nativeLayout.groupGap }}>
        {/* The same 13 bold ink as the fields' own labels. */}
        <Text variant="meta" style={{ color: c.charcoal, fontFamily: fontFor("700") }}>
          {t("Lokasi dapur", "Kitchen area")}
        </Text>
        {/* 34 chips reach their 48 target by 7 of slop above and below, so the wrapped rows sit 14 apart. */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: nativeLayout.groupGap, rowGap: 48 - nativeLayout.control.chip }}>
          {areaOptions.map((a, i) => (
            <View key={a} ref={i === 0 ? firstChip : undefined} collapsable={false}>
              <Chip label={a} selected={area === a} onPress={() => !sent && setArea(a)} />
            </View>
          ))}
        </View>
        {areaField.error ? <FieldMessage text={areaField.error} testID="area-error" /> : null}
      </View>
      {sent ? (
        <CodeInput
          label={t("Kode dari SMS", "Code from SMS")}
          value={code}
          onChangeText={setCode}
          onFilled={(entered) => {
            if (!kept) void create(entered);
          }}
          editable={!busy}
          inputRef={codeRef as never}
          sentTo={e164Indonesia(phone)}
          error={wrongOtp ? wrongCode(t, misses) : undefined}
          errorKey={failure?.key}
        />
      ) : null}
      {sent ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: nativeLayout.groupGap }}>
          <Button variant="text" label={t("Ganti nomor", "Change number")} disabled={busy} onPress={changeNumber} />
          {kept ? null : (
            <ResendButton
              left={resend.left}
              ready={t("Kirim ulang kode", "Resend code")}
              waiting={(time) => t(`Kirim ulang dalam ${time}`, `Resend in ${time}`)}
              busy={waiting === "resend"}
              onPress={() => void resendCode()}
            />
          )}
        </View>
      ) : null}
      {failure && !wrongOtp && (failCode !== "AUTH_RATE_LIMITED" || limited) ? (
        <FormError
          message={limited ? rateText(t, wait) : failure.message}
          failureKey={failure.key}
          retry={canRetry(t, failure) && last.current ? () => last.current?.() : undefined}
        />
      ) : null}
    </AuthScreen>
  );
}
