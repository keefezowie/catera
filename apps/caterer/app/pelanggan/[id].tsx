import { useLocalSearchParams } from "expo-router";
import { CustomerDetail } from "../../src/customers/CustomerDetail";

export default function CustomerRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CustomerDetail id={String(id)} />;
}
