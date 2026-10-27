import { useEffect, useState } from "react";
import { View } from "react-native";
import { AuthHeading, AuthScreen, PasswordField } from "../AuthLayout";
import { Button } from "../components";
import { FormError } from "../FormError";
import { useT } from "../useT";
import type { AuthRun } from "./AuthRun";
import { authFields } from "./authFields";
import { PasswordMatch, PasswordRule } from "./PasswordLines";
import { useFieldCheck } from "./useFieldCheck";

/**
 * Choose a new password after a recovery link (spec 3.4): the password with its rules line, the repeat with a live
 * match line, one show/hide for both, and a button that stays enabled (a press shows what is wrong). `brand` swaps the
 * mascot for a wordmark (Dapur).
 */
export function NewPasswordForm({ onSave, action, brand }: { onSave(password: string): Promise<void>; action: AuthRun; brand?: string }) {
  const t = useT();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [shown, setShown] = useState(false);
  // Bingung after a failed press or save; the next edit sends the mascot back to melambai.
  const [bad, setBad] = useState(false);
  useEffect(() => {
    if (action.failures) setBad(true);
  }, [action.failures]);
  const checks = useFieldCheck({
    password: { value: password, check: (v) => (v.length >= 8 ? "" : "short") },
    confirm: { value: confirm, check: (v) => (v === password ? "" : "mismatch") },
  });
  // The rule and match lines word these, so the Field itself shows no message.
  const { error: _rule, ...passwordProps } = checks.fieldProps("password");
  const { error: _match, ...confirmProps } = checks.fieldProps("confirm");
  const edit = (set: (v: string) => void) => (v: string) => {
    set(v);
    setBad(false);
  };
  const save = () => action.run(() => onSave(password));
  const press = () => {
    let ok = false;
    checks.submit(() => {
      ok = true;
      void save();
    });
    if (!ok) setBad(true);
  };
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
      <AuthHeading title={t("Kata sandi baru", "New password")} brand={brand} pose={bad ? "bingung" : "melambai"} />
      <View style={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <PasswordField label={t("Kata sandi baru", "New password")} {...common} {...passwordProps} value={password} onChangeText={edit(setPassword)} />
          <PasswordRule value={password} failed={!!checks.messages.password} />
        </View>
        <View style={{ gap: 6 }}>
          <PasswordField
            label={t("Ulangi kata sandi", "Confirm password")}
            {...common}
            {...confirmProps}
            value={confirm}
            onChangeText={edit(setConfirm)}
            returnKeyType="go"
            onSubmitEditing={press}
          />
          <PasswordMatch first={password} second={confirm} touched={!!checks.messages.confirm} />
        </View>
        {action.message ? (
          <FormError message={action.message} failureKey={action.failures} testID="identity-error" retry={action.retryable ? () => void save() : undefined} />
        ) : null}
        <Button label={action.label(t("Simpan kata sandi", "Save password"))} busy={action.busy} disabled={action.wait > 0} onPress={press} />
      </View>
    </AuthScreen>
  );
}
