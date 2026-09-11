import { cookies } from "next/headers";
import { demoEnabled } from "@catera/backend";
import { session } from "@/lib/auth";
import { resolveWorkspace, workspaceCookieName } from "@/lib/workspace";
import { ApplicationLayout } from "@/components/application";

export default async function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [auth, jar] = await Promise.all([session(), cookies()]);
  const locale = jar.get("catera_locale")?.value === "en" ? "en" : "id";
  const workspace = resolveWorkspace(
    auth.actor,
    jar.get(workspaceCookieName)?.value,
  );
  return (
    <ApplicationLayout
      actor={auth.actor}
      demo={demoEnabled()}
      locale={locale}
      workspace={workspace}
    >
      {children}
    </ApplicationLayout>
  );
}
