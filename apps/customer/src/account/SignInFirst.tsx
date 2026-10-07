import { View } from "react-native";
import { router } from "expo-router";
import { useMobile } from "@catera/mobile-core";
import { Button, colors, Screen, Text } from "@catera/mobile-ui";

/** Signed-out stand-in for Jadwal and Akun: one way to sign in that comes back here. */
export function SignInFirst({ title, next }: { title: string; next: string }) {
  const { t } = useMobile();
  return (
    <Screen>
      <View style={{ gap: 6, paddingTop: 8 }}>
        <Text variant="title">{title}</Text>
        <Text style={{ color: colors.muted }}>
          {t("Masuk untuk melihat paket dan jadwal antar Anda.", "Sign in to see your packages and deliveries.")}
        </Text>
      </View>
      <Button
        label={t("Masuk", "Sign in")}
        onPress={() => router.push({ pathname: "/login", params: { next } } as never)}
      />
    </Screen>
  );
}
