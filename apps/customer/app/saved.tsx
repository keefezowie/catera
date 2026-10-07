import { Redirect } from "expo-router";

// Old links inside the legacy screens; Task 13 removes them with those screens.
export default function LegacySaved() {
  return <Redirect href="/disimpan" />;
}
