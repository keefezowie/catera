import { useEffect, useRef, useState, type ReactNode } from "react";
import { Linking, View } from "react-native";
import { errorLabel } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { Button, Card, Field, FormError, MascotLoading, MoodHeader, Screen, Text, useBusy } from "@catera/mobile-ui";
import { BukaDapur, KonfirmasiDapur } from "./auth/BukaDapur";
import { clearHeldKitchen, readHeldKitchen, settlePending, takeHeldInvite, type PendingKitchen } from "./auth/pending";
import { tabsForRole } from "./roles";

const codeOf = (e: unknown) => (e as { code?: string }).code || (e as Error).message;

/**
 * An account with no kitchen can register one here, join one with a helper invite code, or go to the Catera app. The
 * first signed-in session after a confirmed Daftar or Gabung finishes it here (`settlePending`): the kitchen is made or
 * the invite accepted, then the actor is read again and the tabs open on Hari ini. This covers the email link and a later
 * Masuk alike. Details typed in Daftar before finding the email already had an account wait here to be confirmed.
 */
export function RoleGate({ children }: { children: ReactNode }) {
  const { runtime, actor, t, locale, logout, command, refresh } = useMobile();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [leaving, setLeaving] = useState(false);
  const gated = !!actor && !tabsForRole(actor.role).length;
  const who = actor ? `${actor.id}:${actor.role}` : "";
  // The account the pending sign-up was last settled for; a gated actor waits on it before the customer screen shows.
  const [settledFor, setSettledFor] = useState("");
  const [setupFailure, setSetupFailure] = useState<{ message: string; key: number } | null>(null);
  const [held, setHeld] = useState<PendingKitchen | null>(null);
  const [registering, setRegistering] = useState(false);
  const tried = useRef("");

  const settle = async () => {
    if (!actor) return;
    setSettledFor("");
    setSetupFailure(null);
    try {
      if (await settlePending(runtime, command, actor)) await refresh();
      else if (!tabsForRole(actor.role).length) {
        // A code typed on Gabung before "Masuk dulu".
        const heldCode = await takeHeldInvite(runtime);
        if (heldCode) setCode(heldCode);
        setHeld(await readHeldKitchen(runtime));
      } else await clearHeldKitchen(runtime);
    } catch (e) {
      const invite = (e as { invite?: string }).invite;
      if (invite) {
        setCode(invite);
        setError(t("Kode tidak ditemukan atau sudah dipakai.", "Code not found or already used."));
      } else
        setSetupFailure((f) => ({
          message: errorLabel(codeOf(e), locale) || t("Dapur belum bisa dibuat. Coba lagi.", "Couldn't set up your kitchen. Try again."),
          key: (f?.key ?? 0) + 1,
        }));
    } finally {
      setSettledFor(who);
    }
  };

  useEffect(() => {
    if (!who || tried.current === who) return;
    tried.current = who;
    void settle();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per account and role
  }, [who]);

  async function signOut() {
    if (leaving) return;
    setLeaving(true);
    try {
      // Signed out, the gate renders nothing of its own; a failure lets Keluar be tried again.
      await logout();
    } catch {
      setLeaving(false);
    }
  }

  const [busy, join] = useBusy(async () => {
    setError("");
    try {
      await command("invite.accept", { code: code.trim() });
      await refresh();
    } catch (e) {
      const c = codeOf(e);
      setError(
        c === "NOT_FOUND"
          ? t("Kode tidak ditemukan atau sudah dipakai.", "Code not found or already used.")
          : errorLabel(c, locale) || t("Belum bisa bergabung. Coba lagi.", "Couldn't join. Try again."),
      );
    }
  });

  /** Back to the gate from registering; what was typed in Daftar is let go. */
  const leave = () => {
    setRegistering(false);
    setHeld(null);
    void clearHeldKitchen(runtime);
  };

  const keluar = <Button variant="text" label={t("Keluar", "Sign out")} busy={leaving} onPress={() => void signOut()} />;

  if (gated && settledFor !== who) return <MascotLoading label={t("Menyiapkan dapurmu…", "Getting your kitchen ready…")} />;
  if (gated && setupFailure)
    return (
      <Screen header={<MoodHeader testID="rolegate-header" title={t("Dapurmu belum siap", "Your kitchen isn't ready")} />}>
        <View style={{ gap: 12 }}>
          <FormError message={setupFailure.message} failureKey={setupFailure.key} retry={() => void settle()} />
          {keluar}
        </View>
      </Screen>
    );
  if (gated && registering) return <BukaDapur initial={held} onLeave={leave} />;
  if (gated && held) return <KonfirmasiDapur kitchen={held} onEdit={() => setRegistering(true)} onLeave={leave} />;
  if (gated)
    return (
      <Screen header={<MoodHeader testID="rolegate-header" title={t("Punya usaha katering?", "Run a catering business?")} />}>
        <View style={{ gap: 12 }}>
          <Text>
            {t(
              "Daftarkan dapurmu dengan akun ini. Langgananmu di Catera tetap jalan seperti biasa.",
              "Register your kitchen with this account. Your Catera subscriptions keep running as usual.",
            )}
          </Text>
          <Button label={t("Daftarkan dapurmu", "Register your kitchen")} onPress={() => setRegistering(true)} />
          <Card tone="sage">
            <Text variant="heading">{t("Staf dapur?", "Kitchen staff?")}</Text>
            <Field
              label={t("Kode undangan", "Invite code")}
              value={code}
              onChangeText={setCode}
              autoCapitalize="none"
              autoCorrect={false}
              error={error || undefined}
            />
            <Button
              variant="secondary"
              label={t("Gabung ke dapur", "Join the kitchen")}
              busy={busy}
              disabled={!code.trim()}
              onPress={() => void join()}
            />
          </Card>
          <Button variant="text" label={t("Buka aplikasi Catera", "Open the Catera app")} onPress={() => void Linking.openURL("catera://")} />
          {/* Disabled while logout() lets go of this phone's push token (up to 3 s), so a second tap sends nothing. */}
          {keluar}
        </View>
      </Screen>
    );
  return <>{children}</>;
}
