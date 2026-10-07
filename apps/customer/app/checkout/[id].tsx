import { Redirect, useLocalSearchParams } from "expo-router";

/** Old checkout links and pushes: renewals open Perpanjang, everything else Beli (until Task 13). */
export default function OldCheckout() {
  const { id, renewedFrom, ...rest } = useLocalSearchParams<Record<string, string>>();
  if (renewedFrom) return <Redirect href={`/renew/${encodeURIComponent(renewedFrom)}` as never} />;
  const query = new URLSearchParams(Object.entries(rest).filter(([, v]) => typeof v === "string")).toString();
  return <Redirect href={`/beli/${encodeURIComponent(id)}${query ? `?${query}` : ""}` as never} />;
}
