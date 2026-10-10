import { useLocalSearchParams } from "expo-router";
import { linkTitle } from "@catera/mobile-ui";
import { ReportScreen } from "../../../../src/today/ReportScreen";

export default function ReportRoute() {
  const params = useLocalSearchParams<{ id: string; title?: string }>();
  return <ReportScreen id={String(params.id)} title={linkTitle(params)} />;
}
