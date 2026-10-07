import { Redirect } from "expo-router";

// Old /saved links open Disimpan.
export default function LegacySaved() {
  return <Redirect href="/disimpan" />;
}
