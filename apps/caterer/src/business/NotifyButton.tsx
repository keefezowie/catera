import { useState } from "react";
import { useMobile } from "@catera/mobile-core";
import { Button, Text, useColors } from "@catera/mobile-ui";

/** Opt in to new-order, change and payout notifications on this phone. */
export function NotifyButton() {
  const { t, enablePush } = useMobile();
  const c = useColors();
  const [state, setState] = useState<"idle" | "busy" | "on">("idle");
  const [error, setError] = useState("");
  if (state === "on") return <Text variant="caption">{t("Notifikasi aktif di ponsel ini.", "Notifications are on for this phone.")}</Text>;
  return (
    <>
      <Button
        variant="secondary"
        label={t("Nyalakan notifikasi", "Turn on notifications")}
        disabled={state === "busy"}
        onPress={() => {
          setState("busy");
          setError("");
          enablePush("Catera Dapur")
            .then(() => setState("on"))
            .catch((e: Error) => {
              setError(e.message);
              setState("idle");
            });
        }}
      />
      {error ? <Text selectable variant="caption" style={{ color: c.danger }}>{error}</Text> : null}
    </>
  );
}
