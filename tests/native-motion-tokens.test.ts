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
  it("is the Even slower column the owner picked", () => {
    expect([nativeMotion.control, nativeMotion.selection, nativeMotion.content, nativeMotion.feature]).toEqual([200, 340, 440, 680]);
    expect([...nativeMotion.ease]).toEqual([0.33, 1, 0.68, 1]);
    expect(nativeMotion.spring).toEqual({ damping: 22, stiffness: 120 });
  });
  it("durations are strictly increasing", () => {
    expect(nativeMotion.control).toBeLessThan(nativeMotion.selection);
    expect(nativeMotion.selection).toBeLessThan(nativeMotion.content);
    expect(nativeMotion.content).toBeLessThan(nativeMotion.feature);
  });
  it("the spring is critically damped (no overshoot)", () => {
    const { damping, stiffness } = nativeMotion.spring;
    expect(Math.abs(damping / (2 * Math.sqrt(stiffness)) - 1)).toBeLessThanOrEqual(0.02);
  });
});
