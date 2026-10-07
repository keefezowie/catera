import { Redirect, useLocalSearchParams } from "expo-router";

/** The action feed and notifications still link to /subscriptions/<id>/menu?date=…&meal=…: open Pilih menu. */
export default function OldSubscriptionMenu() {
  const { id, date, meal } = useLocalSearchParams<{ id: string; date?: string; meal?: string }>();
  const query = new URLSearchParams(
    Object.entries({ date, meal }).filter((e): e is [string, string] => typeof e[1] === "string" && !!e[1]),
  ).toString();
  return <Redirect href={`/pilih-menu/${encodeURIComponent(String(id))}${query ? `?${query}` : ""}` as never} />;
}
