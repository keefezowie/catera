import { useLocalSearchParams } from "expo-router";
import { MenuDayScreen } from "../../src/menu/MenuDayScreen";

export default function MenuDayRoute() {
  const { date, pkg, meal } = useLocalSearchParams<{ date: string; pkg: string; meal: string }>();
  return <MenuDayScreen date={String(date)} packageId={String(pkg)} meal={String(meal || "lunch")} />;
}
