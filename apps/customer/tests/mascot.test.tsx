import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { AccessibilityInfo, AppState } from "react-native";
import { MascotAnimation, MascotLoading } from "../src/mascot-loading";

beforeEach(() => {
  jest.useFakeTimers();
  jest
    .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
    .mockResolvedValue(true);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
test("announces loading immediately and reveals artwork after 300ms without custom fonts or providers", async () => {
  const screen = render(<MascotLoading startup />);
  expect(screen.getByRole("progressbar").props.accessibilityLabel).toContain(
    "Catera",
  );
  expect(
    screen.getByTestId("mascot-loading-visual", {
      includeHiddenElements: true,
    }),
  ).toHaveStyle({ opacity: 0 });
  await act(async () => {
    jest.advanceTimersByTime(299);
  });
  expect(
    screen.getByTestId("mascot-loading-visual", {
      includeHiddenElements: true,
    }),
  ).toHaveStyle({ opacity: 0 });
  await act(async () => {
    jest.advanceTimersByTime(1);
  });
  expect(
    screen.getByTestId("mascot-loading-visual", {
      includeHiddenElements: true,
    }),
  ).toHaveStyle({ opacity: 1 });
  screen.unmount();
});
test("fast completion clears the reveal timer and permits repeated mounts", async () => {
  const start = jest.spyOn(global, "setTimeout");
  const clear = jest.spyOn(global, "clearTimeout");
  const screen = render(<MascotLoading />);
  const timer =
    start.mock.results[start.mock.calls.findIndex((call) => call[1] === 300)]
      .value;
  await act(async () => {
    jest.advanceTimersByTime(100);
  });
  screen.unmount();
  expect(clear).toHaveBeenCalledWith(timer);
  const next = render(<MascotLoading label="Memuat jadwal…" />);
  expect(next.getByRole("progressbar").props.accessibilityLabel).toBe(
    "Memuat jadwal…",
  );
  next.unmount();
});

test("loaded layers stop for inactivity, background, reduced motion and image failure", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
  let onState: (state: string) => void = () => {};
  let onReduced: (reduced: boolean) => void = () => {};
  const remove = jest.fn();
  jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_event, callback) => {
      onState = callback;
      return { remove };
    });
  jest
    .spyOn(AccessibilityInfo, "addEventListener")
    .mockImplementation((_event, callback) => {
      onReduced = callback as (value: boolean) => void;
      return { remove };
    });
  const screen = render(<MascotAnimation />);
  await act(async () => {});
  act(() => onState("active"));
  const rig = () =>
    screen.getByTestId("mascot-rig", { includeHiddenElements: true });
  expect(rig()).toHaveStyle({ opacity: 0 });
  for (const layer of screen.getAllByTestId("mascot-layer", {
    includeHiddenElements: true,
  }))
    fireEvent(layer, "load");
  expect(rig()).toHaveStyle({ opacity: 1 });
  act(() => onState("background"));
  expect(rig()).toHaveStyle({ opacity: 0 });
  act(() => onState("active"));
  expect(rig()).toHaveStyle({ opacity: 1 });
  act(() => onReduced(true));
  expect(rig()).toHaveStyle({ opacity: 0 });
  act(() => onReduced(false));
  screen.rerender(<MascotAnimation active={false} />);
  expect(rig()).toHaveStyle({ opacity: 0 });
  screen.rerender(<MascotAnimation active />);
  fireEvent(
    screen.getAllByTestId("mascot-layer", { includeHiddenElements: true })[0],
    "error",
  );
  expect(rig()).toHaveStyle({ opacity: 0 });
  screen.unmount();
  expect(remove).toHaveBeenCalledTimes(2);
});
