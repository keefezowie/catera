import { useCallback, useEffect, useState } from "react";
import { Button } from "../components";
import { useColors } from "../theme";

/** "1:00", "0:42". */
export function countdownText(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Seconds left before a resend is allowed, counting down once a second; `restart` sets it back to the full wait. */
export function useResendTimer(seconds = 60, running = false) {
  const [left, setLeft] = useState(running ? seconds : 0);
  const counting = left > 0;
  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(timer);
  }, [counting]);
  const restart = useCallback(() => setLeft(seconds), [seconds]);
  return { left, restart };
}

/** A resend as a text button: muted "Kirim ulang dalam 0:42" while it waits, then `ready` in the action colour. */
export function ResendButton({
  left,
  ready,
  waiting,
  busy = false,
  onPress,
}: {
  left: number;
  ready: string;
  /** The waiting label for a given "0:42". */
  waiting: (time: string) => string;
  busy?: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const counting = left > 0;
  return (
    <Button
      variant="text"
      label={counting ? waiting(countdownText(left)) : ready}
      ink={counting ? c.muted : undefined}
      disabled={counting}
      busy={busy}
      style={{ alignSelf: "flex-start" }}
      onPress={onPress}
    />
  );
}
