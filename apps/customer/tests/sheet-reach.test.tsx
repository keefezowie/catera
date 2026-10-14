import { Dimensions, ScrollView, StyleSheet } from "react-native";
import { act, render, screen } from "@testing-library/react-native";
import { SheetBody, sheetHiddenBelow } from "@catera/mobile-ui";

/**
 * react-native-screens 4.26 lays an Android form sheet out at its tallest detent and slides it down to the lower one, so
 * the lower part of the scroll view, with the last button, sits under the screen's edge. The body measures itself and
 * ends at the edge.
 */
describe("a form sheet's last button clears the gesture bar", () => {
  it("the part of the body below the screen is what the scroll view gives up", () => {
    // 1080x2400 at 420dpi is 411x914dp: a body from y=480 and 640 high ends at 1120, 206 under the edge.
    expect(sheetHiddenBelow({ top: 480, height: 640, margin: 0, windowHeight: 914 })).toBe(206);
    // Already shortened by 206: the same sheet measures the same, so it does not flip-flop.
    expect(sheetHiddenBelow({ top: 480, height: 434, margin: 206, windowHeight: 914 })).toBe(206);
    // Expanded: the sheet moved up by that much, nothing is below the edge.
    expect(sheetHiddenBelow({ top: 274, height: 640, margin: 0, windowHeight: 914 })).toBe(0);
    expect(sheetHiddenBelow({ top: 274, height: 434, margin: 206, windowHeight: 914 })).toBe(0);
  });

  it("an Android root-stack body ends at the screen's edge once measured", async () => {
    jest.useFakeTimers();
    const screenHeight = Dimensions.get("screen").height;
    const spy = jest
      .spyOn(ScrollView.prototype as unknown as { measureInWindow: () => void }, "measureInWindow")
      .mockImplementation(((cb: (x: number, y: number, w: number, h: number) => void) =>
        cb(0, screenHeight - 600, 400, 800)) as never);
    render(<SheetBody os="android">{null}</SheetBody>);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    const style = StyleSheet.flatten(screen.getByTestId("sheet-body").props.style);
    expect(style.flex).toBe(1);
    expect(style.marginBottom).toBe(200);
    // The foot keeps the gesture bar's inset and 24 inside the scroll content.
    expect(StyleSheet.flatten(screen.getByTestId("sheet-body").props.contentContainerStyle).paddingBottom).toBeGreaterThanOrEqual(24);
    spy.mockRestore();
    jest.useRealTimers();
  });

  it("iOS bodies are never measured or shortened", () => {
    render(<SheetBody os="ios">{null}</SheetBody>);
    expect(StyleSheet.flatten(screen.getByTestId("sheet-body").props.style).marginBottom ?? 0).toBe(0);
  });
});
