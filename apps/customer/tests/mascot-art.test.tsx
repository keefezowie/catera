import { act, render, screen } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { StyleSheet } from "react-native";
import * as Reanimated from "react-native-reanimated";
import * as SecureStore from "expo-secure-store";
import { NavigationContext } from "expo-router/react-navigation";
import {
  MascotArt,
  MascotReading,
  Sparkle,
  SuccessRig,
  SuccessRing,
  mascotArtFrame,
  successRigFrame,
  SUCCESS_RIG_MS,
  ThemeProvider,
  type MascotPose,
} from "@catera/mobile-ui";
import { mascotPoses, successRigBox, visibleBox } from "../../../packages/brand/phaseF";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

// Mascot art is hidden from screen readers, so every query opts in to hidden elements.
const hidden = { includeHiddenElements: true };
const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id, hidden).props.style);
const sourceOf = (id: string) => JSON.stringify(screen.getByTestId(id, hidden).props.source);
const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-6);

function navigation(focused: boolean) {
  const listeners: Record<string, Array<() => void>> = {};
  return {
    isFocused: () => focused,
    addListener: (name: string, fn: () => void) => {
      (listeners[name] ??= []).push(fn);
      return () => {};
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(false);
  jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");
});
afterEach(() => jest.useRealTimers());

describe("MascotArt", () => {
  it.each(mascotPoses.flatMap((pose) => [120, 180].map((size) => [pose, size] as const)))(
    "MascotArt scales the pose so its visible height equals size (%s at %i)",
    (pose: MascotPose, size: number) => {
      render(<MascotArt pose={pose} size={size} />);
      const box = visibleBox[pose];
      // Expected from the fixture box: the canvas scales so the box is `size` tall, the box's top sits at the top of
      // the frame and the box is centred across the frame's width.
      const canvas = size / box.h;
      const frame = flat("mascot-art");
      const image = flat("mascot-art-image");
      expect(frame.height).toBe(size);
      expect(frame.overflow).toBe("hidden");
      close(image.width, canvas);
      close(image.height, canvas);
      close(box.h * image.height, size);
      close(image.top, -box.y * canvas);
      close(image.left + box.x * canvas + (box.w * canvas) / 2, frame.width / 2);
      // The whole pose stays inside the frame: only transparent padding is cropped.
      expect(image.left + box.x * canvas).toBeGreaterThanOrEqual(-1e-6);
      expect(image.left + (box.x + box.w) * canvas).toBeLessThanOrEqual(frame.width + 1e-6);
      expect(mascotArtFrame(box, size)).toEqual({ width: frame.width, height: size, left: image.left, top: image.top, canvas });
      expect(sourceOf("mascot-art-image")).toContain(`phase-f/runtime/mascot-${pose}.png`);
    },
  );

  it("draws the same file in the dark theme", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    render(
      <ThemeProvider storageKey="k">
        <MascotArt pose="tidur" size={120} />
      </ThemeProvider>,
    );
    await act(async () => {});
    expect(sourceOf("mascot-art-image")).toContain("phase-f/runtime/mascot-tidur.png");
  });

  it("mascot art is hidden from screen readers", () => {
    render(
      <>
        <MascotArt pose="bingung" size={120} />
        <SuccessRig size={180} play={false} />
        <MascotReading size={120} />
        <SuccessRing size={180} progress={{ value: 1 } as never} />
        <Sparkle kind="star" color="#9B4309" size={12} />
      </>,
    );
    for (const id of ["mascot-art", "success-rig", "mascot-reading", "success-ring", "sparkle"]) {
      expect(screen.queryByTestId(id)).toBeNull();
      const node = screen.getByTestId(id, hidden);
      expect(node.props.accessible).toBe(false);
      expect(node.props.importantForAccessibility).toBe("no-hide-descendants");
      expect(node.props.accessibilityElementsHidden).toBe(true);
    }
  });
});

describe("SuccessRig", () => {
  it("stacks the seven success layers in the rig's draw order, untrimmed", () => {
    render(<SuccessRig size={180} play={false} />);
    const layers = screen.getAllByTestId(/^success-rig-layer-/, hidden).map((node) => node.props.testID);
    expect(layers).toEqual([
      "success-rig-layer-body",
      "success-rig-layer-lid",
      "success-rig-layer-badge",
      "success-rig-layer-arms-up",
      "success-rig-layer-eyes-open",
      "success-rig-layer-eyes-closed",
      "success-rig-layer-sparkles",
    ]);
    // Every layer covers the same canvas at one origin, sized so the rig's visible height is `size`.
    const canvas = 180 / successRigBox.h;
    for (const id of layers) {
      const style = flat(id);
      close(style.width, canvas);
      close(style.height, canvas);
      expect(style.left ?? 0).toBe(0);
      expect(style.top ?? 0).toBe(0);
      expect(sourceOf(id)).toContain(`phase-f/runtime/rig-${id.slice("success-rig-layer-".length)}.png`);
    }
    // Eyes default to open; the closed eyes are drawn but hidden.
    expect(flat("success-rig-layer-eyes-closed").opacity).toBe(0);
  });

  it("rests on its own final frame before it plays: no swap to the still", () => {
    render(<SuccessRig size={180} play={false} />);
    expect(screen.queryByTestId("mascot-art", hidden)).toBeNull();
    expect(successRigFrame(SUCCESS_RIG_MS)).toEqual({
      hop: 0,
      bodyScaleY: 1,
      lidRotate: 0,
      badgeScale: 1,
      badgeOpacity: 1,
      sparkleScale: 1,
      sparkleOpacity: 0,
    });
    expect(flat("success-rig-layer-badge").opacity).toBe(1);
    expect(flat("success-rig-layer-sparkles").opacity).toBe(0);
  });

  it("follows the success timeline: squash, hop with the lid open, badge pop, sparkles fade", () => {
    expect(successRigFrame(0)).toMatchObject({ hop: 0, bodyScaleY: 1, lidRotate: 0, badgeOpacity: 0, sparkleOpacity: 0 });
    close(successRigFrame(120).bodyScaleY, 0.96);
    close(successRigFrame(420).hop, 0.06);
    expect(successRigFrame(420).lidRotate).toBeLessThan(0);
    expect(successRigFrame(299).badgeOpacity).toBe(0);
    expect(successRigFrame(500).badgeScale).toBeGreaterThan(1);
    close(successRigFrame(620).badgeScale, 1);
    expect(successRigFrame(640).bodyScaleY).toBeLessThan(1);
    close(successRigFrame(700).bodyScaleY, 1);
    close(successRigFrame(700).hop, 0);
    close(successRigFrame(700).lidRotate, 0);
    expect(successRigFrame(450).sparkleOpacity).toBe(0);
    expect(successRigFrame(600).sparkleOpacity).toBeGreaterThan(0.5);
    close(successRigFrame(450).sparkleScale, 0.8);
    close(successRigFrame(1050).sparkleOpacity, 0);
    close(successRigFrame(1050).sparkleScale, 1);
    // Movement stays transform and opacity only, and every value is finite on the way.
    for (let t = 0; t <= SUCCESS_RIG_MS; t += 10) {
      for (const value of Object.values(successRigFrame(t))) expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("SuccessRig under reduced motion renders the merayakan still", () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    render(<SuccessRig size={180} play />);
    expect(screen.queryAllByTestId(/^success-rig-layer-/, hidden)).toHaveLength(0);
    expect(sourceOf("mascot-art-image")).toContain("phase-f/runtime/mascot-merayakan.png");
    expect(flat("mascot-art").height).toBe(180);
  });

  it("SuccessRig calls onDone once per play", () => {
    jest.useFakeTimers();
    const timing = jest.spyOn(Reanimated, "withTiming");
    const onDone = jest.fn();
    const view = render(<SuccessRig size={180} play={false} onDone={onDone} />);
    act(() => jest.advanceTimersByTime(SUCCESS_RIG_MS * 2));
    expect(onDone).not.toHaveBeenCalled();
    expect(timing).not.toHaveBeenCalled();

    view.rerender(<SuccessRig size={180} play onDone={onDone} />);
    // The play starts from the first frame of the timeline.
    expect(timing).toHaveBeenCalledTimes(1);
    expect(timing.mock.calls[0][0]).toBe(SUCCESS_RIG_MS);
    act(() => jest.advanceTimersByTime(SUCCESS_RIG_MS - 1));
    expect(onDone).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(onDone).toHaveBeenCalledTimes(1);

    // A re-render with a new callback is not a new play.
    const later = jest.fn();
    view.rerender(<SuccessRig size={180} play onDone={later} />);
    act(() => jest.advanceTimersByTime(SUCCESS_RIG_MS * 2));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(later).not.toHaveBeenCalled();

    // Played twice in one mount: the second play restarts from rest and calls back once more.
    view.rerender(<SuccessRig size={180} play={false} onDone={later} />);
    view.rerender(<SuccessRig size={180} play onDone={later} />);
    expect(timing).toHaveBeenCalledTimes(2);
    act(() => jest.advanceTimersByTime(SUCCESS_RIG_MS));
    expect(later).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("calls onDone once per play under reduced motion too, without animating", () => {
    jest.useFakeTimers();
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    const timing = jest.spyOn(Reanimated, "withTiming");
    const onDone = jest.fn();
    const view = render(<SuccessRig size={180} play={false} onDone={onDone} />);
    view.rerender(<SuccessRig size={180} play onDone={onDone} />);
    act(() => jest.advanceTimersByTime(SUCCESS_RIG_MS));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(timing).not.toHaveBeenCalled();
  });

  it("cancels a play that is stopped before it ends: no late callback", () => {
    jest.useFakeTimers();
    const onDone = jest.fn();
    const view = render(<SuccessRig size={180} play onDone={onDone} />);
    act(() => jest.advanceTimersByTime(400));
    view.unmount();
    act(() => jest.advanceTimersByTime(SUCCESS_RIG_MS));
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe("MascotReading", () => {
  it("draws the reading rig: body, the paper highlight, each eye clipped at the seam, and the magnifier", () => {
    render(<MascotReading size={120} />);
    const order = screen
      .getAllByTestId(/^mascot-reading-(body|highlight|eye-left|eye-right|magnifier)$/, hidden)
      .map((node) => node.props.testID);
    expect(order).toEqual([
      "mascot-reading-body",
      "mascot-reading-highlight",
      "mascot-reading-eye-left",
      "mascot-reading-eye-right",
      "mascot-reading-magnifier",
    ]);
    // The same eye PNG twice, each in its own clip that meets the other at canvas x = 727.
    const left = flat("mascot-reading-eye-left-clip");
    const right = flat("mascot-reading-eye-right-clip");
    expect(left.overflow).toBe("hidden");
    expect(right.overflow).toBe("hidden");
    close(left.left + left.width, right.left);
    close(right.left / (left.width + right.width), 727 / 1254);
    expect(sourceOf("mascot-reading-eye-left")).toBe(sourceOf("mascot-reading-eye-right"));
    expect(sourceOf("mascot-reading-eye-left")).toContain("phase-f/runtime/rig-reading-eyes.png");
    expect(flat("mascot-reading-highlight").backgroundColor).toBe("#F47B2A");
  });

  it("loops while its screen is focused and pauses when it loses focus", () => {
    const repeat = jest.spyOn(Reanimated, "withRepeat");
    const cancel = jest.spyOn(Reanimated, "cancelAnimation");
    const focused = render(
      <NavigationContext.Provider value={navigation(true) as never}>
        <MascotReading size={120} />
      </NavigationContext.Provider>,
    );
    expect(repeat).toHaveBeenCalledTimes(1);
    focused.unmount();
    expect(cancel).toHaveBeenCalled();

    repeat.mockClear();
    render(
      <NavigationContext.Provider value={navigation(false) as never}>
        <MascotReading size={120} />
      </NavigationContext.Provider>,
    );
    expect(repeat).not.toHaveBeenCalled();
  });

  it("shows the membaca still under reduced motion and never loops", () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    const repeat = jest.spyOn(Reanimated, "withRepeat");
    render(<MascotReading size={120} />);
    expect(screen.queryByTestId("mascot-reading-body", hidden)).toBeNull();
    expect(sourceOf("mascot-art-image")).toContain("phase-f/runtime/mascot-membaca.png");
    expect(repeat).not.toHaveBeenCalled();
  });
});

describe("SuccessRing and Sparkle", () => {
  it("SuccessRing grows from 0.35 to 1 by transform with its progress", () => {
    const view = render(<SuccessRing size={180} progress={{ value: 0 } as never} />);
    expect(flat("success-ring").transform).toEqual([{ scale: 0.35 }]);
    view.rerender(<SuccessRing size={180} progress={{ value: 1 } as never} />);
    expect(flat("success-ring").transform).toEqual([{ scale: 1 }]);
    const disc = flat("success-ring");
    expect(disc.width).toBe(180);
    expect(disc.height).toBe(180);
    expect(disc.borderRadius).toBe(90);
    expect(disc.borderWidth).toBe(3);
  });

  it.each(["light", "dark"] as const)("SuccessRing keeps its cream disc and sunrise-ink ring in the %s theme", async (scheme) => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(scheme);
    render(
      <ThemeProvider storageKey="k">
        <SuccessRing size={180} progress={{ value: 1 } as never} />
      </ThemeProvider>,
    );
    await act(async () => {});
    expect(SecureStore.getItemAsync).toHaveBeenCalled();
    expect(flat("success-ring").backgroundColor).toBe("#FFEFD9");
    expect(flat("success-ring").borderColor).toBe("#9B4309");
  });

  it("Sparkle draws a four-point star or a dot in the colour it is given", () => {
    const view = render(<Sparkle kind="star" color="#9B4309" size={14} />);
    expect(screen.getByTestId("sparkle-star", hidden).props.fill.payload).toBe(ReactNative.processColor("#9B4309"));
    view.rerender(<Sparkle kind="dot" color="#163D2E" size={6} />);
    expect(screen.queryByTestId("sparkle-star", hidden)).toBeNull();
    expect(screen.getByTestId("sparkle-dot", hidden).props.fill.payload).toBe(ReactNative.processColor("#163D2E"));
  });
});
