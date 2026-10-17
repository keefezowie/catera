import { useLocalSearchParams } from "expo-router";
import { jakartaDay } from "@catera/domain";
import { MoveSheet } from "../../../../src/today/MoveSheet";

/** One stop's Pindah tanggal as a large form sheet over Hari ini: `?meal=lunch&date=YYYY-MM-DD`. */
export default function MoveRoute() {
  const params = useLocalSearchParams<{ id: string; meal?: string; date?: string }>();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") ? params.date! : jakartaDay(new Date());
  return <MoveSheet id={String(params.id)} meal={params.meal === "dinner" ? "dinner" : "lunch"} date={date} />;
}
