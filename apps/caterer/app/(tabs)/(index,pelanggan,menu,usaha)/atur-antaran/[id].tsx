import { useLocalSearchParams } from "expo-router";
import { jakartaDay } from "@catera/domain";
import { ExceptionSheet } from "../../../../src/today/ExceptionSheet";

/** One stop's exception (Gagal diantar, Pindah tanggal) as a form sheet over Hari ini: `?meal=lunch&date=YYYY-MM-DD`. */
export default function StopExceptionRoute() {
  const params = useLocalSearchParams<{ id: string; meal?: string; date?: string }>();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") ? params.date! : jakartaDay(new Date());
  return <ExceptionSheet id={String(params.id)} meal={params.meal === "dinner" ? "dinner" : "lunch"} date={date} />;
}
