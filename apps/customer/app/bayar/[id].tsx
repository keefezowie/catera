import { useLocalSearchParams } from "expo-router";
import { PaymentScreen } from "../../src/buy/PaymentScreen";

export default function Bayar() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PaymentScreen key={id} checkoutId={String(id)} />;
}
