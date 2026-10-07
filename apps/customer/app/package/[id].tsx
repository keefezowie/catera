import { Redirect, useLocalSearchParams } from "expo-router";

// Old links inside the legacy screens; Task 13 removes them with those screens.
export default function LegacyPackage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/paket/${encodeURIComponent(id)}`} />;
}
