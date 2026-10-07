import { useMobile } from "@catera/mobile-core";
import { Calendar } from "../../src/daily";
import { SignInFirst } from "../../src/account/SignInFirst";

// The old calendar until Task 8 replaces this tab.
export default function JadwalTab() {
  const { actor, t } = useMobile();
  return actor ? <Calendar /> : <SignInFirst title={t("Jadwal", "Schedule")} next="/jadwal" />;
}
