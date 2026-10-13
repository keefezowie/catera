import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Reanimated from "react-native-reanimated";
import { StyleSheet } from "react-native";
import { nativeThemes } from "@catera/design-tokens";
import { BUSY_DELAY_MS, Button, StickyAction, useBusy } from "@catera/mobile-ui";

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(false);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const spinner = () => screen.queryByTestId("button-spinner");

describe("Button busy", () => {
  it("busy under 150 ms never shows the spinner", () => {
    const view = render(<Button label="Simpan" busy onPress={() => {}} />);
    act(() => void jest.advanceTimersByTime(BUSY_DELAY_MS - 1));
    expect(BUSY_DELAY_MS).toBe(150);
    expect(spinner()).toBeNull();
    // The answer arrives at 149 ms: the spinner never appears, not even after the delay would have passed.
    view.rerender(<Button label="Simpan" busy={false} onPress={() => {}} />);
    act(() => void jest.advanceTimersByTime(500));
    expect(spinner()).toBeNull();
  });

  it("busy over 150 ms shows it and keeps width and height", () => {
    render(<Button label="Simpan" busy onPress={() => {}} />);
    const before = StyleSheet.flatten(screen.getByRole("button").props.style);
    const labelBefore = screen.getByText("Simpan");
    act(() => void jest.advanceTimersByTime(BUSY_DELAY_MS));
    const spin = spinner();
    expect(spin).toBeTruthy();
    // The spinner takes the label colour.
    expect(spin!.props.color).toBe(StyleSheet.flatten(labelBefore.props.style).color);
    expect(spin!.props.color).toBe(nativeThemes.light.cream);
    // The label stays in the layout (unseen), so the button's box does not change.
    const label = screen.getByText("Simpan");
    expect(StyleSheet.flatten(label.props.style).opacity).toBe(0);
    expect(StyleSheet.flatten(screen.getByRole("button").props.style)).toEqual(before);
    // The spinner is overlaid, never a sibling that grows the box.
    expect(StyleSheet.flatten(spin!.parent!.parent!.props.style)).toMatchObject({ position: "absolute" });
  });

  it("keeps the spinner under reduced motion and drops it when the call settles", () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    const view = render(<Button label="Simpan" busy onPress={() => {}} />);
    act(() => void jest.advanceTimersByTime(BUSY_DELAY_MS));
    expect(spinner()).toBeTruthy();
    view.rerender(<Button label="Simpan" busy={false} onPress={() => {}} />);
    expect(spinner()).toBeNull();
    expect(StyleSheet.flatten(screen.getByText("Simpan").props.style).opacity).toBeUndefined();
  });

  it("a pressed busy button sends nothing", () => {
    const onPress = jest.fn();
    const view = render(<Button label="Simpan" busy onPress={onPress} />);
    fireEvent.press(screen.getByRole("button", { name: "Simpan" }));
    act(() => void jest.advanceTimersByTime(BUSY_DELAY_MS));
    fireEvent.press(screen.getByRole("button", { name: "Simpan" }));
    expect(onPress).not.toHaveBeenCalled();
    view.rerender(<Button label="Simpan" onPress={onPress} />);
    fireEvent.press(screen.getByRole("button", { name: "Simpan" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("busy sets accessibilityState and keeps the label as the name", () => {
    render(<Button label="Simpan" busy onPress={() => {}} />);
    act(() => void jest.advanceTimersByTime(BUSY_DELAY_MS));
    const button = screen.getByRole("button", { name: "Simpan" });
    expect(button.props.accessibilityState).toMatchObject({ busy: true });
    expect(button.props.accessibilityLabel).toBe("Simpan");
  });

  it("an idle button is not busy", () => {
    render(<Button label="Simpan" onPress={() => {}} />);
    expect(screen.getByRole("button").props.accessibilityState).toMatchObject({ busy: false, disabled: false });
  });
});

describe("StickyAction passes busy through", () => {
  it("shows its own spinner id after the delay", () => {
    render(<StickyAction label="Mulai masak" busy testID="act" onPress={() => {}} />);
    expect(screen.queryByTestId("act-spinner")).toBeNull();
    act(() => void jest.advanceTimersByTime(BUSY_DELAY_MS));
    expect(screen.getByTestId("act-spinner")).toBeTruthy();
  });
});

describe("useBusy", () => {
  function Probe({ run }: { run: () => Promise<void> }) {
    const [busy, wrapped] = useBusy(run);
    return <Button label="Kirim" busy={busy} onPress={() => void wrapped()} />;
  }

  it("a double press runs the call once", async () => {
    let finish: () => void = () => {};
    const run = jest.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    render(<Probe run={run} />);
    const press = () => fireEvent.press(screen.getByRole("button", { name: "Kirim" }));
    press();
    press();
    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Kirim" }).props.accessibilityState).toMatchObject({ busy: true });
    await act(async () => finish());
    expect(screen.getByRole("button", { name: "Kirim" }).props.accessibilityState).toMatchObject({ busy: false });
    press();
    expect(run).toHaveBeenCalledTimes(2);
    await act(async () => finish());
  });

  it("drops a second call made straight through the wrapper", async () => {
    const run = jest.fn(async () => "ok");
    let wrapped: () => Promise<string | undefined> = async () => undefined;
    function Capture() {
      const [, fn] = useBusy(run);
      wrapped = fn;
      const [, force] = useState(0);
      return <Button label="x" onPress={() => force(1)} />;
    }
    render(<Capture />);
    let first: Promise<string | undefined> = Promise.resolve(undefined);
    let second: Promise<string | undefined> = Promise.resolve(undefined);
    await act(async () => {
      first = wrapped();
      second = wrapped();
      await Promise.all([first, second]);
    });
    expect(await first).toBe("ok");
    expect(await second).toBeUndefined();
    expect(run).toHaveBeenCalledTimes(1);
  });
});
