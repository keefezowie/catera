import type { ReactNode } from "react";
import { Linking, View } from "react-native";
import { useMobile } from "@catera/mobile-core";
import { Button, Screen, Text } from "@catera/mobile-ui";
import { tabsForRole } from "./roles";

/** Customer accounts belong in the Catera app, not Catera Dapur. */
export function RoleGate({ children }: { children: ReactNode }) {
  const { actor, t, logout } = useMobile();
  if (actor && !tabsForRole(actor.role).length)
    return (
      <Screen scroll={false}>
        <View style={{ gap: 12, paddingTop: 48 }}>
          <Text variant="title">{t("Buka aplikasi Catera", "Open the Catera app")}</Text>
          <Text>
            {t(
              "Akun ini adalah akun pelanggan. Catera Dapur hanya untuk katerer dan pembantunya.",
              "This is a customer account. Catera Dapur is for caterers and their helpers.",
            )}
          </Text>
          <Button
            label={t("Buka Catera", "Open Catera")}
            onPress={() => void Linking.openURL("catera://")}
          />
          <Button variant="text" label={t("Keluar", "Sign out")} onPress={() => void logout()} />
        </View>
      </Screen>
    );
  return <>{children}</>;
}
