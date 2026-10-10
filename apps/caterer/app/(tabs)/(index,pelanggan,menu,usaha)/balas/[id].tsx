import { useLocalSearchParams } from "expo-router";
import { linkTitle } from "@catera/mobile-ui";
import { ReplySheet } from "../../../../src/today/ReportScreen";

/** The reply to a customer's delivery report, as a form sheet over Hari ini; the full report stays a page. */
export default function ReplyRoute() {
  const params = useLocalSearchParams<{ id: string; title?: string }>();
  return <ReplySheet id={String(params.id)} title={linkTitle(params)} />;
}
