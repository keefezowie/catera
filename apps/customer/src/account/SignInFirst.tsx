import type { ReactNode } from "react";
import { router } from "expo-router";
import { useMobile } from "@catera/mobile-core";
import { Button, MoodHeader, Screen, Text, useColors, useMoodColors } from "@catera/mobile-ui";

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
}: {
  title: string;
  next: string;
  children?: ReactNode;
  headerTestID?: string;
}) {
  const { t } = useMobile();
  const c = useColors();
  const mood = useMoodColors();
  const sentence = signInSentence(t);
  return (
    <Screen
      nativeTitle={headerTestID ? undefined : title}
      header={
        headerTestID ? (
          <MoodHeader testID={headerTestID} title={title}>
            <Text style={{ color: mood.headerMeta }}>{sentence}</Text>
          </MoodHeader>
        ) : undefined
      }
    >
      {headerTestID ? null : <Text style={{ color: c.muted }}>{sentence}</Text>}
      <Button
        label={t("Masuk", "Sign in")}
        onPress={() => router.push({ pathname: "/login", params: { next } } as never)}
      />
      {children}
    </Screen>
  );
}
