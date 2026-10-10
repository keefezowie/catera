import { useLocalSearchParams } from "expo-router";
import { linkTitle } from "@catera/mobile-ui";
import { CustomerDetail } from "../../../../src/customers/CustomerDetail";

export default function CustomerRoute() {
  const params = useLocalSearchParams<{ id: string; title?: string }>();
  return <CustomerDetail id={String(params.id)} title={linkTitle(params)} />;
}
