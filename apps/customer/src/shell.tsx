import { useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import { errorLabel } from "@catera/domain";
import { MobileProvider, useMobile, type MobileRuntime } from "@catera/mobile-core";
import { Button, colors, Text } from "@catera/mobile-ui";
import { customerLink } from "./links";

/** The customer app's one provider: MobileProvider owns the session, commands, realtime,
 * push registration and push-tap routing (through customerLink). */
export function AppProviders({ runtime, children }: { runtime: MobileRuntime; children: ReactNode }) {
  return (
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      <StartupGate>{children}</StartupGate>
    </MobileProvider>
  );
}

/** If the very first check of the account cannot reach Catera (offline, timeout, a tunnel's HTML page),
 * say so with Coba lagi instead of quietly opening as a guest. A signed-out or expired session is a
 * normal start; a phone that still has its last account opens offline on it; and once the app has
 * started, later failures never replace it. */
function StartupGate({ children }: { children: ReactNode }) {
  const { ready, actor, error, locale, refresh, t } = useMobile();
  const started = useRef(false);
  const [busy, setBusy] = useState(false);
  const signedOut = [errorLabel("UNAUTHORIZED", locale), errorLabel("FORBIDDEN", locale)].includes(error);
  if (ready && (actor || !error || signedOut)) started.current = true;
  if (started.current || !ready) return <>{children}</>;
  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 12, backgroundColor: colors.canvas }}>
      <Text variant="title">{t("Belum bisa terhubung.", "Can't connect yet.")}</Text>
      <Text style={{ color: colors.muted }}>{error}</Text>
      <Button
        label={t("Coba lagi", "Try again")}
        disabled={busy}
        onPress={() => {
          setBusy(true);
          void refresh().finally(() => setBusy(false));
        }}
      />
    </View>
  );
}
