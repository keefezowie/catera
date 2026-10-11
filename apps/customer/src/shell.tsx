import { useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import { errorLabel } from "@catera/domain";
import { MobileProvider, useMobile, type MobileRuntime } from "@catera/mobile-core";
import { Button, StateArt, Text, useColors } from "@catera/mobile-ui";
import { customerLink } from "./links";
import { openLink } from "./nav";
import { clearCachedCustomer } from "./today/offline";

/** The customer app's one provider: MobileProvider owns the session, commands, realtime,
 * push registration and push-tap routing (customerLink maps the href, openLink opens it in the tabs). Signing out
 * forgets the cached Beranda, so the next person on this phone never sees it. `overlay` (the launch hand-off) sits
 * above the gate, so it stays mounted whatever the gate shows. */
export function AppProviders({
  runtime,
  overlay,
  children,
}: {
  runtime: MobileRuntime;
  overlay?: ReactNode;
  children: ReactNode;
}) {
  return (
    <MobileProvider runtime={runtime} linkMapper={customerLink} openLink={openLink} onSignedOut={clearCachedCustomer}>
      <StartupGate>{children}</StartupGate>
      {overlay}
    </MobileProvider>
  );
}

/** If the very first check of the account cannot reach Catera (offline, timeout, a tunnel's HTML page),
 * say so with Coba lagi instead of quietly opening as a guest. A signed-out or expired session is a
 * normal start; a phone that still has its last account opens offline on it; and once the app has
 * started, later failures never replace it. */
function StartupGate({ children }: { children: ReactNode }) {
  const { ready, actor, error, locale, refresh, t } = useMobile();
  const c = useColors();
  const started = useRef(false);
  const [busy, setBusy] = useState(false);
  const signedOut = [errorLabel("UNAUTHORIZED", locale), errorLabel("FORBIDDEN", locale)].includes(error);
  if (ready && (actor || !error || signedOut)) started.current = true;
  if (started.current || !ready) return <>{children}</>;
  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 12, backgroundColor: c.canvas }}>
      <StateArt pose="bingung" style={{ marginBottom: 8 }} />
      <Text variant="title" style={{ textAlign: "center" }}>
        {t("Belum bisa terhubung.", "Can't connect yet.")}
      </Text>
      <Text selectable testID="startup-error" style={{ color: c.danger, textAlign: "center" }}>
        {error}
      </Text>
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
