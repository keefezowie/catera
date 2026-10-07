import { useMobile } from "@catera/mobile-core";
import { AccountScreen } from "../../src/daily";
import { SignInFirst } from "../../src/account/SignInFirst";

// The old account screen until Task 13 replaces this tab.
export default function AkunTab() {
  const { actor, t } = useMobile();
  return actor ? <AccountScreen /> : <SignInFirst title={t("Akun", "Account")} next="/akun" />;
}
