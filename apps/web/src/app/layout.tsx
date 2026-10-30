import { webVariables } from "@catera/design-tokens";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { webMotionVariables } from "@/lib/motion";
import { publicOrigin } from "@/lib/public-url";
import "./globals.css";
import "./usability.css";
import "./spacing.css";
import "./overlays.css";
import "./pilot.css";
import "./settlement.css";
import "./motion.css";
import "./optimizations.css";

// viewport-fit=cover lets the page draw under the notch and home indicator; without it every
// env(safe-area-inset-*) in the stylesheets resolves to 0.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const locale =
    (await cookies()).get("catera_locale")?.value === "en" ? "en" : "id";
  return {
    metadataBase: new URL(publicOrigin()),
    title: { default: "Catera: katering langganan", template: "%s · Catera" },
    description:
      locale === "en"
        ? "Compare catering packages, choose portions, and manage your delivery schedule."
        : "Bandingkan paket katering, pilih porsi, dan kelola jadwal pengantaran.",
    manifest: "/manifest.webmanifest",
    openGraph: {
      type: "website",
      siteName: "Catera",
      locale: locale === "en" ? "en_US" : "id_ID",
    },
    twitter: { card: "summary_large_image" },
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
