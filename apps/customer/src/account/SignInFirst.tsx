import type { ReactNode } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useMobile } from "@catera/mobile-core";
import { Button, MoodHeader, Screen, Text, useColors, useMoodColors } from "@catera/mobile-ui";

/**
 * Signed-out stand-in for screens that need an account: one way to sign in that comes back here.
 * A tab root passes `headerTestID` to open on the mood header, so its status icons never sit on the cream page.
 * Pushed screens leave it out: they already sit under the Stack's own header and keep a plain title.
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
  const sentence = t("Masuk untuk melihat paket dan jadwal antar Anda.", "Sign in to see your packages and deliveries.");
  return (
    <Screen
      header={
        headerTestID ? (
          <MoodHeader testID={headerTestID} title={title}>
            <Text style={{ color: mood.headerMeta }}>{sentence}</Text>
          </MoodHeader>
        ) : undefined
      }
    >
      {headerTestID ? null : (
        <View style={{ gap: 6, paddingTop: 8 }}>
          <Text variant="title">{title}</Text>
          <Text style={{ color: c.muted }}>{sentence}</Text>
        </View>
      )}
      <Button
        label={t("Masuk", "Sign in")}
        onPress={() => router.push({ pathname: "/login", params: { next } } as never)}
      />
      {children}
    </Screen>
  );
}
