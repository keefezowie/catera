import { useEffect, useState, type ComponentType } from "react";
import { View } from "react-native";
import { router } from "expo-router";

/**
 * Component tests mock `expo-router`, so a screen that opens a sheet route only calls `router.push`. `SheetHost`, mounted
 * beside the screen, stands in for the stack: a push to one of `routes` (by its first path segment, "/ulasan") shows that
 * sheet with the link's params (the last path segment as `id`, plus the query) handed to `onParams`, and `router.back`
 * closes it. Any other push is left to the mock.
 */
export function SheetHost({
  routes,
  onParams,
}: {
  routes: Record<string, ComponentType>;
  onParams: (params: Record<string, string>) => void;
}) {
  const [open, setOpen] = useState<{ route: string; key: number } | null>(null);
  useEffect(() => {
    let key = 0;
    (router.push as jest.Mock).mockImplementation((href: string | { pathname: string; params?: Record<string, string> }) => {
      const link = typeof href === "string" ? href : href.pathname;
      const [path, query = ""] = link.split("?");
      const route = `/${path.replace(/^\/+/, "").split("/")[0]}`;
      if (!routes[route]) return;
      const rest = path.replace(/^\/+/, "").split("/").slice(1);
      onParams({
        ...Object.fromEntries(new URLSearchParams(query)),
        ...(rest.length ? { id: decodeURIComponent(rest.join("/")) } : {}),
        ...(typeof href === "string" ? {} : href.params),
      });
      key += 1;
      setOpen({ route, key });
    });
    (router.back as jest.Mock).mockImplementation(() => setOpen(null));
    return () => {
      (router.push as jest.Mock).mockReset();
      (router.back as jest.Mock).mockReset();
    };
  }, [routes, onParams]);
  if (!open) return null;
  const Sheet = routes[open.route];
  return (
    <View testID="sheet-host">
      <Sheet key={open.key} />
    </View>
  );
}
