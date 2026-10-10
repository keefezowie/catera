import { useLocalSearchParams } from "expo-router";
import { useData, useMobile } from "@catera/mobile-core";
import { linkTitle, Screen, Text } from "@catera/mobile-ui";
import { PackageDetail } from "../../../../src/business/PackageDetail";

export default function EditPackageRoute() {
  const params = useLocalSearchParams<{ id: string; title?: string }>();
  const { id } = params;
  const { runtime, actor, t } = useMobile();
  const catererId = actor?.catererId ?? "";
  const ops = useData(`menu-ops:${catererId}`, () => runtime.api.sellerOperations(catererId));
  const offer = ops.data?.offers.find((o) => o.id === id);
  // Until the package arrives the screen keeps the name its link carried, or else is named by what it is. A failed read
  // or a package the read does not hold goes back to what it is: the carried name was never checked against a record.
  if (!offer) {
    const missing = !!ops.data && !ops.loading;
    const loading = !ops.error && !missing;
    return (
      <Screen nativeTitle={loading ? (linkTitle(params) ?? t("Paket", "Package")) : t("Paket", "Package")}>
        <Text variant="caption">
          {ops.error || (missing ? t("Paket ini tidak ditemukan.", "This package was not found.") : t("Memuat…", "Loading…"))}
        </Text>
      </Screen>
    );
  }
  return <PackageDetail offer={offer} />;
}
