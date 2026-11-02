import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import * as Reanimated from "react-native-reanimated";
import { AuthMascot, AuthOutcome, ThemeProvider, type MascotPose } from "@catera/mobile-ui";

let mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({ __esModule: true, default: () => mockWindow }));

const hidden = { includeHiddenElements: true };
const poses: MascotPose[] = ["bingung", "merayakan", "membaca", "mencari", "melambai"];
const durations = { bingung: 520, merayakan: 560, membaca: 480, mencari: 640, melambai: 520 };
/** Renders and lets MascotArt's warm-up image load settle, as mascot-art.test.tsx does. */
const mount = async (ui: React.ReactElement) => {
  const view = await render(ui);
  await act(async () => {});
  return view;
};

beforeEach(() => {
  jest.restoreAllMocks();
  mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
  jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(false);
  jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");
});

describe("AuthMascot", () => {
  it("a pose change renders the new pose testID", async () => {
    const view = await mount(<AuthMascot pose="melambai" />);
    expect(screen.getByTestId("auth-mascot-melambai", hidden)).toBeTruthy();
    await view.rerender(<AuthMascot pose="bingung" />);
    expect(screen.getByTestId("auth-mascot-bingung", hidden)).toBeTruthy();
    expect(screen.queryByTestId("auth-mascot-melambai", hidden)).toBeNull();
  });

  it("a mount plays no gesture; each pose change plays exactly one, never a loop", async () => {
    const timing = jest.spyOn(Reanimated, "withTiming");
    const repeat = jest.spyOn(Reanimated, "withRepeat");
    const view = await mount(<AuthMascot pose="melambai" />);
    expect(timing).not.toHaveBeenCalled();
    let last: MascotPose = "melambai";
    for (const pose of [...poses, "melambai" as const]) {
      if (pose === last) continue;
      timing.mockClear();
      await view.rerender(<AuthMascot pose={pose} />);
      expect(timing).toHaveBeenCalledTimes(1);
      expect(timing.mock.calls[0][1]).toMatchObject({ duration: durations[pose] });
      last = pose;
    }
    expect(repeat).not.toHaveBeenCalled();
  });

  it("the same pose again starts no animation", async () => {
    const timing = jest.spyOn(Reanimated, "withTiming");
    const view = await mount(<AuthMascot pose="bingung" />);
    await view.rerender(<AuthMascot pose="bingung" />);
    await view.rerender(<AuthMascot pose="bingung" base={40} />);
    expect(timing).not.toHaveBeenCalled();
  });

  it("reduced motion swaps without a gesture", async () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    const timing = jest.spyOn(Reanimated, "withTiming");
    const view = await mount(<AuthMascot pose="melambai" />);
    await view.rerender(<AuthMascot pose="merayakan" />);
    expect(screen.getByTestId("auth-mascot-merayakan", hidden)).toBeTruthy();
    expect(timing).not.toHaveBeenCalled();
  });

  it("is hidden from screen readers", async () => {
    await mount(<AuthMascot pose="mencari" />);
    expect(screen.queryByTestId("auth-mascot-mencari")).toBeNull();
    expect(screen.getByTestId("auth-mascot-mencari", hidden)).toBeTruthy();
  });
});

describe("AuthOutcome", () => {
  const primary = (onPress = jest.fn()) => ({ label: "Mulai", onPress });

  it("renders title, body and calls primary and secondary", async () => {
    const onPrimary = jest.fn();
    const onSecondary = jest.fn();
    await mount(<AuthOutcome title="Email terverifikasi" body="Akunmu sudah siap, Sari." primary={primary(onPrimary)} secondary={{ label: "Nanti", onPress: onSecondary }} play />);
    expect(screen.getByTestId("auth-outcome")).toBeTruthy();
    expect(screen.getByText("Email terverifikasi")).toBeTruthy();
    expect(screen.getByText("Akunmu sudah siap, Sari.")).toBeTruthy();
    await fireEvent.press(screen.getByText("Mulai"));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByText("Nanti"));
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it("without a secondary shows only the primary button", async () => {
    await mount(<AuthOutcome title="T" body="B" primary={primary()} play />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("play=false shows the resting frame: no animation, facts shown", async () => {
    const timing = jest.spyOn(Reanimated, "withTiming");
    await mount(<AuthOutcome title="Kata sandi diganti" body="Masuk lagi." primary={primary()} play={false} />);
    expect(timing).not.toHaveBeenCalled();
    expect(screen.getByText("Kata sandi diganti")).toBeTruthy();
    expect(screen.getByText("Masuk lagi.")).toBeTruthy();
  });

  it("reduced motion keeps title, body and button", async () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    await mount(<AuthOutcome title="T" body="B" primary={primary()} play />);
    expect(screen.getByText("T")).toBeTruthy();
    expect(screen.getByText("Mulai")).toBeTruthy();
  });

  it("in the dark theme still shows the pressable footer button", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    const onPress = jest.fn();
    await mount(
      <ThemeProvider storageKey="auth-outcome-dark">
        <AuthOutcome title="Kata sandi diganti" body="Masuk lagi." primary={primary(onPress)} play />
      </ThemeProvider>,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Mulai" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("at font scale 1.3 on a 360dp phone keeps both footer buttons rendered and pressable", async () => {
    mockWindow = { width: 360, height: 800, scale: 3, fontScale: 1.3 };
    const onPrimary = jest.fn();
    const onSecondary = jest.fn();
    await mount(<AuthOutcome title="Dapurmu siap" body="Kedai Sari sudah terdaftar. Mulai dengan menambah menu." primary={primary(onPrimary)} secondary={{ label: "Nanti", onPress: onSecondary }} play={false} />);
    await fireEvent.press(screen.getByRole("button", { name: "Mulai" }));
    await fireEvent.press(screen.getByRole("button", { name: "Nanti" }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });
});
