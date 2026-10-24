import { Redirect } from "expo-router";

/** A route the app has no screen for lands on Hari ini instead of a dead end. */
export default function NotFound() {
  return <Redirect href="/" />;
}
