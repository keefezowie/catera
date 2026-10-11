import { useLocalSearchParams } from "expo-router";
import { ImportPhotoViewer } from "../src/import/PhotoViewer";

/** One attached photo, full screen over Impor (`?i=` is its number among Impor's photos, from 1). */
export default function ImportPhotoRoute() {
  const { i } = useLocalSearchParams<{ i?: string }>();
  return <ImportPhotoViewer i={Number(i)} />;
}
