import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";

/**
 * The full-screen reference a form sheet measures its bottom edge against. `measureInWindow` reports window
 * coordinates, which can be offset from the safe-area frame by the status bar (Expo Go, edge-to-edge differences), so
 * the screen's edge is read from a view that spans the whole root, in the same space as the scroll view's reading.
 */
let reference: View | null = null;

/** Where the screen's bottom edge is in window coordinates, or null while no root reference is mounted. */
export function measureWindowEdge(done: (bottom: number | null) => void): void {
  const host = reference as unknown as Partial<Pick<View, "measureInWindow">> | null;
  if (!host?.measureInWindow) return done(null);
  host.measureInWindow((_x, y, _w, height) => done(Number.isFinite(y) && Number.isFinite(height) && height > 0 ? y + height : null));
}

/** Mount once at the app's root, inside the safe-area provider. It draws nothing and takes no touches. */
export function WindowEdge() {
  const ref = useRef<View>(null);
  useEffect(() => {
    const node = ref.current;
    reference = node;
    return () => {
      if (reference === node) reference = null;
    };
  }, []);
  return <View ref={ref} testID="window-edge" collapsable={false} pointerEvents="none" style={StyleSheet.absoluteFill} />;
}

/** Test seam: stands in for the root reference (the Jest host has no layout). */
export function setWindowEdgeReference(view: { measureInWindow: View["measureInWindow"] } | null): void {
  reference = view as unknown as View | null;
}
