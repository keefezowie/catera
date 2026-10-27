import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Reanimated from "react-native-reanimated";
import { AuthMascot, AuthOutcome, type MascotPose } from "@catera/mobile-ui";

const hidden = { includeHiddenElements: true };
const poses: MascotPose[] = ["bingung", "merayakan", "membaca", "mencari", "melambai"];

beforeEach(() => {
  jest.restoreAllMocks();
  jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(false);
});

describe("AuthMascot", () => {
  it("a pose change renders the new pose testID", () => {
    const view = render(<AuthMascot pose="melambai" />);
    expect(screen.getByTestId("auth-mascot-melambai", hidden)).toBeTruthy();
    view.rerender(<AuthMascot pose="bingung" />);
    expect(screen.getByTestId("auth-mascot-bingung", hidden)).toBeTruthy();
    expect(screen.queryByTestId("auth-mascot-melambai", hidden)).toBeNull();
  });

  it("a mount plays no gesture; each pose change plays exactly one, never a loop", () => {
    const timing = jest.spyOn(Reanimated, "withTiming");
    const repeat = jest.spyOn(Reanimated, "withRepeat");
    const view = render(<AuthMascot pose="melambai" />);
    expect(timing).not.toHaveBeenCalled();
    const durations = { bingung: 520, merayakan: 560, membaca: 480, mencari: 640, melambai: 520 };
    let last: MascotPose = "melambai";
    for (const pose of poses) {
      if (pose === last) continue;
      timing.mockClear();
      view.rerender(<AuthMascot pose={pose} />);
      expect(timing).toHaveBeenCalledTimes(1);
      expect(timing.mock.calls[0][1]).toMatchObject({ duration: durations[pose] });
      last = pose;
    }
    view.rerender(<AuthMascot pose="melambai" />);
    expect(timing.mock.calls.at(-1)?.[1]).toMatchObject({ duration: 520 });
    expect(repeat).not.toHaveBeenCalled();
  });

  it("the same pose again starts no animation", () => {
    const timing = jest.spyOn(Reanimated, "withTiming");
    const view = render(<AuthMascot pose="bingung" />);
    view.rerender(<AuthMascot pose="bingung" />);
    view.rerender(<AuthMascot pose="bingung" base={40} />);
    expect(timing).not.toHaveBeenCalled();
  });

  it("reduced motion swaps without a gesture", () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    const timing = jest.spyOn(Reanimated, "withTiming");
    const view = render(<AuthMascot pose="melambai" />);
    view.rerender(<AuthMascot pose="merayakan" />);
    expect(screen.getByTestId("auth-mascot-merayakan", hidden)).toBeTruthy();
    expect(timing).not.toHaveBeenCalled();
  });

  it("is hidden from screen readers", () => {
    render(<AuthMascot pose="mencari" />);
    expect(screen.queryByTestId("auth-mascot-mencari")).toBeNull();
    expect(screen.getByTestId("auth-mascot-mencari", hidden)).toBeTruthy();
  });
});

describe("AuthOutcome", () => {
  it("renders title, body and calls primary", () => {
    const primary = jest.fn();
    const secondary = jest.fn();
    render(<AuthOutcome title="Email terverifikasi" body="Akunmu sudah siap, Sari." primary={{ label: "Mulai", onPress: primary }} secondary={{ label: "Nanti", onPress: secondary }} play />);
    expect(screen.getByTestId("auth-outcome")).toBeTruthy();
    expect(screen.getByText("Email terverifikasi")).toBeTruthy();
    expect(screen.getByText("Akunmu sudah siap, Sari.")).toBeTruthy();
    fireEvent.press(screen.getByText("Mulai"));
    expect(primary).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByText("Nanti"));
    expect(secondary).toHaveBeenCalledTimes(1);
  });

  it("without a secondary shows only the primary button", () => {
    render(<AuthOutcome title="T" body="B" primary={{ label: "Mulai", onPress: jest.fn() }} play />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("play=false shows the resting frame: no animation, facts shown", () => {
    const timing = jest.spyOn(Reanimated, "withTiming");
    render(<AuthOutcome title="Kata sandi diganti" body="Masuk lagi." primary={{ label: "Mulai", onPress: jest.fn() }} play={false} />);
    expect(timing).not.toHaveBeenCalled();
    expect(screen.getByText("Kata sandi diganti")).toBeTruthy();
    expect(screen.getByText("Masuk lagi.")).toBeTruthy();
  });

  it("reduced motion keeps title, body and button", () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    render(<AuthOutcome title="T" body="B" primary={{ label: "Mulai", onPress: jest.fn() }} play />);
    expect(screen.getByText("T")).toBeTruthy();
    expect(screen.getByText("Mulai")).toBeTruthy();
  });
});
