import { useEffect, useState, type ReactNode } from "react";
import { Linking, View } from "react-native";
import { router } from "expo-router";
import { nativeLayout } from "@catera/design-tokens";
import {
  changePassword,
  listAccountRequests,
  PASSWORD_MIN,
  requestEmailChange,
  requestHelp,
  updateProfileName,
  useData,
  useMobile,
} from "@catera/mobile-core";
import { Button, Card, Field, FormError, ReadError, Screen, SettingsRow, SettingsSection, Text, useBusy, useColors, useToast } from "@catera/mobile-ui";
import { waCheck } from "../auth/checks";
import { e164Indonesia, waLink } from "../onboarding";
import { accountMessage } from "./accountMessages";

/** The kitchen's stored +62 number as people type it (0812…). */
const localNumber = (e164: string | null) => (e164 ? "0" + e164.replace(/^\+62/, "") : "");

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
 * A sign-in row of the canvas: its label, the current value under it and "Ganti" at the trailing edge, which opens the
 * change form under the row (and closes it again).
 */
function AccountRow({
  id,
  label,
  value,
  open,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const { t } = useMobile();
  const c = useColors();
  const what = label.toLowerCase();
  return (
    <View testID={`data-akun-row-${id}`} style={{ borderBottomWidth: 1, borderBottomColor: c.line }}>
      <View style={{ minHeight: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: nativeLayout.groupGap }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label">{label}</Text>
          {value ? (
            <Text selectable style={{ color: c.muted }}>
              {value}
            </Text>
          ) : null}
        </View>
        <Button
          variant="text"
          label={open ? t("Tutup", "Close") : t("Ganti", "Change")}
          accessibilityLabel={open ? t(`Tutup ganti ${what}`, `Close change ${what}`) : t(`Ganti ${what}`, `Change ${what}`)}
          onPress={onToggle}
        />
      </View>
      {open ? <View style={{ gap: nativeLayout.groupGap, paddingBottom: nativeLayout.space.lg }}>{children}</View> : null}
    </View>
  );
}

/**
 * Data akun (spec 5.10, the approved canvas), reached from Pengaturan: the name, the kitchen's WhatsApp (owner only), then
 * the email and the password (email accounts only) as rows whose "Ganti" opens their change form, and for an owner the
 * request to change the kitchen's name or contact. Deleting the account opens its own
 * confirm sheet. A change that waits on something outside the app (a link in two inboxes) says so, and never
 * claims it is done. In demo mode the page says what is kept and what is only pretended.
 */
export function DataAkun() {
  const { runtime, actor, demo, t, locale, command, refresh } = useMobile();
  const toast = useToast();
  const c = useColors();
  const supabase = runtime.supabase ?? null;
  const owner = actor?.role === "owner";
  const catererId = actor?.catererId;
  const messageFor = (e: unknown, fallback: string) => accountMessage(e, t, locale, fallback);
  const bump = (f: Failure) => (f?.key ?? 0) + 1;

  // Nama.
  // Null until edited, so the field shows the account name as soon as it is read.
  const [typedName, setName] = useState<string | null>(null);
  const name = typedName ?? actor?.name ?? "";
  const [nameFailure, setNameFailure] = useState<Failure>(null);
  const [savingName, saveName] = useBusy(async () => {
    setNameFailure(null);
    try {
      await updateProfileName(command, name);
      await refresh();
      toast.show({ message: t("Nama tersimpan", "Name saved"), tone: "success" });
    } catch (e) {
      setNameFailure((f) => ({ message: messageFor(e, t("Nama belum tersimpan. Coba lagi.", "Couldn't save the name. Try again.")), key: bump(f) }));
    }
  });

  // Nomor WhatsApp dapur (owner only): a plain number customers reach the kitchen on, saved by seller.whatsapp.
  const seller = useData(`data-akun-seller:${catererId ?? ""}`, async () => (owner && catererId ? runtime.api.sellerOperations(catererId) : null));
  const savedWa = seller.data?.caterer.whatsapp ?? null;
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const waValue = whatsapp ?? localNumber(savedWa);
  const waProblem = waValue.trim() ? waCheck(t)(waValue) : "";
  const [waFailure, setWaFailure] = useState<Failure>(null);
  const [savingWa, saveWa] = useBusy(async () => {
    setWaFailure(null);
    try {
      // The kitchen this page is about, named, so an owner of more than one never writes to another.
      await command("seller.whatsapp", { whatsapp: waValue.trim() ? e164Indonesia(waValue) : null, catererId });
      // The typed value stays on screen until the read carries the saved one, so the field never flashes empty.
      await seller.reload();
      setWhatsapp(null);
      toast.show({ message: t("Nomor tersimpan", "Number saved"), tone: "success" });
    } catch (e) {
      setWaFailure((f) => ({ message: messageFor(e, t("Nomor belum tersimpan. Coba lagi.", "Couldn't save the number. Try again.")), key: bump(f) }));
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
      setEmailFailure((f) => ({ message: messageFor(e, t("Tautan belum terkirim. Coba lagi.", "Couldn't send the link. Try again.")), key: bump(f) }));
    }
  });

  // Kata sandi: only for an account that signs in with email.
  const [hasEmail, setHasEmail] = useState<boolean | null>(demo ? true : null);
  const [accountEmail, setAccountEmail] = useState("");
  // Which sign-in row has its change form open under it ("Ganti").
  const [editing, setEditing] = useState<"" | "email" | "password">("");
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
        else {
          setHasEmail(!!data.user?.email);
          setAccountEmail(data.user?.email ?? "");
        }
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
      setPasswordFailure((f) => ({ message: messageFor(e, t("Kata sandi belum diganti. Coba lagi.", "Couldn't change the password. Try again.")), key: bump(f) }));
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
      setRequestFailure((f) => ({ message: messageFor(e, t("Permintaan belum terkirim. Coba lagi.", "Couldn't send the request. Try again.")), key: bump(f) }));
    }
  });

  const requestReason = t("Tulis minimal 5 karakter.", "Write at least 5 characters.");

  const status = (r: NonNullable<typeof latest>) =>
    r.status === "open"
      ? t("Terkirim, menunggu Tim Catera.", "Sent, waiting for the Catera team.")
      : r.resolution
        ? t(`Selesai: ${r.resolution}`, `Done: ${r.resolution}`)
        : t("Selesai.", "Done.");

  return (
    <Screen nativeTitle={t("Data akun", "Account data")}>
      {demo ? (
        <Text variant="meta">
          {t(
            "Demo (data contoh): nama dan nomor WhatsApp tersimpan di data contoh. Email dan kata sandi tidak benar-benar diganti.",
            "Demo (sample data): the name and WhatsApp number are saved to the sample data. The email and password are not really changed.",
          )}
        </Text>
      ) : null}
      {/* One flat form (the approved canvas): the fields, then the sign-in rows, the groups 24 apart (the Dapur section gap). */}
      <View testID="data-akun-sections" style={{ gap: nativeLayout.dense.sectionGap }}>
        <View testID="data-akun-name" style={{ gap: nativeLayout.groupGap }}>
          <Field label={t("Nama", "Name")} value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" textContentType="name" />
          {nameFailure ? <FormError message={nameFailure.message} failureKey={nameFailure.key} /> : null}
          {name.trim() !== (actor?.name ?? "") || nameFailure ? (
            <Button
              variant="secondary"
              label={t("Simpan nama", "Save name")}
              busy={savingName}
              disabled={!name.trim()}
              style={{ alignSelf: "flex-end" }}
              onPress={() => void saveName()}
            />
          ) : null}
        </View>
        {owner ? (
          <View testID="data-akun-whatsapp" style={{ gap: nativeLayout.groupGap }}>
            {seller.error && !seller.data ? <ReadError message={seller.error} onRetry={() => void seller.reload()} /> : null}
            <Field
              label={t("Nomor WhatsApp dapur", "Kitchen WhatsApp number")}
              hint={t("Pelanggan menghubungimu lewat nomor ini. Tidak dipakai untuk masuk.", "Customers reach you on this number. It isn't used to sign in.")}
              error={waProblem || undefined}
              value={waValue}
              onChangeText={setWhatsapp}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
            />
            {waFailure ? <FormError message={waFailure.message} failureKey={waFailure.key} /> : null}
            <View testID="data-akun-wa-actions" style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: nativeLayout.groupGap }}>
              <Button
                variant="text"
                label={t("Cek di WhatsApp", "Check in WhatsApp")}
                trailingIcon="open-outline"
                disabled={!waValue.trim() || !!waProblem}
                onPress={() => void Linking.openURL(waLink(waValue)).catch(() => undefined)}
              />
              <Button
                variant="secondary"
                label={t("Simpan nomor", "Save number")}
                busy={savingWa}
                disabled={!!waProblem || !seller.data || (whatsapp ?? null) === null}
                onPress={() => void saveWa()}
              />
            </View>
          </View>
        ) : null}
        <View testID="data-akun-rows" style={{ borderTopWidth: 1, borderTopColor: c.line }}>
          <AccountRow
            id="email"
            label="Email"
            value={accountEmail}
            open={editing === "email"}
            onToggle={() => setEditing((e) => (e === "email" ? "" : "email"))}
          >
            <Text variant="meta">{t("Kamu mendapat tautan di email lama dan baru. Keduanya perlu dibuka.", "You get a link in the old and the new inbox. Both must be opened.")}</Text>
            <Field label={t("Email baru", "New email")} value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" autoCapitalize="none" />
            {emailNote ? <Text variant="meta">{emailNote}</Text> : null}
            {emailFailure ? <FormError message={emailFailure.message} failureKey={emailFailure.key} /> : null}
            <Button label={t("Kirim tautan konfirmasi", "Send confirmation link")} busy={sendingEmail} disabled={!email.includes("@")} onPress={() => void sendEmail()} />
          </AccountRow>
          {userReadFailed && hasEmail === null ? (
            <View style={{ paddingVertical: nativeLayout.groupGap }}>
              <ReadError message={t("Belum bisa membaca akunmu.", "Couldn't read your account.")} onRetry={() => setUserReads((n) => n + 1)} />
            </View>
          ) : null}
          {hasEmail ? (
            <AccountRow
              id="password"
              label={t("Kata sandi", "Password")}
              value="••••••••"
              open={editing === "password"}
              onToggle={() => setEditing((e) => (e === "password" ? "" : "password"))}
            >
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
            </AccountRow>
          ) : null}
        </View>
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
            <Button
              label={t("Kirim permintaan", "Send request")}
              busy={sending}
              disabled={wanted.trim().length < 5}
              accessibilityHint={wanted.trim().length < 5 ? requestReason : undefined}
              onPress={() => void send()}
            />
            <View style={{ minHeight: 18 }}>
              {wanted.trim().length < 5 ? (
                <Text testID="request-reason" variant="meta">
                  {requestReason}
                </Text>
              ) : null}
            </View>
          </Section>
        ) : null}
        <SettingsSection>
          <SettingsRow label={t("Hapus akun", "Delete account")} tone="danger" onPress={() => router.push("/pengaturan/hapus-akun" as never)} />
        </SettingsSection>
      </View>
    </Screen>
  );
}
