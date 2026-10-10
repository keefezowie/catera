import { useLocalSearchParams } from "expo-router";
import { ImportRowEditor } from "../src/import/RowEditor";

/** One import row, corrected in a form sheet over Impor (`?n=` is the row's number on Impor's list). */
export default function ImportRowRoute() {
  const { n } = useLocalSearchParams<{ n?: string }>();
  return <ImportRowEditor n={Number(n)} />;
}
