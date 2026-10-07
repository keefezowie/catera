import { useLocalSearchParams } from "expo-router";
import { BuyScreen } from "../../src/buy/BuyScreen";

type Params = { id: string; trial?: string; portions?: string; cycles?: string; startDate?: string; addressId?: string };

/** Beli: a new purchase from Paket (`?trial=1` for a one-day trial). */
export default function Beli() {
  const { id, trial, portions, cycles, startDate, addressId } = useLocalSearchParams<Params>();
  const initial = Object.fromEntries(
    Object.entries({ portions, cycles, startDate, addressId }).filter(([, v]) => typeof v === "string" && v),
  );
  return <BuyScreen key={`${id}:${trial}`} packageId={String(id)} trial={trial === "1"} initial={initial} />;
}
