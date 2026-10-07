import { Redirect } from "expo-router";

// Old /discover links (web hrefs, older notifications) open Jelajah.
export default function Discover() {
  return <Redirect href="/jelajah" />;
}
