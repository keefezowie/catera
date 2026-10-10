import { View } from "react-native";
import { useMobile } from "@catera/mobile-core";
import { Skeleton, SkeletonGroup } from "@catera/mobile-ui";

/**
 * Beranda's data area while its first read is out and nothing is kept on this phone (a first launch, a new account):
 * the hero card (photo, dish line, caption), the other meal's row and two Berikutnya rows, at their loaded heights at
 * 360dp and font scale 1.0. The mood header above it is live. One progress bar for screen readers, "Memuat beranda".
 */
export function BerandaSkeleton() {
  const { t } = useMobile();
  return (
    <SkeletonGroup label={t("Memuat beranda", "Loading home")}>
      <View testID="beranda-skeleton" style={{ gap: 24 }}>
        <View style={{ gap: 12 }}>
          <Skeleton height={168} radius={20} />
          <View style={{ gap: 8, paddingHorizontal: 8 }}>
            <Skeleton width="72%" height={22} />
            <Skeleton width="48%" height={14} />
          </View>
        </View>
        <SkeletonRow />
        <View style={{ gap: 8 }}>
          <SkeletonRow />
          <SkeletonRow />
        </View>
      </View>
    </SkeletonGroup>
  );
}

/** A 60dp row: a 54dp round photo and two lines, the shape of the other-meal row and a Berikutnya day. */
function SkeletonRow() {
  return (
    <View style={{ minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Skeleton width={54} height={54} radius={27} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="40%" height={12} />
        <Skeleton width="64%" height={16} />
      </View>
    </View>
  );
}
