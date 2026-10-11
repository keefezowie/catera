import { useEffect, type ComponentType } from "react";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { leaveFor } from "./nav";

/**
 * A form sheet that belongs over a purchase (`/pembelian/alamat-form`, `/pembelian/bantuan-form`). Opened with nothing
 * under it (a cold OS link), there is no purchase to return to, so it gives way to the tab's own copy (`tabPath`, with the
 * link's params), which opens over its page (Alamat or Bantuan) the way any sheet link does. Over a purchase it is the
 * form itself.
 */
export function flowSheet(Form: ComponentType, tabPath: "/alamat-form" | "/bantuan-form") {
  return function FlowSheet() {
    const navigation = useNavigation();
    const params = useLocalSearchParams<Record<string, string | string[]>>();
    const alone = !navigation.canGoBack();
    useEffect(() => {
      if (!alone) return;
      const query = new URLSearchParams(
        Object.entries(params).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v]])),
      ).toString();
      leaveFor(query ? `${tabPath}?${query}` : tabPath);
      // Once: the params are the link's.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [alone]);
    return alone ? null : <Form />;
  };
}
