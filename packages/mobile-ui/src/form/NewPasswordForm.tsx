import { useState } from "react";
import { View } from "react-native";
import { AuthHeading, AuthScreen, PasswordField } from "../AuthLayout";
import { Button } from "../components";
import { FormError } from "../FormError";
import { useT } from "../useT";
import type { AuthRun, FormPose } from "./AuthRun";
import { authFields } from "./authFields";
import { PasswordMatch, PasswordRule } from "./PasswordLines";
import { useFieldCheck } from "./useFieldCheck";

/**
 * Choose a new password after a recovery link (spec 3.4): the password with its rules line, the repeat with a live
 * match line, one show/hide for both, and a button that stays enabled (a press shows what is wrong). `brand` swaps the
 * mascot for a wordmark (Dapur).
 */
export function NewPasswordForm({
  onSave,
  action,
  form,
  brand,
  onBack,
}: {
  onSave(password: string): Promise<void>;
  action: AuthRun;
  form: FormPose;
  brand?: string;
  /** A way out ("Kembali ke Masuk"); the recovery session stays. */
  onBack?: () => void;
}) {
  const t = useT();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [shown, setShown] = useState(false);
  const checks = useFieldCheck({
    password: { value: password, check: (v) => (v.length >= 8 ? "" : "short") },
    confirm: { value: confirm, check: (v) => (v === password ? "" : "mismatch") },
  });
  // The rule and match lines word these, so the Field itself shows no message.
  const { error: _rule, ...passwordProps } = checks.fieldProps("password");
  const { error: _match, ...confirmProps } = checks.fieldProps("confirm");
  const save = () => action.run(() => onSave(password));
  const press = () => form.press(checks, () => void save());
  const common = {
    ...authFields.newPassword,
    shown,
    onShownChange: setShown,
    showA11y: t("Tampilkan kata sandi", "Show password"),
    hideA11y: t("Sembunyikan kata sandi", "Hide password"),
    editable: !action.busy,
    invalid: action.code === "PASSWORD_REJECTED",
  };
  return (
    <AuthScreen revealKey={action.failures}>
      <AuthHeading title={t("Kata sandi baru", "New password")} brand={brand} pose={form.pose} />
      <View style={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <PasswordField label={t("Kata sandi baru", "New password")} {...common} {...passwordProps} value={password} onChangeText={form.edit(setPassword)}
            returnKeyType="next"
            onSubmitEditing={() => confirmProps.inputRef.current?.focus()}
          />
          <PasswordRule value={password} failed={!!checks.messages.password} />
        </View>
        <View style={{ gap: 6 }}>
          <PasswordField
            label={t("Ulangi kata sandi", "Confirm password")}
            {...common}
            {...confirmProps}
            value={confirm}
            onChangeText={form.edit(setConfirm)}
            returnKeyType="go"
            onSubmitEditing={press}
          />
          <PasswordMatch first={password} second={confirm} touched={!!checks.messages.confirm} />
        </View>
        {action.message ? (
          <FormError message={action.message} failureKey={action.failures} testID="identity-error" retry={action.retryable ? () => void save() : undefined} />
        ) : null}
        <Button label={action.label(t("Simpan kata sandi", "Save password"))} busy={action.busy} disabled={action.wait > 0} onPress={press} />
        {onBack ? <Button variant="text" label={t("Kembali ke Masuk", "Back to sign in")} style={{ alignSelf: "flex-start" }} onPress={onBack} /> : null}
      </View>
    </AuthScreen>
  );
}
