import { Redirect, useLocalSearchParams } from "expo-router";

// Old /package/<id> links open Paket.
export default function LegacyPackage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/paket/${encodeURIComponent(id)}`} />;
}
