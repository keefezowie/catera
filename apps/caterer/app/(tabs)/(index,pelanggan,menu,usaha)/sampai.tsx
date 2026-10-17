import { useLocalSearchParams } from "expo-router";
import { jakartaDay } from "@catera/domain";
import { ProofSheet } from "../../../src/today/ProofSheet";

/** The proof-photo sheet for "Sampai (n)", over Hari ini: `?meal=lunch&date=YYYY-MM-DD&ids=a,b,c`. */
export default function ProofRoute() {
  const params = useLocalSearchParams<{ meal?: string; date?: string; ids?: string }>();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") ? params.date! : jakartaDay(new Date());
  const ids = String(params.ids ?? "").split(",").map(decodeURIComponent).filter(Boolean);
  return <ProofSheet ids={ids} meal={params.meal === "dinner" ? "dinner" : "lunch"} date={date} />;
}
