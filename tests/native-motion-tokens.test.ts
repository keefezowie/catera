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
    expect(nativeMotion.spring).toEqual({ damping: 22, stiffness: 120, mass: 1 });
  });
  // Reanimated 4 defaults mass to 4, so a spring without it runs at half the ratio and twice the response it was
  // designed with. Every token spring is checked in Apple's terms with its own mass.
  const ratio = ({ damping, stiffness, mass }: { damping: number; stiffness: number; mass: number }) =>
    damping / (2 * Math.sqrt(stiffness * mass));
  const response = ({ stiffness, mass }: { stiffness: number; mass: number }) => (2 * Math.PI) / Math.sqrt(stiffness / mass);
  it("every spring names mass 1", () => {
    for (const s of [nativeMotion.spring, nativeMotion.pressIn, nativeMotion.pressOut, nativeMotion.settle, nativeMotion.pop, nativeMotion.toggle])
      expect(s.mass).toBe(1);
  });
  it("press, release and settle are critically damped at Apple's responses; only the pop and the toggle overshoot", () => {
    const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(0.02);
    close(ratio(nativeMotion.pressIn), 1);
    close(response(nativeMotion.pressIn), 0.15);
    close(ratio(nativeMotion.pressOut), 1);
    close(response(nativeMotion.pressOut), 0.3);
    close(ratio(nativeMotion.settle), 1);
    close(response(nativeMotion.settle), 0.35);
    close(ratio(nativeMotion.pop), 0.6);
    close(response(nativeMotion.pop), 0.35);
    close(ratio(nativeMotion.toggle), 0.73);
    close(response(nativeMotion.toggle), 0.35);
  });
  it("durations are strictly increasing", () => {
    expect(nativeMotion.control).toBeLessThan(nativeMotion.selection);
    expect(nativeMotion.selection).toBeLessThan(nativeMotion.content);
    expect(nativeMotion.content).toBeLessThan(nativeMotion.feature);
  });
  it("the spring is critically damped (no overshoot)", () => {
    expect(Math.abs(ratio(nativeMotion.spring) - 1)).toBeLessThanOrEqual(0.02);
  });
});
