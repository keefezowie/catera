import { useLocalSearchParams } from "expo-router";
import { jakartaDay } from "@catera/domain";
import { ProofSheet } from "../../../src/today/ProofSheet";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The proof-photo sheet for "Sampai (n)", over Hari ini: `?meal=lunch&date=YYYY-MM-DD&ids=a,b,c`. */
export default function ProofRoute() {
  const params = useLocalSearchParams<{ meal?: string; date?: string; ids?: string }>();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") ? params.date! : jakartaDay(new Date());
  // expo-router has already decoded the param; a crafted link's other values are dropped, the server only takes UUIDs.
  const ids = String(params.ids ?? "").split(",").filter((id) => UUID.test(id));
  return <ProofSheet ids={ids} meal={params.meal === "dinner" ? "dinner" : "lunch"} date={date} />;
}
