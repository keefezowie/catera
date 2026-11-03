import type { Stop } from "@catera/domain";
import { jakartaClock } from "./exceptions";

export type StopStatusTone = "cooking" | "out" | "arrived";
export type StopStatus = { label: string; tone: StopStatusTone };

/**
 * The pill under a stop in Urutan antar: where that stop's meal is. A stop that is still scheduled has none (nothing has
 * happened to it). Arrived and delivered both read "Sampai", with the Jakarta time the kitchen marked it when there is one.
 */
export function stopStatus(
  stop: Pick<Stop, "stage" | "arrivedAt">,
  t: (id: string, en: string) => string,
): StopStatus | null {
  switch (stop.stage) {
    case "preparing":
      return { label: t("Dimasak", "Cooking"), tone: "cooking" };
    case "out_for_delivery":
      return { label: t("Diantar", "On the way"), tone: "out" };
    case "arrived":
    case "delivered": {
      const word = t("Sampai", "Arrived");
      return {
        label: stop.arrivedAt
          ? `${word} ${jakartaClock(stop.arrivedAt)}`
          : word,
        tone: "arrived",
      };
    }
    default:
      return null;
  }
}
