import { useEffect, useRef, useState } from "react";
import { Image, View } from "react-native";
import * as Crypto from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { errorLabel, localCustomerPhone, phoneMatchesMask, shortDate, type Actor, type ClaimPreview } from "@catera/domain";
import { plural, useMobile } from "@catera/mobile-core";
import {
  authFields,
  AuthHeading,
  AuthScreen,
  Button,
  Field,
  fontFor,
  FormError,
  MascotLoading,
  ReadError,
  Screen,
  Text,
  themedStyles,
  useBusy,
  useColors,
} from "@catera/mobile-ui";
import { clearPending, redirectTo } from "../account/emailAuth";
import { authFailure } from "../account/failure";
import { LegalLine } from "../account/LegalLine";
import { Lengkapi, lengkapiNeeded, type LengkapiInfo } from "../account/Lengkapi";
import { SignInProviders, useAppleAvailable } from "../account/Masuk";
import { e164 } from "../account/phone";
import { goToTab } from "../nav";

/** Failures worth retrying; every other code means this link cannot be used. */
const TRANSIENT = ["REQUEST_TIMEOUT", "REQUEST_FAILED", "INVALID_API_RESPONSE", "AUTH_RATE_LIMITED", "RATE_LIMITED", "NOT_CONFIGURED"];
const codeOf = (e: unknown) => (e as { code?: string }).code || (e as Error).message || "";
const transient = (e: unknown) => {
  const code = codeOf(e);
  return !(e as { code?: string }).code || TRANSIENT.includes(code);
};

/** A caterer's claim link: sign in (Apple, Google or email), then the number the caterer recorded, then Beranda. */
export function ClaimScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { runtime, actor, command, signedIn, t, locale } = useMobile();
  const [preview, setPreview] = useState<ClaimPreview | null>(null);
  const [dead, setDead] = useState(false);
  const [offline, setOffline] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [phone, setPhone] = useState(actor?.phone ? localCustomerPhone(actor.phone).replace(/-/g, " ") : "");
  const [error, setError] = useState("");
  const [failures, setFailures] = useState(0);
  const [review, setReview] = useState(false);
  const [lengkapi, setLengkapi] = useState<LengkapiInfo | null>(null);
  const [waiting, setWaiting] = useState("");
  const lock = useRef(false);
  const apple = useAppleAvailable();

  // Read once per token: after a claim the same token answers NOT_FOUND.
  useEffect(() => {
    let live = true;
    setOffline(false);
    runtime.api
      .claimPreview(String(token ?? ""))
      .then((p) => live && setPreview(p))
      .catch((e) => {
        if (!live) return;
        if (transient(e)) setOffline(true);
        else setDead(true);
      });
    return () => {
      live = false;
    };
  }, [runtime, token, attempt]);

  // A number Lengkapi akun just saved fills the field, unless something is typed already.
  useEffect(() => {
    if (actor?.phone) setPhone((now) => now || localCustomerPhone(actor.phone!).replace(/-/g, " "));
  }, [actor?.phone]);

  const fail = (message: string) => {
    setError(message);
    setFailures((n) => n + 1);
  };

  // Apple or Google right here; the claim stays on screen and turns into the number step once signed in.
  async function provider(which: "apple" | "google", go: () => Promise<Actor>) {
    if (lock.current) return;
    lock.current = true;
    setWaiting(which);
    setError("");
    try {
      const signed = await go();
      // As in Masuk: a pending sign-up link lost its PKCE verifier to this sign-in.
      await clearPending(runtime).catch(() => undefined);
      await signedIn(signed);
      const need = await lengkapiNeeded(runtime, signed);
      if (need) setLengkapi(need);
    } catch (e) {
      if (codeOf(e) !== "CANCELLED") fail(authFailure(e, locale, t));
    } finally {
      lock.current = false;
      setWaiting("");
    }
  }

  // `useBusy` drops a second press that lands while one is running, before `busy` has re-rendered.
  const [busy, run] = useBusy(async (work: () => Promise<void>) => {
    setError("");
    try {
      await work();
    } catch (e) {
      fail(errorLabel(codeOf(e), locale) || t("Belum bisa menyambungkan langganan. Coba lagi.", "Couldn't connect the subscription. Try again."));
    }
  });

  // `preview` is set by the time the number step shows.
  async function connect(recorded: ClaimPreview) {
    const katering = recorded.catererName;
    const number = e164(phone);
    if (!number)
      return fail(t("Nomornya belum benar. Contoh: 0812 3456 7890", "That number doesn't look right. Example: 0812 3456 7890"));
    // Another number could never claim this link: say so before asking the server.
    if (!phoneMatchesMask(number, recorded.maskedPhone))
      return fail(
        t(
          `Nomor ini beda dengan yang dicatat ${katering}. Pakai nomor yang kamu berikan ke mereka, atau minta mereka memperbarui nomormu.`,
          `This number doesn't match the one ${katering} has. Use the number you gave them, or ask them to update it.`,
        ),
      );
    let result: { status?: string };
    try {
      result = await command<{ status?: string }>("customer.claim", { token: String(token), phone: number });
    } catch (e) {
      if (transient(e)) throw e;
      const c = codeOf(e);
      // The server cannot tell a different number from a spent link, so both are said, with both ways out.
      if (c === "CLAIM_UNAVAILABLE")
        return fail(
          t(
            `Nomornya belum cocok dengan catatan ${katering}, atau tautannya sudah tidak berlaku. Periksa nomornya, atau minta tautan baru ke ${katering}.`,
            `The number doesn't match ${katering}'s record, or the link no longer works. Check the number, or ask ${katering} for a new link.`,
          ),
        );
      if (c === "INVALID_INPUT") throw e;
      setDead(true);
      return;
    }
    if (result.status === "review") setReview(true);
    else goToTab("index");
  }

  // A link can open the app cold with no screen behind this one. The header's Close then lands on Beranda, and the
  // dead-link and offline states also offer Beranda in the page, so there is always a way into the app.
  const home = (
    <Button variant="secondary" label={t("Ke Beranda", "Go to Home")} onPress={() => goToTab("index")} />
  );
  if (lengkapi) return <Lengkapi info={lengkapi} onDone={() => setLengkapi(null)} />;
  if (dead)
    return (
      <Screen nativeTitle={t("Tautan tidak bisa dipakai", "This link can't be used")}>
        <Header />
        <Text style={{ fontFamily: fontFor("700") }} testID="claim-dead">
          {t(
            "Tautan ini tidak bisa dipakai. Minta tautan baru ke kateringmu.",
            "This link can't be used. Ask your caterer for a new one.",
          )}
        </Text>
        {home}
      </Screen>
    );
  if (offline)
    return (
      <Screen nativeTitle={t("Belum bisa memuat", "Couldn't load")}>
        <Header />
        <ReadError
          art
          message={t("Belum bisa memuat. Periksa koneksi lalu coba lagi.", "Couldn't load. Check your connection and try again.")}
          onRetry={() => setAttempt((n) => n + 1)}
        />
        {home}
      </Screen>
    );
  if (!preview)
    return (
      <Screen nativeTitle={t("Membuka tautan", "Opening the link")}>
        <Header />
        {/* Nothing of the link can be shown until it is read, so the wait is the mascot with what it is doing. */}
        <MascotLoading label={t("Membuka tautan…", "Opening the link…")} />
      </Screen>
    );
  const katering = preview.catererName;
  if (review)
    return (
      <Screen nativeTitle={t("Perlu dicek dulu", "Needs a check first")}>
        <Text>
          {t(
            `${katering} perlu mengecek langganan ini dulu. Pengantaranmu tetap jalan.`,
            `${katering} needs to check this subscription first. Your deliveries carry on.`,
          )}
        </Text>
        <Button label={t("Ke Beranda", "Go to Home")} onPress={() => goToTab("index")} />
      </Screen>
    );

  const formError = error ? <FormError message={error} failureKey={failures} testID="claim-error" /> : null;

  if (!actor)
    return (
      <AuthScreen revealKey={failures} footer={<LegalLine />}>
        <AuthHeading
          title={t("Langgananmu sudah menunggu", "Your subscription is waiting")}
          subtitle={t(
            `${katering} mencatat langgananmu. Masuk dulu supaya jadwal dan tagihannya tersambung ke akunmu.`,
            `${katering} recorded your subscription. Sign in first so its schedule and bills connect to your account.`,
          )}
        />
        <PackageCard preview={preview} withAddress />
        <SignInProviders
          apple={apple}
          waiting={waiting}
          busy={!!waiting}
          onApple={() => void provider("apple", () => runtime.signInWithApple(Crypto.randomUUID()))}
          onGoogle={() => void provider("google", () => runtime.signInWithGoogle(redirectTo(), Crypto.randomUUID()))}
          onEmail={() => router.replace({ pathname: "/login", params: { next: `/claim/${token}`, method: "email" } } as never)}
        />
        {formError}
      </AuthScreen>
    );

  const last4 = /(\d{4})$/.exec(preview.maskedPhone)?.[1];
  return (
    <AuthScreen
      revealKey={failures}
      footer={
        <View style={{ gap: 12 }}>
          <SignedInAs fallback={actor.name} />
          <Button label={t("Sambungkan", "Connect")} busy={busy} onPress={() => void run(() => connect(preview))} />
        </View>
      }
    >
      <AuthHeading
        title={t("Sambungkan langgananmu", "Connect your subscription")}
        subtitle={t(
          `Masukkan nomor yang kamu berikan ke ${katering}. Kalau cocok, langganannya pindah ke akunmu.`,
          `Enter the number you gave ${katering}. If it matches, the subscription moves to your account.`,
        )}
      />
      <PackageCard preview={preview} />
      <Field
        label={t("Nomor HP", "Phone number")}
        {...authFields.phone}
        value={phone}
        onChangeText={setPhone}
        placeholder="0812…"
        editable={!busy}
        hint={
          last4
            ? t(`${katering} mencatat nomor berakhiran ••• ${last4}.`, `${katering} recorded a number ending in ••• ${last4}.`)
            : undefined
        }
        returnKeyType="go"
        onSubmitEditing={() => void run(() => connect(preview))}
      />
      {formError}
    </AuthScreen>
  );
}

/** "Masuk sebagai keefe@gmail.com": the account the subscription will move to. */
function SignedInAs({ fallback }: { fallback: string }) {
  const { runtime, t } = useMobile();
  const [email, setEmail] = useState("");
  useEffect(() => {
    let live = true;
    void runtime.supabase?.auth
      .getSession()
      .then(({ data }) => live && setEmail(data?.session?.user?.email ?? ""))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [runtime]);
  const who = email || fallback;
  if (!who) return null;
  return (
    <Text variant="caption" style={{ textAlign: "center" }}>
      {t(`Masuk sebagai ${who}`, `Signed in as ${who}`)}
    </Text>
  );
}

function PackageCard({ preview, withAddress = false }: { preview: ClaimPreview; withAddress?: boolean }) {
  const { t, locale } = useMobile();
  const styles = useStyles();
  const c = useColors();
  const days = t(`Sisa ${preview.remainingDays} hari`, `${plural(preview.remainingDays, "day")} left`);
  const next = preview.nextDate
    ? t(" · antar berikutnya ", " · next delivery ") + shortDate(preview.nextDate, locale) + (preview.nextWindow ? `, ${preview.nextWindow}` : "")
    : "";
  return (
    <View style={styles.card} testID="claim-package">
      <Text style={{ fontSize: 16, fontFamily: fontFor("700"), color: c.charcoal }}>{preview.packageName}</Text>
      <Text variant="caption" style={{ fontSize: 14 }}>{days + next}</Text>
      {withAddress ? <Text variant="caption" style={{ fontSize: 14 }}>{preview.addressLabel}</Text> : null}
    </View>
  );
}

/** The illustrated wordmark, kept in the page body on the loading, dead-link and offline states. */
function Header() {
  const styles = useStyles();
  return (
    <View style={styles.header}>
      <Image
        source={require("../../../../packages/brand/assets/wordmark.png")}
        accessibilityLabel="Catera"
        style={{ height: 24, width: 72 }}
        resizeMode="contain"
      />
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  header: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 4 },
  card: { borderWidth: 1, borderColor: c.line, borderRadius: 16, borderCurve: "continuous", padding: 16, gap: 4, marginTop: 8 },
}));
