import { useState, type ReactNode } from "react";
import { View } from "react-native";
import { authClient, authError, clearPending, savePending, useMobile } from "@catera/mobile-core";
import { AuthHeading, AuthScreen } from "../AuthLayout";
import { Button, Field } from "../components";
import { FormError } from "../FormError";
import { useT } from "../useT";
import type { AuthRun, FormPose } from "./AuthRun";
import { authFields } from "./authFields";
import { CheckEmail } from "./CheckEmail";
import { useFieldCheck } from "./useFieldCheck";

/**
 * Lupa kata sandi, for either app: an email field, a recovery link sent to it, then "Cek emailmu". The app brings its
 * own failure hook (`action`, `form`) and email rule (`emailCheck`). `art` is CheckEmail's (undefined: the reading
 * mascot, null: none); `brand` swaps the heading mascot for a wordmark.
 */
export function RecoverForm({
  next,
  redirectTo,
  action,
  form,
  emailCheck,
  art,
  brand,
  onBack,
}: {
  /** Where to return after the new password; already a safe in-app path. */
  next: string;
  redirectTo: string;
  action: AuthRun;
  form: FormPose;
  emailCheck: (value: string) => string;
  art?: ReactNode;
  brand?: string;
  onBack(): void;
}) {
  const { runtime } = useMobile();
  const t = useT();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [resent, setResent] = useState(false);
  const checks = useFieldCheck({ email: { value: email, check: emailCheck } });

  const send = () =>
    action.run(async () => {
      const again = sent;
      if (again) setResent(false);
      await savePending(runtime, "recovery", next, email.trim());
      try {
        const { error } = await authClient(runtime).auth.resetPasswordForEmail(email.trim(), { redirectTo });
        // Unknown addresses get the same answer, so the form does not reveal who is registered.
        if (error?.code !== "user_not_found") authError(error);
      } catch (e) {
        // A first request that failed sent no link; after one went out, the earlier intent stays.
        if (!again) await clearPending(runtime);
        throw e;
      }
      setSent(true);
      if (again) setResent(true);
    });

  const press = () => form.press(checks, () => void send());

  const failed = action.message ? (
    <FormError message={action.message} failureKey={action.failures} testID="identity-error" retry={action.retryable ? () => void send() : undefined} />
  ) : null;
  const back = <Button variant="text" label={t("Kembali ke Masuk", "Back to sign in")} style={{ alignSelf: "flex-start" }} onPress={onBack} />;

  return (
    <AuthScreen revealKey={action.failures}>
      {sent ? (
        <>
          <CheckEmail
            email={email.trim()}
            intro={t("Kalau email ini terdaftar, tautan pemulihan sudah kami kirim ke", "If this email has an account, we've sent a recovery link to")}
            art={art}
            resent={resent}
            resendBusy={action.busy}
            error={failed}
            onResend={() => void send()}
            onChangeEmail={() => {
              setResent(false);
              setSent(false);
            }}
          />
          {back}
        </>
      ) : (
        <>
          <AuthHeading
            title={t("Pemulihan akun", "Account recovery")}
            subtitle={t(
              "Kami kirim tautan ke emailmu. Buka tautannya di HP ini untuk membuat kata sandi baru.",
              "We'll email you a link. Open it on this phone to set a new password.",
            )}
            brand={brand}
            pose={form.pose}
          />
          <View style={{ gap: 14 }}>
            <Field
              label="Email"
              {...authFields.email}
              {...checks.fieldProps("email")}
              value={email}
              onChangeText={form.edit(setEmail)}
              editable={!action.busy}
              returnKeyType="go"
              onSubmitEditing={press}
            />
            {failed}
            <Button label={action.label(t("Kirim tautan pemulihan", "Send recovery link"))} busy={action.busy} disabled={action.wait > 0} onPress={press} />
            {back}
          </View>
        </>
      )}
    </AuthScreen>
  );
}
