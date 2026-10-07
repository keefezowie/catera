import { useLocalSearchParams } from "expo-router";
import { TodayScreen } from "../../src/today/TodayScreen";

export default function TodayRoute() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  return <TodayScreen date={typeof date === "string" ? date : undefined} />;
}
