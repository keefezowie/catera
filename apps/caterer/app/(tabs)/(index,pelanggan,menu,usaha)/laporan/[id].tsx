import { useLocalSearchParams } from "expo-router";
import { ReportScreen } from "../../../../src/today/ReportScreen";

export default function ReportRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ReportScreen id={String(id)} />;
}
