import { useLocalSearchParams } from "expo-router";
import { useData, useMobile } from "@catera/mobile-core";
import { Screen, Text } from "@catera/mobile-ui";
import { PackageEditor } from "../../src/business/PackageEditor";

export default function NewPackageRoute() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { runtime, actor, t } = useMobile();
  const catererId = actor?.catererId ?? "";
  const ops = useData(`menu-ops:${catererId}`, () => runtime.api.sellerOperations(catererId));
  if (!from) return <PackageEditor />;
  const source = ops.data?.offers.find((o) => o.id === from);
  if (!source) return <Screen><Text variant="caption">{ops.error || t("Memuat…", "Loading…")}</Text></Screen>;
  return <PackageEditor key={source.id} from={source} />;
}
