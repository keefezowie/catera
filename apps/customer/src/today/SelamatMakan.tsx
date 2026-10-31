import { useEffect, useState } from "react";
import { View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { nativeLayout } from "@catera/design-tokens";
import { useMobile } from "@catera/mobile-core";
import { Button, PolishArt, Text } from "@catera/mobile-ui";
import { pushSheet } from "../nav";
import { onReviewMarked } from "./reviewMark";

/** The moment art, small: the 64 rich-row thumb size, so the card stays a row and not a second hero. */
const ART = nativeLayout.thumb.md;

/**
 * "Selamat makan" (controller ruling, polish): once a delivered meal is confirmed as arrived, Beranda's delivered slot
 * offers the plan's review. The moment-rantang-meledak art, "Selamat makan" over "Gimana makanannya?", and "Tulis
 * ulasan", which opens the review sheet (`/ulasan/{subscriptionId}`); nothing opens on its own. It reads the plan's
 * review mark first and stays away while that read is out, once the review was given or put off, and as soon as the
 * sheet marks it. It sits on the hero, so it takes the hero's inks.
 */
export function SelamatMakanCard({
  subscriptionId,
  ink,
  quiet,
  edge,
}: {
  subscriptionId: string;
  ink: string;
  quiet: string;
  edge: string;
}) {
  const { runtime, t } = useMobile();
  const key = runtime.storageKey(`review.${subscriptionId}`);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    void SecureStore.getItemAsync(key)
      .catch(() => "unknown")
      .then((mark) => {
        if (live) setOpen(!mark);
      });
    const off = onReviewMarked((marked) => {
      if (marked === key) setOpen(false);
    });
    return () => {
      live = false;
      off();
    };
  }, [key]);

  if (!open) return null;
  return (
    <View
      testID="selamat-makan"
      style={{ gap: nativeLayout.space.md }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: nativeLayout.space.md }}>
        <PolishArt name="moment-rantang-meledak" size={ART} />
        {/* The track headline above already says "Selamat makan"; the card adds only the ask. */}
        <Text variant="body" style={{ flex: 1, minWidth: 0, color: ink }}>
          {t("Ulas paketnya untuk pelanggan lain", "Review the plan for other customers")}
        </Text>
      </View>
      <Button
        variant="secondary"
        label={t("Tulis ulasan", "Write a review")}
        ink={ink}
        edge={edge}
        onPress={() => pushSheet(`/ulasan/${encodeURIComponent(subscriptionId)}`)}
      />
    </View>
  );
}
