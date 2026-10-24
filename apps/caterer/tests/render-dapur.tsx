import { render as plainRender, type RenderOptions } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { withDapurScale } from "./dapur-scale";

/**
 * `render` under the scale the Dapur root provides (`v2`, 48 touch target), for the screens that are drawn to it. A
 * `rerender` keeps the provider, so the tree is updated in place and not mounted again.
 */
export function render(ui: ReactElement, options?: RenderOptions) {
  const view = plainRender(withDapurScale(ui), options);
  return { ...view, rerender: (next: ReactElement) => view.rerender(withDapurScale(next)) };
}
