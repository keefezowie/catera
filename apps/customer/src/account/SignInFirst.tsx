import type { ReactNode } from "react";
import { router } from "expo-router";
import { useMobile } from "@catera/mobile-core";
import { Button, MoodHeader, Screen, Text, useMoodColors } from "@catera/mobile-ui";

/**
 * Signed-out stand-in for screens that need an account: one way to sign in that comes back here. It opens with the
 * mood header like the signed-in screen does, so the status icons never sit on the cream page.
 */
export function SignInFirst({
  title,
  next,
  children,
  headerTestID = "signin-header",
}: {
  title: string;
  next: string;
  children?: ReactNode;
  headerTestID?: string;
}) {
  const { t } = useMobile();
  const mood = useMoodColors();
  return (
    <Screen
      header={
        <MoodHeader testID={headerTestID} title={title}>
          <Text style={{ color: mood.headerMeta }}>
            {t("Masuk untuk melihat paket dan jadwal antar Anda.", "Sign in to see your packages and deliveries.")}
          </Text>
        </MoodHeader>
      }
    >
      <Button
        label={t("Masuk", "Sign in")}
        onPress={() => router.push({ pathname: "/login", params: { next } } as never)}
      />
      {children}
    </Screen>
  );
}
