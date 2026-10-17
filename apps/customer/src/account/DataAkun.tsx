import { useEffect, useState, type ReactNode } from "react";
import { router } from "expo-router";
import {
  changePassword,
  listAccountRequests,
  requestEmailChange,
  sendPhoneChangeCode,
  updateProfileName,
  useData,
  useMobile,
  verifyPhoneChangeCode,
} from "@catera/mobile-core";
import { Button, Card, Field, FormError, Screen, SettingsRow, SettingsSection, Text, useToast } from "@catera/mobile-ui";
import { pushSheet } from "../nav";
import { ListSkeleton } from "../skeletons";
import { localPhone } from "./localPhone";
import { accountMessage } from "./accountMessages";
import { SignInFirst } from "./SignInFirst";
import { useAction } from "./useAction";

type Open = "nama" | "hp" | "email" | "sandi" | "";

/** What the phone's own session says about the account: how the person signs in. */
type SessionInfo = { phone: string; email: string; provider: string };

function useSessionInfo() {
  const { runtime } = useMobile();
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    let live = true;
    void runtime.supabase?.auth
      .getSession()
      .then(({ data }) => {
        const user = data.session?.user;
        if (live && user)
          setInfo({ phone: user.phone ?? "", email: user.email ?? "", provider: String(user.app_metadata?.provider ?? "") });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [runtime, round]);
  return { info, reload: () => setRound((n) => n + 1) };
}

/**
 * The "Data akun" row at the end of Pengaturan (`extraRows`), shown to a signed-in person only. It opens the page where
 * the name, the HP number, the email and the password change and where the account can be asked to be deleted.
 */
export function DataAkunEntry() {
  const { actor, ready, t } = useMobile();
  if (!ready || !actor) return null;
  return (
    <SettingsSection title={t("Akun", "Account")}>
      <SettingsRow label={t("Data akun", "Account details")} onPress={() => router.push("/data-akun" as never)} />
    </SettingsSection>
  );
}

/** Data akun: the person's own name, HP number, email and password, and the request to delete the account. */
export function DataAkun() {
  const { actor, ready, t } = useMobile();
  if (!ready)
    return (
      <Screen nativeTitle={t("Data akun", "Account details")}>
        <ListSkeleton rows={4} label={t("Memuat data akun", "Loading account details")} />
      </Screen>
    );
  if (!actor) return <SignInFirst title={t("Data akun", "Account details")} next="/data-akun" />;
  return <Details key={actor.id} />;
}

function Details() {
  const { actor, demo, runtime, t } = useMobile();
  const { info, reload } = useSessionInfo();
  const [open, setOpen] = useState<Open>("");
  const requests = useData("data-akun:requests", () => listAccountRequests(runtime.api).catch(() => null));
  const deletionOpen = !!requests.data?.some((r) => r.kind === "deletion" && r.status === "open");
  // The password belongs to an email account; a person who signs in with the HP number has none to change.
  const hasPassword = demo || (!!info?.email && info.provider !== "phone");
  const toggle = (next: Exclude<Open, "">) => setOpen((now) => (now === next ? "" : next));
  const none = t("Belum ada", "Not set");

  return (
    <Screen nativeTitle={t("Data akun", "Account details")}>
      {demo ? (
        <Text variant="caption">
          {t(
            "Demo (data contoh): nomor HP, email, dan kata sandi hanya disimulasikan.",
            "Demo (sample data): the phone number, email and password are only simulated.",
          )}
        </Text>
      ) : null}
      <SettingsSection>
        <SettingsRow label={t("Nama", "Name")} value={actor?.name ?? ""} expanded={open === "nama"} onPress={() => toggle("nama")} />
        <SettingsRow
          label={t("Nomor HP", "Phone number")}
          value={info?.phone ? localPhone(info.phone) : none}
          expanded={open === "hp"}
          onPress={() => toggle("hp")}
        />
        <SettingsRow label="Email" value={info?.email || none} expanded={open === "email"} onPress={() => toggle("email")} />
        {hasPassword ? (
          <SettingsRow label={t("Kata sandi", "Password")} expanded={open === "sandi"} onPress={() => toggle("sandi")} />
        ) : null}
      </SettingsSection>
      {open === "nama" ? <NameEditor key="nama" current={actor?.name ?? ""} onDone={() => setOpen("")} /> : null}
      {open === "hp" ? <PhoneEditor key="hp" onChanged={reload} onDone={() => setOpen("")} /> : null}
      {open === "email" ? <EmailEditor key="email" /> : null}
      {open === "sandi" ? <PasswordEditor key="sandi" onDone={() => setOpen("")} /> : null}
      <SettingsSection>
        <SettingsRow
          label={t("Hapus akun", "Delete account")}
          tone="danger"
          supporting={deletionOpen ? t("Permintaan sudah terkirim", "Request sent") : undefined}
          onPress={() => pushSheet("/hapus-akun")}
        />
      </SettingsSection>
    </Screen>
  );
}

/** One change's form: the fields, the failure at the action, the button that waits. */
function Editor({ children }: { children: ReactNode }) {
  return <Card style={{ gap: 12 }}>{children}</Card>;
}

function NameEditor({ current, onDone }: { current: string; onDone: () => void }) {
  const { command, refresh, t } = useMobile();
  const toast = useToast();
  const [name, setName] = useState(current);
  const action = useAction(accountMessage);
  const save = () =>
    action.run(async () => {
      await updateProfileName(command, name);
      await refresh();
      toast.show({ message: t("Nama disimpan", "Name saved"), tone: "success" });
      onDone();
    });
  return (
    <Editor>
      <Field label={t("Nama", "Name")} value={name} onChangeText={setName} autoComplete="name" maxLength={80} autoFocus />
      {action.error ? <FormError message={action.error} failureKey={action.failures} testID="name-error" /> : null}
      <Button
        label={t("Simpan nama", "Save name")}
        busy={action.busy}
        disabled={name.trim() === current.trim() || [...name.trim()].length < 2}
        onPress={() => void save()}
      />
    </Editor>
  );
}

function PhoneEditor({ onChanged, onDone }: { onChanged: () => void; onDone: () => void }) {
  const { runtime, demo, t } = useMobile();
  const toast = useToast();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const action = useAction(accountMessage);
  const send = () =>
    action.run(async () => {
      await sendPhoneChangeCode(runtime.supabase, demo, phone);
      setSent(true);
    });
  const verify = () =>
    action.run(async () => {
      const done = await verifyPhoneChangeCode(runtime.supabase, demo, phone, code.trim());
      onChanged();
      toast.show({
        message: done.simulated ? t("Contoh saja: nomor HP tidak berubah", "Sample only: the number did not change") : t("Nomor HP diganti", "Phone number changed"),
        tone: "success",
      });
      onDone();
    });
  return (
    <Editor>
      <Field
        label={t("Nomor HP baru", "New phone number")}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        placeholder="0812…"
        editable={!sent}
        autoFocus={!sent}
        hint={sent ? undefined : t("Kami kirim kode lewat SMS ke nomor ini.", "We text a code to this number.")}
      />
      {sent ? (
        <Field
          label={t("Kode dari SMS", "Code from SMS")}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          autoComplete="sms-otp"
          maxLength={6}
          autoFocus
        />
      ) : null}
      {action.error ? <FormError message={action.error} failureKey={action.failures} testID="phone-error" /> : null}
      {sent ? (
        <>
          <Button
            label={t("Simpan nomor", "Save number")}
            busy={action.busy}
            disabled={code.trim().length < 6}
            onPress={() => void verify()}
          />
          <Button
            variant="text"
            label={t("Ganti nomor", "Change number")}
            onPress={() => {
              setSent(false);
              setCode("");
            }}
          />
        </>
      ) : (
        <Button
          label={t("Kirim kode", "Send code")}
          busy={action.busy}
          disabled={phone.replace(/\D/g, "").length < 9}
          onPress={() => void send()}
        />
      )}
    </Editor>
  );
}

function EmailEditor() {
  const { runtime, demo, t } = useMobile();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const action = useAction(accountMessage);
  const send = () =>
    action.run(async () => {
      await requestEmailChange(runtime.supabase, demo, email);
      setSent(true);
    });
  return (
    <Editor>
      <Field
        label={t("Email baru", "New email")}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        maxLength={254}
        autoFocus
      />
      {sent ? (
        <Text testID="email-sent">
          {t(
            "Periksa emailmu. Kami mengirim tautan ke email lama dan email baru. Email baru berlaku setelah kedua tautan dibuka.",
            "Check your email. We sent a link to the old and the new address. The new email takes effect once both links are opened.",
          )}
        </Text>
      ) : null}
      {action.error ? <FormError message={action.error} failureKey={action.failures} testID="email-error" /> : null}
      <Button
        label={sent ? t("Kirim ulang tautan", "Send the links again") : t("Kirim tautan", "Send links")}
        busy={action.busy}
        disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())}
        onPress={() => void send()}
      />
    </Editor>
  );
}

function PasswordEditor({ onDone }: { onDone: () => void }) {
  const { runtime, demo, t } = useMobile();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const action = useAction(accountMessage);
  const save = () =>
    action.run(async () => {
      const done = await changePassword(runtime.supabase, demo, { current, next });
      toast.show({
        message: done.simulated ? t("Contoh saja: kata sandi tidak berubah", "Sample only: the password did not change") : t("Kata sandi diganti", "Password changed"),
        tone: "success",
      });
      onDone();
    });
  return (
    <Editor>
      <Field
        label={t("Kata sandi saat ini", "Current password")}
        value={current}
        onChangeText={setCurrent}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        maxLength={256}
        autoFocus
      />
      <Field
        label={t("Kata sandi baru", "New password")}
        value={next}
        onChangeText={setNext}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        maxLength={256}
        hint={t("Minimal 8 karakter.", "At least 8 characters.")}
      />
      <Field
        label={t("Ulangi kata sandi baru", "Repeat the new password")}
        value={again}
        onChangeText={setAgain}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        maxLength={256}
      />
      {action.error ? <FormError message={action.error} failureKey={action.failures} testID="password-error" /> : null}
      <Button
        label={t("Ganti kata sandi", "Change password")}
        busy={action.busy}
        disabled={!current || next.length < 8 || next !== again}
        onPress={() => void save()}
      />
    </Editor>
  );
}
