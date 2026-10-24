import { useEffect, useState, type ReactNode } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { nativeLayout } from "@catera/design-tokens";
import {
  changePassword,
  listAccountRequests,
  PASSWORD_MIN,
  requestEmailChange,
  requestHelp,
  sendPhoneChangeCode,
  updateProfileName,
  useData,
  useMobile,
  verifyPhoneChangeCode,
} from "@catera/mobile-core";
import { Button, Card, Field, FormError, ReadError, Screen, SettingsRow, SettingsSection, Text, useBusy, useToast } from "@catera/mobile-ui";
import { accountMessage } from "./accountMessages";

/** A section's failed attempt: the words and a number that rises with every failure. */
type Failure = { message: string; key: number } | null;

/** One card of the page: its title, its fields and its action, each with its own busy state and `FormError`. */
function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <Card testID={`data-akun-card-${id}`}>
      <Text variant="section" accessibilityRole="header">
        {title}
      </Text>
      {note ? <Text variant="meta">{note}</Text> : null}
      {children}
    </Card>
  );
}

/**
 * Data akun (spec 5.10), reached from Pengaturan: the name, the phone number, the email, the password (email accounts
 * only), and for an owner the request to change the kitchen's name or contact. Deleting the account opens its own
 * confirm sheet. A change that waits on something outside the app (a code, a link in two inboxes) says so, and never
 * claims it is done. In demo mode nothing is sent and the page says so.
 */
export function DataAkun() {
  const { runtime, actor, demo, t, locale, command, refresh } = useMobile();
  const toast = useToast();
  const supabase = runtime.supabase ?? null;
  const owner = actor?.role === "owner";
  const catererId = actor?.catererId;
  const messageFor = (e: unknown, fallback: string) => accountMessage(e, t, locale, fallback);
  const bump = (f: Failure) => (f?.key ?? 0) + 1;

  // Nama.
  const [name, setName] = useState(actor?.name ?? "");
  const [nameFailure, setNameFailure] = useState<Failure>(null);
  const [savingName, saveName] = useBusy(async () => {
    setNameFailure(null);
    try {
      await updateProfileName(command, name);
      await refresh();
      toast.show({ message: t("Nama tersimpan", "Name saved"), tone: "success" });
    } catch (e) {
      setNameFailure((f) => ({ message: messageFor(e, t("Nama belum tersimpan. Coba lagi.", "The name was not saved. Try again.")), key: bump(f) }));
    }
  });

  // Nomor HP: a code to the new number, then the change.
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [phoneFailure, setPhoneFailure] = useState<Failure>(null);
  const [phoneNote, setPhoneNote] = useState("");
  const [sendingCode, sendCode] = useBusy(async () => {
    setPhoneFailure(null);
    setPhoneNote("");
    try {
      const result = await sendPhoneChangeCode(supabase, demo, phone);
      setCodeSent(true);
      setPhoneNote(
        result.simulated
          ? t("Demo (data contoh): tidak ada SMS yang dikirim. Isi enam angka apa saja.", "Demo (sample data): no SMS is sent. Enter any six digits.")
          : t("Kode dikirim lewat SMS ke nomor baru.", "A code was sent by SMS to the new number."),
      );
    } catch (e) {
      setPhoneFailure((f) => ({ message: messageFor(e, t("Kode belum terkirim. Coba lagi.", "The code was not sent. Try again.")), key: bump(f) }));
    }
  });
  const [verifying, verifyCode] = useBusy(async () => {
    setPhoneFailure(null);
    try {
      const result = await verifyPhoneChangeCode(supabase, demo, phone, code.trim());
      setCodeSent(false);
      setCode("");
      setPhone("");
      setPhoneNote(
        result.simulated
          ? t("Demo (data contoh): nomor tidak benar-benar diganti.", "Demo (sample data): the number is not really changed.")
          : t("Nomor HP diganti.", "Phone number changed."),
      );
      if (!result.simulated) await refresh();
    } catch (e) {
      setPhoneFailure((f) => ({ message: messageFor(e, t("Nomor belum diganti. Coba lagi.", "The number was not changed. Try again.")), key: bump(f) }));
    }
  });

  // Email: a link to both inboxes; nothing changes until both are opened.
  const [email, setEmail] = useState("");
  const [emailFailure, setEmailFailure] = useState<Failure>(null);
  const [emailNote, setEmailNote] = useState("");
  const [sendingEmail, sendEmail] = useBusy(async () => {
    setEmailFailure(null);
    setEmailNote("");
    try {
      const result = await requestEmailChange(supabase, demo, email);
      setEmailNote(
        result.simulated
          ? t("Demo (data contoh): tidak ada email yang dikirim.", "Demo (sample data): no email is sent.")
          : t(
              "Cek email lama dan email baru. Email berganti setelah kamu membuka tautan di keduanya.",
              "Check the old and the new inbox. The email changes once you open the link in both.",
            ),
      );
    } catch (e) {
      setEmailFailure((f) => ({ message: messageFor(e, t("Tautan belum terkirim. Coba lagi.", "The link was not sent. Try again.")), key: bump(f) }));
    }
  });

  // Kata sandi: only for an account that signs in with email.
  const [hasEmail, setHasEmail] = useState<boolean | null>(demo ? true : null);
  const [userReadFailed, setUserReadFailed] = useState(false);
  const [userReads, setUserReads] = useState(0);
  useEffect(() => {
    if (demo || !supabase) {
      setHasEmail(demo);
      return;
    }
    let live = true;
    setUserReadFailed(false);
    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (!live) return;
        if (error) setUserReadFailed(true);
        else setHasEmail(!!data.user?.email);
      })
      .catch(() => live && setUserReadFailed(true));
    return () => {
      live = false;
    };
  }, [demo, supabase, userReads]);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [passwordFailure, setPasswordFailure] = useState<Failure>(null);
  const [passwordNote, setPasswordNote] = useState("");
  const [changing, changeIt] = useBusy(async () => {
    setPasswordFailure(null);
    setPasswordNote("");
    try {
      const result = await changePassword(supabase, demo, { current, next });
      setCurrent("");
      setNext("");
      setPasswordNote(
        result.simulated
          ? t("Demo (data contoh): kata sandi tidak benar-benar diganti.", "Demo (sample data): the password is not really changed.")
          : t("Kata sandi diganti.", "Password changed."),
      );
    } catch (e) {
      setPasswordFailure((f) => ({ message: messageFor(e, t("Kata sandi belum diganti. Coba lagi.", "The password was not changed. Try again.")), key: bump(f) }));
    }
  });

  // Ubah nama atau kontak dapur: a request to Catera, with its status.
  const requests = useData(`account-requests:${actor?.id ?? ""}`, () => listAccountRequests(runtime.api));
  const latest = (requests.data ?? []).find((r) => r.kind === "help" && r.caterer_id === catererId);
  const [wanted, setWanted] = useState("");
  const [requestFailure, setRequestFailure] = useState<Failure>(null);
  const [sending, send] = useBusy(async () => {
    setRequestFailure(null);
    try {
      await requestHelp(command, `Ubah nama atau kontak dapur: ${wanted.trim()}`, catererId);
      setWanted("");
      await requests.reload();
      toast.show({ message: t("Permintaan terkirim", "Request sent"), tone: "success" });
    } catch (e) {
      setRequestFailure((f) => ({ message: messageFor(e, t("Permintaan belum terkirim. Coba lagi.", "The request was not sent. Try again.")), key: bump(f) }));
    }
  });

  const status = (r: NonNullable<typeof latest>) =>
    r.status === "open"
      ? t("Terkirim, menunggu Tim Catera.", "Sent, waiting for the Catera team.")
      : r.resolution
        ? t(`Selesai: ${r.resolution}`, `Done: ${r.resolution}`)
        : t("Selesai.", "Done.");

  return (
    <Screen>
      {demo ? (
        <Text variant="meta">
          {t("Demo (data contoh): perubahan di halaman ini tidak dikirim ke mana pun.", "Demo (sample data): changes on this page are not sent anywhere.")}
        </Text>
      ) : null}
      {/* One card per concern, the cards and the delete row 24 apart (the Dapur section gap). */}
      <View testID="data-akun-sections" style={{ gap: nativeLayout.dense.sectionGap }}>
        <Section id="name" title={t("Nama", "Name")}>
          <Field label={t("Nama kamu", "Your name")} value={name} onChangeText={setName} autoCapitalize="words" />
          {nameFailure ? <FormError message={nameFailure.message} failureKey={nameFailure.key} /> : null}
          <Button label={t("Simpan nama", "Save name")} busy={savingName} disabled={!name.trim() || name.trim() === actor?.name} onPress={() => void saveName()} />
        </Section>
        <Section id="phone" title={t("Nomor HP", "Phone number")} note={t("Kode dikirim ke nomor baru sebelum nomor berganti.", "A code goes to the new number before it changes.")}>
          <Field label={t("Nomor HP baru", "New phone number")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" editable={!codeSent} />
          {codeSent ? (
            <Field label={t("Kode dari SMS", "Code from SMS")} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" maxLength={6} />
          ) : null}
          {phoneNote ? <Text variant="meta">{phoneNote}</Text> : null}
          {phoneFailure ? <FormError message={phoneFailure.message} failureKey={phoneFailure.key} /> : null}
          {codeSent ? (
            <Button label={t("Ganti nomor", "Change number")} busy={verifying} disabled={code.trim().length < 6} onPress={() => void verifyCode()} />
          ) : (
            <>
              <Button label={t("Kirim kode", "Send code")} busy={sendingCode} disabled={phone.replace(/\D/g, "").length < 9} onPress={() => void sendCode()} />
              {phone.replace(/\D/g, "").length < 9 ? (
                <Text testID="phone-reason" variant="meta">
                  {t("Isi nomor HP baru, minimal 9 angka.", "Enter the new phone number, at least 9 digits.")}
                </Text>
              ) : null}
            </>
          )}
        </Section>
        <Section id="email" title="Email" note={t("Kamu mendapat tautan di email lama dan baru. Keduanya perlu dibuka.", "You get a link in the old and the new inbox. Both must be opened.")}>
          <Field label={t("Email baru", "New email")} value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" autoCapitalize="none" />
          {emailNote ? <Text variant="meta">{emailNote}</Text> : null}
          {emailFailure ? <FormError message={emailFailure.message} failureKey={emailFailure.key} /> : null}
          <Button label={t("Kirim tautan konfirmasi", "Send confirmation link")} busy={sendingEmail} disabled={!email.includes("@")} onPress={() => void sendEmail()} />
        </Section>
        {userReadFailed && hasEmail === null ? (
          <Section id="password" title={t("Kata sandi", "Password")}>
            <ReadError message={t("Belum bisa membaca akunmu.", "Couldn't read your account.")} onRetry={() => setUserReads((n) => n + 1)} />
          </Section>
        ) : null}
        {hasEmail ? (
          <Section id="password" title={t("Kata sandi", "Password")}>
            <Field label={t("Kata sandi saat ini", "Current password")} value={current} onChangeText={setCurrent} autoComplete="current-password" textContentType="password" secureTextEntry />
            <Field
              label={t("Kata sandi baru", "New password")}
              hint={t(`Minimal ${PASSWORD_MIN} karakter.`, `At least ${PASSWORD_MIN} characters.`)}
              value={next}
              onChangeText={setNext}
              autoComplete="new-password"
              textContentType="newPassword"
              secureTextEntry
            />
            {passwordNote ? <Text variant="meta">{passwordNote}</Text> : null}
            {passwordFailure ? <FormError message={passwordFailure.message} failureKey={passwordFailure.key} /> : null}
            <Button label={t("Ganti kata sandi", "Change password")} busy={changing} disabled={!current || next.length < PASSWORD_MIN} onPress={() => void changeIt()} />
          </Section>
        ) : null}
        {owner ? (
          <Section
            id="request"
            title={t("Ubah nama atau kontak dapur", "Change the kitchen's name or contact")}
            note={t("Tim Catera yang mengubahnya. Tulis apa yang perlu diganti.", "The Catera team makes the change. Write what needs to change.")}
          >
            {requests.error && !requests.data ? <ReadError message={requests.error} onRetry={() => void requests.reload()} /> : null}
            {latest ? (
              <Text testID="kitchen-request-status" variant="meta">
                {`${t("Permintaan terakhir", "Last request")}: ${status(latest)}`}
              </Text>
            ) : null}
            <Field label={t("Apa yang diubah?", "What should change?")} value={wanted} onChangeText={setWanted} multiline style={{ minHeight: 88, textAlignVertical: "top", paddingTop: 12 }} />
            {requestFailure ? <FormError message={requestFailure.message} failureKey={requestFailure.key} /> : null}
            <Button label={t("Kirim permintaan", "Send request")} busy={sending} disabled={wanted.trim().length < 5} onPress={() => void send()} />
            {wanted.trim().length < 5 ? (
              <Text testID="request-reason" variant="meta">
                {t("Tulis minimal 5 karakter.", "Write at least 5 characters.")}
              </Text>
            ) : null}
          </Section>
        ) : null}
        <SettingsSection>
          <SettingsRow label={t("Hapus akun", "Delete account")} tone="danger" onPress={() => router.push("/pengaturan/hapus-akun" as never)} />
        </SettingsSection>
      </View>
    </Screen>
  );
}
