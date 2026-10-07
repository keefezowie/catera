import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { useMobile } from "@catera/mobile-core";
import { Button, colors, Field, Screen, Text } from "@catera/mobile-ui";
import { nativeReturnPath } from "../auth";
import { authClient, authError, pendingKey, type Pending } from "./emailAuth";
import { useAction } from "./useAction";

/** An email link is good for an hour, on the phone that asked for it. */
const LINK_LIFETIME_MS = 60 * 60 * 1000;

/** catera://auth/callback: finishes email verification, or sets a new password after recovery. */
export function AuthCallback() {
  const { runtime, refresh, t } = useMobile();
  const params = useLocalSearchParams<{ code?: string; error?: string }>();
  const code = typeof params.code === "string" ? params.code : "";
  const linkError = typeof params.error === "string" ? params.error : "";
  const [phase, setPhase] = useState<"checking" | "recovery" | "error">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const next = useRef("/");
  const recoveryUser = useRef("");
  const started = useRef(false);
  const action = useAction();

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      // PKCE binds this one-time code to the device that requested the email.
      const raw = await SecureStore.getItemAsync(pendingKey(runtime));
      const intent = raw ? (JSON.parse(raw) as Pending) : null;
      if (!code || linkError || !intent || Date.now() - intent.at > LINK_LIFETIME_MS) throw new Error("RECOVERY_EXPIRED");
      const client = authClient(runtime);
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (error || !data.user || !data.session) throw new Error("RECOVERY_EXPIRED");
      await SecureStore.deleteItemAsync(pendingKey(runtime));
      await SecureStore.deleteItemAsync(runtime.storageKey("demo.token"));
      next.current = nativeReturnPath(intent.next);
      const redirectType = (data as typeof data & { redirectType?: string | null }).redirectType;
      if (intent.purpose === "recovery") {
        // Only a real recovery link may set a password, whatever the local intent says.
        if (redirectType !== "recovery") throw new Error("RECOVERY_EXPIRED");
        recoveryUser.current = data.user.id;
        setPhase("recovery");
        return;
      }
      const ensured = await client.rpc("catera_v1_command", {
        action: "profile.ensure",
        payload: { name: String(data.user.user_metadata?.name || "Pelanggan").slice(0, 100) },
        request_id: Crypto.randomUUID(),
      });
      if (ensured.error) throw ensured.error;
      await refresh();
      router.replace(next.current as never);
    })().catch(() => setPhase("error"));
  }, [code, linkError, refresh, runtime]);

  const savePassword = () =>
    action.run(async () => {
      const client = authClient(runtime);
      const { data, error } = await client.auth.getUser();
      if (error || !recoveryUser.current || data.user?.id !== recoveryUser.current) throw new Error("RECOVERY_EXPIRED");
      authError((await client.auth.updateUser({ password })).error);
      recoveryUser.current = "";
      setPassword("");
      setConfirm("");
      authError((await client.auth.signOut({ scope: "local" })).error);
      router.replace({ pathname: "/login", params: { next: next.current } } as never);
    });

  return (
    <Screen>
      <View style={{ gap: 14, paddingTop: 8 }}>
        <Text variant="title">
          {phase === "recovery" ? t("Kata sandi baru", "New password") : t("Verifikasi akun", "Verify account")}
        </Text>
        {phase === "checking" ? <Text>{t("Memeriksa tautan…", "Checking your link…")}</Text> : null}
        {phase === "error" ? (
          <>
            <Text>
              {t(
                "Tautan tidak berlaku, sudah dipakai, atau dibuka di HP lain. Minta tautan baru dari HP ini.",
                "The link expired, was used, or was opened on another phone. Request a new link from this phone.",
              )}
            </Text>
            <Button label={t("Pulihkan kata sandi", "Recover password")} onPress={() => router.replace("/recover" as never)} />
            <Button variant="secondary" label={t("Masuk", "Sign in")} onPress={() => router.replace("/login" as never)} />
          </>
        ) : null}
        {phase === "recovery" ? (
          <>
            <Field
              label={t("Kata sandi baru", "New password")}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={256}
            />
            <Field
              label={t("Ulangi kata sandi", "Confirm password")}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={256}
              hint={t("Minimal 8 karakter. Kedua isian harus sama.", "At least 8 characters. Both fields must match.")}
            />
            {action.error ? (
              <Text style={{ color: colors.danger }} testID="identity-error">
                {action.error}
              </Text>
            ) : null}
            <Button
              label={t("Simpan kata sandi & masuk", "Save password & sign in")}
              disabled={action.busy || password.length < 8 || password !== confirm}
              onPress={() => void savePassword()}
            />
          </>
        ) : null}
      </View>
    </Screen>
  );
}
