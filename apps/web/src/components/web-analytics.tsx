"use client";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

/** A claim token plus a phone number can take over a prepaid subscription, so it never reaches analytics, even encoded inside `next=`. */
export function scrubClaimUrl(url: string) {
  return url.replace(
    /((?:\/|%(?:25)*2F)claim(?:\/|%(?:25)*2F))[^/?#&]+/gi,
    "$1[token]",
  );
}
const scrub = <T extends { url: string }>(event: T): T => ({
  ...event,
  url: scrubClaimUrl(event.url),
});

export function WebAnalytics() {
  return (
    <>
      <Analytics beforeSend={scrub} />
      <SpeedInsights beforeSend={scrub} />
    </>
  );
}
