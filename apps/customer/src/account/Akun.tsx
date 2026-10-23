import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { nativeLayout } from "@catera/design-tokens";
import { useData, useMobile } from "@catera/mobile-core";
import { fonts, MoodHeader, Screen, Skeleton, SkeletonGroup, Text, themedStyles, useColors, useMoodColors } from "@catera/mobile-ui";
import { localPhone } from "./localPhone";
import { AkunTiles } from "./AkunTiles";
import { SignInFirst } from "./SignInFirst";
import { BARE_GLYPH_INSET, DecorativeIcon, GlyphRow, ListCard } from "../layout";
import { AkunSkeleton } from "../skeletons";

export { localPhone };

/** The avatar disc, and the contact line under the name (one `meta` line high even before it is known). */
const AVATAR = 56;
const CONTACT_LINE = 18;

/** The contact line under the avatar row in the header that carries the phone number (or email), one line high in every state. */
function ContactLine({ children }: { children?: ReactNode }) {
  return (
    <View testID="akun-contact" style={{ minHeight: CONTACT_LINE, justifyContent: "center" }}>
      {children}
    </View>
  );
}

/** Up to two initials of a name: "Rani Contoh" is "RC", "Rani" is "R". */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0]?.toUpperCase() ?? "")
    .join("");
}

/** Akun: who is signed in, three shortcut tiles and the account screens. No plans, no caterer or admin links. */
export function Akun() {
  const { actor, ready, t } = useMobile();
  // Before the session is known the tab already has its header (the avatar and name's place held) and the body's
  // shape, so the page keeps its height when the account lands; who is signed in, and their rows, wait.
  if (!ready)
    return (
      <Screen
        header={
          <MoodHeader
            meta={
              <SkeletonGroup>
                <View style={{ flexDirection: "row", alignItems: "center", gap: nativeLayout.space.lg }}>
                  <Skeleton onMood width={AVATAR} height={AVATAR} radius={AVATAR / 2} />
                  <Skeleton onMood width="44%" height={20} />
                </View>
              </SkeletonGroup>
            }
            title={null}
          >
            <ContactLine>
              <SkeletonGroup>
                <Skeleton onMood width="36%" height={12} />
              </SkeletonGroup>
            </ContactLine>
          </MoodHeader>
        }
      >
        <AkunSkeleton />
      </Screen>
    );
  if (!actor)
    return (
      <SignInFirst title={t("Akun", "Account")} next="/akun" headerTestID="akun-header">
        {/* Language and theme live in Pengaturan, which needs no account. */}
        <ListCard inset={BARE_GLYPH_INSET}>
          <SettingsEntry />
        </ListCard>
      </SignInFirst>
    );
  return <Account key={actor.id} />;
}

type Glyph = ComponentProps<typeof Ionicons>["name"];

/** One row of Akun's card: a bare 20 glyph, the title (it wraps at large text) and a chevron, 56 tall. */
function AccountRow({ glyph, title, meta, href }: { glyph: Glyph; title: string; meta?: string; href: string }) {
  const c = useColors();
  return (
    <GlyphRow
      bare
      wrap
      glyph={<DecorativeIcon name={glyph} size={20} color={c.muted} />}
      title={title}
      meta={meta}
      trailing={<DecorativeIcon name="chevron-forward" size={20} color={c.muted} />}
      onPress={() => router.push(href as never)}
    />
  );
}

/** The last row of Akun: Pengaturan holds notifications, language, theme, the app version and Keluar. */
function SettingsEntry() {
  const { t } = useMobile();
  return (
    <AccountRow
      glyph="settings-outline"
      title={t("Pengaturan", "Settings")}
      meta={t("Bahasa, tampilan", "Language, appearance")}
      href="/pengaturan"
    />
  );
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
  const c = useColors();
  const styles = useStyles();
  const customer = useData("akun:customer", () => runtime.api.customer());
  const contact = useContact();
  const name = actor?.name ?? "";
  const plans = customer.data ? customer.data.subscriptions.filter((s) => s.status === "active").length : null;
  const addresses = customer.data ? customer.data.addresses.length : null;

  return (
    <Screen
      header={
        // The tab bar already names this tab, so the header's top row holds the avatar and the name instead. The
        // settings gear is gone: Pengaturan is the card row below.
        <MoodHeader
          testID="akun-header"
          meta={
            <View style={styles.identity}>
              <View
                testID="akun-avatar"
                accessible={false}
                importantForAccessibility="no-hide-descendants"
                style={[styles.avatar, { backgroundColor: c.surface }]}
              >
                <Text variant="rowTitle" style={{ fontFamily: fonts.bold }}>
                  {initialsOf(name)}
                </Text>
              </View>
              <Text variant="heroTitle" accessibilityRole="header" style={[styles.name, { color: mood.headerText }]}>
                {name}
              </Text>
            </View>
          }
          title={null}
        >
          {/* The line's place is held while the phone reads its session, so the header never grows under the name. */}
          <ContactLine>
            {contact ? (
              <Text variant="meta" style={{ color: mood.headerMeta, fontVariant: ["tabular-nums"] }}>
                {contact}
              </Text>
            ) : null}
          </ContactLine>
        </MoodHeader>
      }
    >
      <View style={styles.sections}>
        <AkunTiles plans={plans} addresses={addresses} loading={customer.loading} />
        <View style={styles.cards}>
          <ListCard inset={BARE_GLYPH_INSET}>
            <AccountRow glyph="person-outline" title={t("Data akun", "Account details")} href="/data-akun" />
            <AccountRow glyph="heart-outline" title={t("Disimpan", "Saved")} href="/disimpan" />
            <AccountRow glyph="notifications-outline" title={t("Notifikasi", "Notifications")} href="/notifications" />
            <AccountRow glyph="help-circle-outline" title={t("Bantuan dan laporan", "Help and reports")} href="/bantuan" />
          </ListCard>
          <ListCard inset={BARE_GLYPH_INSET}>
            <SettingsEntry />
          </ListCard>
        </View>
      </View>
    </Screen>
  );
}

const useStyles = themedStyles(() => ({
  // The tiles sit 32 above the cards; the two cards sit 16 apart.
  sections: { gap: nativeLayout.sectionGap },
  cards: { gap: nativeLayout.space.lg },
  identity: { flexDirection: "row", alignItems: "center", gap: nativeLayout.space.lg },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, alignItems: "center", justifyContent: "center" },
  name: { flex: 1 },
}));
