import { Redirect, useLocalSearchParams } from "expo-router";

/** Old /payment/<id> links (notifications, pushes) open Bayar. */
export default function OldPayment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/bayar/${encodeURIComponent(id)}` as never} />;
}
