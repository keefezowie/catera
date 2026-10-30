import { useEffect, useState } from "react";
import { BackHandler, View } from "react-native";
import { router } from "expo-router";
import { authClient, authError, clearPending, redirectFor, resendLink, savePending, useMobile } from "@catera/mobile-core";
import {
  authFields,
  AuthHeading,
  AuthScreen,
  AuthSwitch,
  Button,
  CheckEmail,
  Field,
  FormError,
  PasswordField,
  PasswordRule,
  StepHeader,
  useFieldCheck,
} from "@catera/mobile-ui";
import { leaveAuth } from "./Daftar";
import { holdInvite } from "./pending";
import { StepFooter, StepTitle, Terms } from "./parts";
import { emailCheck, inviteCheck, newPasswordCheck, personCheck, registeredText } from "./checks";
import { useAuthRun } from "./useAuthRun";

/**
 * Gabung ke dapur for invited staff (spec "Dapur app"): the invite code, then the account. There is no invite preview
 * read, so the code is checked when it is accepted: on the first signed-in session after the email link (RoleGate's
 * `settlePending`), where a code that does not exist lands in the gate's own code field. Someone who already has an
 * account signs in first and enters the code there.
 */
export function Gabung() {
  const { runtime, t } = useMobile();
  const [step, setStep] = useState(1);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [resent, setResent] = useState(false);
  const run = useAuthRun();

  const one = useFieldCheck({ code: { value: code, check: inviteCheck(t) } });
  const two = useFieldCheck({
    name: { value: name, check: personCheck(t) },
    email: { value: email, check: emailCheck(t) },
    password: { value: password, check: newPasswordCheck },
  });
  const nameField = two.fieldProps("name");
  const emailField = two.fieldProps("email");
  const { error: _ruleOnly, ...passwordField } = two.fieldProps("password");

  const back = () => (step > 1 ? setStep(1) : leaveAuth());
  useEffect(() => {
    if (step === 1 || sent) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setStep(1);
      return true;
    });
    return () => sub.remove();
  }, [step, sent]);

  const signUp = () =>
    run.run(async () => {
      const address = email.trim();
      await savePending(runtime, "signup", "/", address);
      try {
        const client = authClient(runtime);
        const { data, error } = await client.auth.signUp({
          email: address,
          password,
          options: { emailRedirectTo: redirectFor("catera-dapur"), data: { name: name.trim(), pendingInvite: code.trim() } },
        });
        if (data.session) {
          await client.auth.signOut({ scope: "local" });
          throw new Error("NOT_CONFIGURED");
        }
        if (["user_already_exists", "email_exists"].includes(error?.code || "") || data.user?.identities?.length === 0) throw new Error("EMAIL_REGISTERED");
        authError(error);
      } catch (e) {
        await clearPending(runtime);
        throw e;
      }
      setPassword("");
      setSent(true);
    });

  const resend = () =>
    run.run(async () => {
      setResent(false);
      await resendLink(runtime, { purpose: "signup", next: "/", email: email.trim() }, redirectFor("catera-dapur"));
      setResent(true);
    });

  const next = () => (step === 1 ? one.submit(() => setStep(2)) : two.submit(() => void signUp()));
  const toMasuk = () => router.replace("/masuk" as never);

  const registered = run.code === "EMAIL_REGISTERED";
  const message = registered ? registeredText(t) : run.message;
  const failed = message ? (
    <FormError
      message={message}
      failureKey={run.failures}
      retry={run.retryable && !registered ? () => void (sent ? resend() : signUp()) : undefined}
      action={registered ? { label: t("Masuk dengan email ini", "Sign in with this email"), onPress: toMasuk } : undefined}
    />
  ) : null;

  if (sent)
    return (
      <AuthScreen revealKey={run.failures}>
        <CheckEmail
          email={email.trim()}
          intro={t("Kalau emailnya bisa dipakai, kami kirim tautan verifikasi ke", "If this email can be used, we'll send a verification link to")}
          resent={resent}
          resendBusy={run.busy}
          error={failed}
          onResend={() => void resend()}
          onChangeEmail={() => {
            setResent(false);
            setSent(false);
          }}
        />
        <Button variant="text" label={t("Kembali ke halaman masuk", "Back to sign in")} style={{ alignSelf: "flex-start" }} onPress={toMasuk} />
      </AuthScreen>
    );

  return (
    <AuthScreen
      revealKey={run.failures}
      footer={
        <StepFooter
          links={
            step === 1 ? (
              <AuthSwitch
                prompt={t("Sudah punya akun?", "Already have an account?")}
                action={t("Masuk dulu", "Sign in first")}
                // The typed code waits on this phone; after Masuk the gate's invite field has it.
                onPress={() => void holdInvite(runtime, code).then(toMasuk)}
              />
            ) : (
              <Terms lead={t("Dengan bergabung, kamu setuju dengan", "By joining, you agree to the")} />
            )
          }
        >
          <Button
            label={step === 2 ? run.label(t("Gabung", "Join")) : t("Lanjut", "Continue")}
            busy={step === 2 && run.busy}
            disabled={step === 2 && run.wait > 0}
            onPress={next}
          />
        </StepFooter>
      }
    >
      <StepHeader step={step} total={2} onBack={back} />
      {step === 1 ? (
        <>
          <AuthHeading
            title={t("Gabung ke dapur", "Join a kitchen")}
            subtitle={t("Masukkan kode undangan yang dikirim pemilik dapur lewat WhatsApp.", "Enter the invite code the kitchen owner sent you on WhatsApp.")}
          />
          <Field
            {...one.fieldProps("code")}
            label={t("Kode undangan", "Invite code")}
            value={code}
            onChangeText={setCode}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={next}
          />
        </>
      ) : (
        <>
          <StepTitle
            title={t("Buat akunmu", "Create your account")}
            subtitle={t("Kamu langsung masuk ke dapurnya setelah membuka tautan di emailmu.", "You join the kitchen as soon as you open the link in your email.")}
          />
          <Field
            {...authFields.name}
            {...nameField}
            label={t("Namamu", "Your name")}
            value={name}
            onChangeText={setName}
            editable={!run.busy}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => emailField.inputRef.current?.focus()}
          />
          <Field
            {...authFields.email}
            {...emailField}
            label="Email"
            value={email}
            onChangeText={setEmail}
            editable={!run.busy}
            invalid={registered}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordField.inputRef.current?.focus()}
          />
          <View style={{ gap: 6 }}>
            <PasswordField
              {...authFields.newPassword}
              {...passwordField}
              label={t("Kata sandi", "Password")}
              value={password}
              onChangeText={setPassword}
              editable={!run.busy}
              invalid={run.code === "PASSWORD_REJECTED" || !!two.messages.password}
              returnKeyType="go"
              onSubmitEditing={next}
              showA11y={t("Tampilkan kata sandi", "Show password")}
              hideA11y={t("Sembunyikan kata sandi", "Hide password")}
            />
            <PasswordRule value={password} failed={!!two.messages.password} />
          </View>
          {failed}
        </>
      )}
    </AuthScreen>
  );
}
