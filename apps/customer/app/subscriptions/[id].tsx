import { Redirect } from "expo-router";

/** The server still links to /subscriptions/<id> (notifications); the app shows packages in Jadwal. */
export default function OldSubscription() {
  return <Redirect href="/jadwal" />;
}
