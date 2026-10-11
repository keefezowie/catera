import { useLocalSearchParams } from "expo-router";
import { useData, useMobile } from "@catera/mobile-core";
import { FadeSwap, Screen, Text } from "@catera/mobile-ui";
import { PackageEditor } from "../../../../src/business/PackageEditor";
import { isFirstPublish } from "../../../../src/business/package";
import { DetailSkeleton } from "../../../../src/skeletons";

export default function NewPackageRoute() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { runtime, actor, t } = useMobile();
  const catererId = actor?.catererId ?? "";
  const ops = useData(`menu-ops:${catererId}`, () => runtime.api.sellerOperations(catererId));
  // Whether this is the first package the caterer publishes, from the packages this route already reads.
  const firstPublish = isFirstPublish(ops.data?.offers);
  if (!from) return <PackageEditor firstPublish={firstPublish} />;
  const source = ops.data?.offers.find((o) => o.id === from);
  // A copy waits for the package it copies; a read that answered without it says so instead of waiting forever.
  if (!source)
    return (
      <Screen>
        <FadeSwap swapKey={ops.error ? "error" : ops.data ? "missing" : "loading"} style={{ gap: 16 }}>
          {ops.error ? (
            <Text variant="caption">{ops.error}</Text>
          ) : ops.data ? (
            <Text>{t("Paket ini tidak ditemukan.", "This package was not found.")}</Text>
          ) : (
            <DetailSkeleton label={t("Memuat paket", "Loading the package")} />
          )}
        </FadeSwap>
      </Screen>
    );
  return <PackageEditor key={source.id} from={source} firstPublish={firstPublish} />;
}
