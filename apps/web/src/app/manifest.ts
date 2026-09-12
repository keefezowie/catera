import type { MetadataRoute } from "next";
import { cookies } from "next/headers";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const english = (await cookies()).get("catera_locale")?.value === "en";
  return {
    name: "Catera — Good Food on Repeat",
    short_name: "Catera",
    description: english
      ? "Good meals for better everyday living."
      : "Makanan baik untuk hari-hari Anda.",
    start_url: "/home",
    display: "standalone",
    background_color: "#FFF7E9",
    theme_color: "#163D2E",
    icons: [
      {
        src: "/assets/app-icon.png",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
