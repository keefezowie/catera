import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import * as Reanimated from "react-native-reanimated";
import { RollingNumber, rollDirection, rollPath, ThemeProvider } from "@catera/mobile-ui";

const hidden = { includeHiddenElements: true };
const wrap = (value: string) => (
  <ThemeProvider>
    <RollingNumber value={value} variant="section" testID="n" />
  </ThemeProvider>
);
const measure = (width = 10, height = 22) =>
  act(() => {
    fireEvent(screen.getByTestId("rolling-measure", hidden), "layout", { nativeEvent: { layout: { x: 0, y: 0, width, height } } });
  });

beforeEach(() => {
  jest.restoreAllMocks();
  jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(false);
  jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");
});

describe("RollingNumber", () => {
  it("shows the whole value as one findable text and labels the wrapper with it", async () => {
    render(wrap("Rp 125.000"));
    await act(async () => {});
    expect(screen.getByText("Rp 125.000")).toBeTruthy();
    expect(screen.getAllByLabelText("Rp 125.000").length).toBeGreaterThan(0);
  });

  it("splits into digit columns and static characters once the column size is measured", () => {
    render(wrap("Rp 125.000"));
    expect(screen.queryByTestId("rolling-row", hidden)).toBeNull();
    measure();
    expect(screen.getAllByTestId("rolling-column", hidden)).toHaveLength(6);
    // The full value is still there for selection and for tests, and the columns are hidden from accessibility.
    expect(screen.getByText("Rp 125.000")).toBeTruthy();
    expect(screen.queryByTestId("rolling-row")).toBeNull();
    const [first] = screen.getAllByTestId("rolling-column", hidden);
    expect(first.props.style).toMatchObject({ width: 10, height: 22, overflow: "hidden" });
  });

  it("rolls a changed digit, and only that one, with a timed slide", () => {
    const timing = jest.spyOn(Reanimated, "withTiming");
    const view = render(wrap("Rp 125.000"));
    measure();
    expect(timing).not.toHaveBeenCalled();
    view.rerender(wrap("Rp 125.001"));
    expect(timing).toHaveBeenCalledTimes(1);
    expect(timing.mock.calls[0][0]).toBe(1);
    expect(timing.mock.calls[0][1]).toMatchObject({ duration: 200 });
    expect(screen.getByText("Rp 125.001")).toBeTruthy();
  });

  it("swaps plain text with no animation under reduced motion", () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    const timing = jest.spyOn(Reanimated, "withTiming");
    const view = render(wrap("12"));
    expect(screen.queryByTestId("rolling-measure", hidden)).toBeNull();
    view.rerender(wrap("13"));
    expect(screen.getByText("13")).toBeTruthy();
    expect(screen.queryByTestId("rolling-row", hidden)).toBeNull();
    expect(timing).not.toHaveBeenCalled();
  });

  it("picks the direction of the roll from the number", () => {
    expect(rollDirection("Rp 99.000", "Rp 101.000")).toBe("up");
    expect(rollDirection("Rp 101.000", "Rp 99.000")).toBe("down");
    expect(rollDirection("12", "9")).toBe("down");
    expect(rollPath(9, 0, "up")).toEqual([9, 10]);
    expect(rollPath(0, 9, "down")).toEqual([10, 9]);
    expect(rollPath(3, 4, "up")).toEqual([3, 4]);
    expect(rollPath(4, 3, "down")).toEqual([4, 3]);
  });
});
