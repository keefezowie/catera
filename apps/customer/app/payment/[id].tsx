import { Redirect, useLocalSearchParams } from "expo-router";

/** Old payment links (Bantuan, renewal panel, pushes) open Bayar (until Task 13). */
export default function OldPayment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/bayar/${encodeURIComponent(id)}` as never} />;
}
