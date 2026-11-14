import type { ComponentProps, ReactNode } from "react";
import { View } from "react-native";
import type Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useMobile } from "@catera/mobile-core";
import { nativeLayout } from "@catera/design-tokens";
import { Button, DecorativeIcon, MoodHeader, Screen, StateArt, Text, useColors, useMoodInks } from "@catera/mobile-ui";
import { goToTab } from "../nav";

/** What a signed-out tab offers: a title and concrete lines about what the account holds. */
export type GuestPitch = { title: string; lines: { icon: ComponentProps<typeof Ionicons>["name"]; text: string }[] };

/** The one line every signed-out stand-in says; ReportProblem's sheet reads it from here too. */
export const signInSentence = (t: (id: string, en: string) => string) =>
  t("Masuk dulu untuk melihat paket dan jadwal pengantaranmu.", "Sign in to see your packages and deliveries.");

/**
 * Signed-out stand-in for screens that need an account: one way to sign in that comes back here.
 * A tab root passes `headerTestID` to open on the mood header, so its status icons never sit on the cream page.
 * Pushed screens leave it out: they sit under the stack's native header, so the title is the screen's native title
 * (iOS's large title, Android's content line) and the page does not print it again.
 */
export function SignInFirst({
  title,
  next,
  children,
  headerTestID,
  pitch,
}: {
  title: string;
  next: string;
  children?: ReactNode;
  headerTestID?: string;
  /** A tab root's welcome: mascot, title, benefit lines, Masuk atau daftar and a way back to browsing. */
  pitch?: GuestPitch;
}) {
  const { t } = useMobile();
  const c = useColors();
  const mood = useMoodInks();
  const sentence = signInSentence(t);
  return (
    <Screen
      nativeTitle={headerTestID ? undefined : title}
      header={
        headerTestID ? (
          <MoodHeader testID={headerTestID} title={title}>
            {pitch ? null : <Text style={{ color: mood.headerMeta }}>{sentence}</Text>}
          </MoodHeader>
        ) : undefined
      }
    >
      {pitch ? (
        <View testID="guest-pitch" style={{ gap: nativeLayout.space.lg }}>
          <StateArt pose="melambai" />
          <Text variant="heading" accessibilityRole="header" style={{ textAlign: "center" }}>
            {pitch.title}
          </Text>
          <View style={{ gap: nativeLayout.space.md }}>
            {pitch.lines.map((line) => (
              <View key={line.text} style={{ flexDirection: "row", alignItems: "center", gap: nativeLayout.space.md }}>
                <DecorativeIcon name={line.icon} size={22} color={c.forest} />
                <Text style={{ flex: 1 }}>{line.text}</Text>
              </View>
            ))}
          </View>
          <View style={{ gap: nativeLayout.space.sm }}>
            <Button
              label={t("Masuk atau daftar", "Sign in or sign up")}
              onPress={() => router.push({ pathname: "/login", params: { next } } as never)}
            />
            <Button variant="secondary" label={t("Lihat paket dulu", "Browse packages first")} onPress={() => goToTab("jelajah")} />
          </View>
        </View>
      ) : (
        <>
          {headerTestID ? null : <Text style={{ color: c.muted }}>{sentence}</Text>}
          <Button
            label={t("Masuk", "Sign in")}
            onPress={() => router.push({ pathname: "/login", params: { next } } as never)}
          />
        </>
      )}
      {children}
    </Screen>
  );
}
