import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { router, Stack } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMobile } from "@catera/mobile-core";
import { Text, useColors } from "@catera/mobile-ui";
import { useImportStore } from "./store";

/** Photo `i` (counted from 1 among the photos) of the import in progress, full screen over Impor. */
export const photoHref = (i: number) => `/impor-foto?i=${i}`;

/**
 * One attached photo, whole, fitted to the screen with no pinch: a full-screen modal over Impor whose native bar has
 * Close at its leading edge and names which photo this is. It reads the import in progress, so a link to a photo that
 * is not there (a cold link, or Impor closed meanwhile) opens Impor instead of an empty viewer.
 */
export function ImportPhotoViewer({ i }: { i: number }) {
  const { t } = useMobile();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { files } = useImportStore();
  const photos = files.flatMap((f) => (f.kind === "image" ? [f] : []));
  const photo = Number.isInteger(i) && i >= 1 ? photos[i - 1] : undefined;
  // Keyed to the file, so another photo in the same place gets its own chance to load.
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (!photo) router.replace("/impor" as never);
  }, [photo]);
  const label = t(`Foto ${i} dari ${photos.length}`, `Photo ${i} of ${photos.length}`);
  // One options object per title, so the bar is told again only when the title changes.
  const options = useMemo(() => ({ title: label }), [label]);
  if (!photo) return null;

  return (
    <View testID="import-photo-viewer" style={{ flex: 1, backgroundColor: c.canvas, paddingBottom: insets.bottom }}>
      <Stack.Screen options={options} />
      {failed === photo.uri ? (
        // A photo the phone cannot decode: the same sage ground as its thumbnail, and why it is empty.
        <View
          style={{
            flex: 1,
            margin: 20,
            padding: 20,
            borderRadius: 12,
            borderCurve: "continuous",
            backgroundColor: c.sage,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text selectable style={{ textAlign: "center" }}>
            {t("Foto ini tidak bisa ditampilkan.", "This photo can't be shown.")}
          </Text>
        </View>
      ) : (
        <Image
          accessible
          accessibilityRole="image"
          accessibilityLabel={label}
          accessibilityIgnoresInvertColors
          source={{ uri: photo.uri }}
          contentFit="contain"
          onError={() => setFailed(photo.uri)}
          style={{ flex: 1 }}
        />
      )}
    </View>
  );
}
