import { useLocalSearchParams } from "expo-router";
import { BuyScreen } from "../../src/buy/BuyScreen";

/** Perpanjang: the renew link, the 3-days-left push and Beranda's "Sisa 3 hari" card. */
export default function Perpanjang() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BuyScreen key={id} renewFrom={String(id)} />;
}
