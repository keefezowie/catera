import { useEffect, useState, type ReactNode } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useData, useMobile } from "@catera/mobile-core";
import { MoodHeader, Screen, Skeleton, SkeletonGroup, Text, useMoodColors } from "@catera/mobile-ui";
import { localPhone } from "./localPhone";
import { Row, SectionLabel } from "./Row";
import { SignInFirst } from "./SignInFirst";
import { PlanList } from "../plan/PlanList";
import { ListSkeleton } from "../skeletons";
import { SettingsGear } from "../settings/Pengaturan";

export { localPhone };

/** The body text's line height: the contact line under the name holds this much even before it is known. */
const CONTACT_LINE = 23;

/** The row under the name in the header that carries the phone number (or email), one body line high in every state. */
function ContactLine({ children }: { children?: ReactNode }) {
  return (
    <View testID="akun-contact" style={{ minHeight: CONTACT_LINE, justifyContent: "center" }}>
      {children}
    </View>
  );
}

/** Akun: who is signed in, active plans and the account screens. No caterer or admin links. */
export function Akun() {
  const { actor, ready, t } = useMobile();
  // Before the session is known the tab already has its header, with the contact line's place held, so the header
  // keeps its height when the account lands; who is signed in, and their rows, wait.
  if (!ready)
    return (
      <Screen
        header={
          <MoodHeader title={t("Akun", "Account")}>
            <SkeletonGroup>
              <ContactLine>
                <Skeleton onMood width="44%" height={14} />
              </ContactLine>
            </SkeletonGroup>
          </MoodHeader>
        }
      >
        <ListSkeleton rows={4} label={t("Memuat akun", "Loading account")} />
      </Screen>
    );
  if (!actor)
    return (
      <SignInFirst title={t("Akun", "Account")} next="/akun" headerTestID="akun-header" trailing={<SettingsGear />}>
        {/* Language and theme live in Pengaturan, which needs no account. */}
        <View>
          <SettingsEntry first />
        </View>
      </SignInFirst>
    );
  return <Account key={actor.id} />;
}

/** The last row of Akun: Pengaturan holds notifications, language, theme, the app version and Keluar. */
function SettingsEntry({ first }: { first?: boolean }) {
  const { t } = useMobile();
  return <Row first={first} label={t("Pengaturan", "Settings")} onPress={() => router.push("/pengaturan" as never)} />;
}

/** The signed-in phone number (or email) from the device's own session. */
function useContact() {
  const { runtime } = useMobile();
  const [contact, setContact] = useState("");
  useEffect(() => {
    let live = true;
    void runtime.supabase?.auth
      .getSession()
      .then(({ data }) => {
        const user = data.session?.user;
        if (live) setContact(user?.phone ? localPhone(user.phone) : (user?.email ?? ""));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [runtime]);
  return contact;
}

function Account() {
  const { actor, runtime, t } = useMobile();
  const mood = useMoodColors();
  const customer = useData("akun:customer", () => runtime.api.customer());
  const contact = useContact();

  return (
    <Screen
      header={
        // The tab bar already names this tab, so the meta row holds only the settings gear rather than "Akun".
        <MoodHeader testID="akun-header" title={actor?.name ?? ""} trailing={<SettingsGear />}>
          {/* The line's place is held while the phone reads its session, so the header never grows under the name. */}
          <ContactLine>
            {contact ? <Text style={{ color: mood.headerMeta, fontVariant: ["tabular-nums"] }}>{contact}</Text> : null}
          </ContactLine>
        </MoodHeader>
      }
    >
      <View>
        <SectionLabel>{t("Paket aktif", "Active plans")}</SectionLabel>
        <PlanList customer={customer} />
      </View>

      <View>
        <Row first label={t("Data akun", "Account details")} onPress={() => router.push("/data-akun" as never)} />
        <Row label={t("Alamat", "Addresses")} onPress={() => router.push("/alamat" as never)} />
        <Row label={t("Disimpan", "Saved")} onPress={() => router.push("/disimpan" as never)} />
        <Row label={t("Riwayat pembayaran", "Payment history")} onPress={() => router.push("/pembayaran" as never)} />
        <Row label={t("Bantuan dan laporan", "Help and reports")} onPress={() => router.push("/bantuan" as never)} />
        <Row label={t("Notifikasi", "Notifications")} onPress={() => router.push("/notifications" as never)} />
        <SettingsEntry />
      </View>
    </Screen>
  );
}
