import { webVariables } from "@catera/design-tokens";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { webMotionVariables } from "@/lib/motion";
import "./globals.css";
import "./usability.css";
import "./overlays.css";
import "./pilot.css";
import "./settlement.css";
import "./motion.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale =
    (await cookies()).get("catera_locale")?.value === "en" ? "en" : "id";
  return {
    title: { default: "Catera — Good Food on Repeat", template: "%s · Catera" },
    description:
      locale === "en"
        ? "Compare catering packages, choose portions, and manage your delivery schedule."
        : "Bandingkan paket katering, pilih porsi, dan kelola jadwal pengantaran.",
    manifest: "/manifest.webmanifest",
    icons: { icon: "/assets/app-icon.png", apple: "/assets/app-icon.png" },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale =
    (await cookies()).get("catera_locale")?.value === "en" ? "en" : "id";
  return (
    <html
      style={{ ...webVariables, ...webMotionVariables } as React.CSSProperties}
      lang={locale}
      data-scroll-behavior="smooth"
    >
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
