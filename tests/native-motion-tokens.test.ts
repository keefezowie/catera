import { describe, expect, it } from "vitest";
import { nativeMotion } from "../packages/design-tokens/src";
import { webMotion } from "../apps/web/src/lib/motion";

describe("native motion tokens", () => {
  it("native durations match web motion", () => {
    expect([nativeMotion.control, nativeMotion.selection, nativeMotion.content, nativeMotion.feature]).toEqual([
      webMotion.control,
      webMotion.selection,
      webMotion.content,
      webMotion.feature,
    ]);
    expect(`cubic-bezier(${nativeMotion.ease.map(String).join(",").replace(/0\./g, ".")})`).toBe(webMotion.ease);
  });
});
