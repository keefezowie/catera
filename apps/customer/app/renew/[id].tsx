import { useLocalSearchParams } from "expo-router";
import { BuyScreen } from "../../src/buy/BuyScreen";

type Params = { id: string; portions?: string; cycles?: string; addressId?: string };

/** Perpanjang: the renew link, the 3-days-left push, Beranda's "Sisa 3 hari" card and Bayar lagi. */
export default function Perpanjang() {
  const { id, portions, cycles, addressId } = useLocalSearchParams<Params>();
  const initial = Object.fromEntries(
    Object.entries({ portions, cycles, addressId }).filter(([, v]) => typeof v === "string" && v),
  );
  return <BuyScreen key={id} renewFrom={String(id)} initial={initial} />;
}
