import { expect, it } from "vitest";
import * as layout from "../apps/web/src/app/layout";

it("the page draws under the notch so env(safe-area-inset-*) has real values", () => {
  expect((layout as { viewport?: unknown }).viewport).toMatchObject({
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
  });
});
