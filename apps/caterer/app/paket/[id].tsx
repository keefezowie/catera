import { useLocalSearchParams } from "expo-router";
import { useData, useMobile } from "@catera/mobile-core";
import { Screen, Text } from "@catera/mobile-ui";
import { PackageEditor } from "../../src/business/PackageEditor";

export default function EditPackageRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { runtime, actor, t } = useMobile();
  const catererId = actor?.catererId ?? "";
  const ops = useData(`menu-ops:${catererId}`, () => runtime.api.sellerOperations(catererId));
  const offer = ops.data?.offers.find((o) => o.id === id);
  if (!offer) return <Screen><Text variant="caption">{ops.error || t("Memuat…", "Loading…")}</Text></Screen>;
  return <PackageEditor key={offer.id} offer={offer} />;
}
