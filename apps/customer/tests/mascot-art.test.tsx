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
  stateArtSize,
  successRigFrame,
  SUCCESS_RIG_MS,
  ThemeProvider,
  type MascotPose,
} from "@catera/mobile-ui";
import { __resetMascotWarmForTests } from "../../../packages/mobile-ui/src/brand/MascotArt";
import {
  __setSuccessRigLoadedForTests,
  RIG_LOAD_CEILING_MS,
  successRigLoaded,
} from "../../../packages/mobile-ui/src/brand/SuccessRig";
import { mascotPoses, readingRig, readingRigBox, stillRuntime, successRigBox, visibleBox } from "../../../packages/brand/phaseF";

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

/** A screen's navigation whose focus the test moves with `emit("blur")` and `emit("focus")`, as a navigator does. */
function navigation(initiallyFocused: boolean) {
  let focused = initiallyFocused;
  const listeners: Record<string, Array<() => void>> = {};
  return {
    isFocused: () => focused,
    addListener: (name: string, fn: () => void) => {
      (listeners[name] ??= []).push(fn);
      return () => {
        listeners[name] = (listeners[name] ?? []).filter((listener) => listener !== fn);
      };
    },
    emit(name: "focus" | "blur") {
      focused = name === "focus";
      for (const listener of listeners[name] ?? []) listener();
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
    async (pose: MascotPose, size: number) => {
      await render(<MascotArt pose={pose} size={size} />);
      // The runtime file is trimmed: its box is a fraction of that file, whose true shape is `aspect`.
      const { box, aspect } = stillRuntime[pose];
      // Expected from the fixture box: the file scales so the box is `size` tall, the box's top sits at the top of
      // the frame and the box is centred across the frame's width.
      const height = size / box.h;
      const width = height * aspect;
      const frame = flat("mascot-art");
      const image = flat("mascot-art-image");
      expect(frame.height).toBe(size);
      expect(frame.overflow).toBe("hidden");
      close(image.width, width);
      close(image.height, height);
      close(box.h * image.height, size);
      close(image.top, -box.y * height);
      close(image.left + box.x * width + (box.w * width) / 2, frame.width / 2);
      // Width follows height exactly as on the 1254px source: the trim changes the file, not the pose's shape.
      close(frame.width, (size * visibleBox[pose].w) / visibleBox[pose].h);
      // The whole pose stays inside the frame: only transparent padding is cropped.
      expect(image.left + box.x * width).toBeGreaterThanOrEqual(-1e-6);
      expect(image.left + (box.x + box.w) * width).toBeLessThanOrEqual(frame.width + 1e-6);
      expect(mascotArtFrame(box, size, aspect)).toEqual({
        width: frame.width,
        height: size,
        left: image.left,
        top: image.top,
        canvas: height,
        canvasWidth: width,
      });
      expect(screen.getByTestId("mascot-art-image", hidden).props.contentFit).toBe("fill");
      expect(sourceOf("mascot-art-image")).toContain(`phase-f/runtime/mascot-${pose}.png`);
    },
  );

  it("draws at once on mount, dissolves only when the pose changes, and never under reduced motion", async () => {
    const view = await render(<MascotArt pose="tidur" size={120} />);
    expect(screen.getByTestId("mascot-art-image", hidden).props.transition).toBe(0);
    await view.rerender(<MascotArt pose="membaca" size={120} />);
    expect(screen.getByTestId("mascot-art-image", hidden).props.transition).toBe(200);
    await view.unmount();
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    const reduced = await render(<MascotArt pose="tidur" size={120} />);
    await reduced.rerender(<MascotArt pose="membaca" size={120} />);
    expect(screen.getByTestId("mascot-art-image", hidden).props.transition).toBe(0);
  });

  it("loads every runtime still once through expo-image, then draws from the ref", async () => {
    const { Image } = require("expo-image");
    __resetMascotWarmForTests();
    const view = await render(<MascotArt pose="tidur" size={120} />);
    await act(async () => {});
    await view.rerender(<MascotArt pose="membaca" size={120} />);
    await render(<MascotArt pose="bingung" size={120} />);
    expect(Image.loadAsync).toHaveBeenCalledTimes(mascotPoses.length);
    expect(screen.getAllByTestId("mascot-art-image", hidden)[0].props.source.__ref).toBeDefined();
  });

  it("draws the same file in the dark theme", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    await render(
      <ThemeProvider storageKey="k">
        <MascotArt pose="tidur" size={120} />
      </ThemeProvider>,
    );
    await act(async () => {});
    expect(sourceOf("mascot-art-image")).toContain("phase-f/runtime/mascot-tidur.png");
  });

  it("mascot art is hidden from screen readers", async () => {
    await render(
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
  it("stacks the seven success layers in the rig's draw order, untrimmed", async () => {
    await render(<SuccessRig size={180} play={false} />);
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

  it("rests on its own final frame before it plays: no swap to the still", async () => {
    await render(<SuccessRig size={180} play={false} />);
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

  it("mounted already playing, paints the timeline's first frame, never a flash of the resting frame", async () => {
    jest.useFakeTimers();
    const onDone = jest.fn();
    await render(<SuccessRig size={180} play onDone={onDone} />);
    // The first painted frame: the badge has not appeared yet and the sparkles are hidden.
    expect(flat("success-rig-layer-badge").opacity).toBe(0);
    expect(flat("success-rig-layer-badge").transform).toEqual([{ scale: 0.6 }]);
    expect(flat("success-rig-layer-sparkles").opacity).toBe(0);
    await act(() => jest.advanceTimersByTime(SUCCESS_RIG_MS));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("stays invisible and holds its play until every layer has loaded", async () => {
    __setSuccessRigLoadedForTests(false);
    jest.useFakeTimers();
    const onDone = jest.fn();
    const onReady = jest.fn();
    await render(<SuccessRig size={180} play onDone={onDone} onReady={onReady} />);
    expect(flat("success-rig-layers").opacity).toBe(0);
    await act(() => jest.advanceTimersByTime(SUCCESS_RIG_MS));
    expect(onDone).not.toHaveBeenCalled();
    const ids = screen.getAllByTestId(/^success-rig-layer-/, hidden);
    // Six of seven in: still hidden, still waiting.
    for (const node of ids.slice(0, 6)) await act(() => node.props.onLoad());
    expect(flat("success-rig-layers").opacity).toBe(0);
    expect(onReady).not.toHaveBeenCalled();
    // The last one fails: a failure counts as in, so the rig shows and plays from its first frame.
    await act(() => ids[6].props.onError());
    expect(flat("success-rig-layers").opacity).toBe(1);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(flat("success-rig-layer-badge").opacity).toBe(0);
    await act(() => jest.advanceTimersByTime(SUCCESS_RIG_MS));
    expect(onDone).toHaveBeenCalledTimes(1);
    // Loaded once, a later rig shows at once.
    expect(successRigLoaded()).toBe(true);
  });

  it("shows what has arrived after the load ceiling, so a hung layer never hides the beat", async () => {
    __setSuccessRigLoadedForTests(false);
    jest.useFakeTimers();
    const onDone = jest.fn();
    await render(<SuccessRig size={180} play onDone={onDone} />);
    await act(() => jest.advanceTimersByTime(RIG_LOAD_CEILING_MS));
    expect(flat("success-rig-layers").opacity).toBe(1);
    await act(() => jest.advanceTimersByTime(SUCCESS_RIG_MS));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(successRigLoaded()).toBe(false);
  });

  it("follows the success timeline: squash, hop with the lid open, badge pop, sparkles fade", async () => {
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

  it("SuccessRig under reduced motion renders the merayakan still", async () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    await render(<SuccessRig size={180} play />);
    expect(screen.queryAllByTestId(/^success-rig-layer-/, hidden)).toHaveLength(0);
    expect(sourceOf("mascot-art-image")).toContain("phase-f/runtime/mascot-merayakan.png");
    expect(flat("mascot-art").height).toBe(180);
  });

  it("SuccessRig calls onDone once per play", async () => {
    jest.useFakeTimers();
    const timing = jest.spyOn(Reanimated, "withTiming");
    const onDone = jest.fn();
    const view = await render(<SuccessRig size={180} play={false} onDone={onDone} />);
    await act(() => jest.advanceTimersByTime(SUCCESS_RIG_MS * 2));
    expect(onDone).not.toHaveBeenCalled();
    expect(timing).not.toHaveBeenCalled();

    await view.rerender(<SuccessRig size={180} play onDone={onDone} />);
    // The play starts from the first frame of the timeline.
    expect(timing).toHaveBeenCalledTimes(1);
    expect(timing.mock.calls[0][0]).toBe(SUCCESS_RIG_MS);
    await act(() => jest.advanceTimersByTime(SUCCESS_RIG_MS - 1));
    expect(onDone).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(1));
    expect(onDone).toHaveBeenCalledTimes(1);

    // A re-render with a new callback is not a new play.
    const later = jest.fn();
    await view.rerender(<SuccessRig size={180} play onDone={later} />);
    await act(() => jest.advanceTimersByTime(SUCCESS_RIG_MS * 2));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(later).not.toHaveBeenCalled();

    // Played twice in one mount: the second play restarts from rest and calls back once more.
    await view.rerender(<SuccessRig size={180} play={false} onDone={later} />);
    await view.rerender(<SuccessRig size={180} play onDone={later} />);
    expect(timing).toHaveBeenCalledTimes(2);
    await act(() => jest.advanceTimersByTime(SUCCESS_RIG_MS));
    expect(later).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("calls onDone once per play under reduced motion too, without animating", async () => {
    jest.useFakeTimers();
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    const timing = jest.spyOn(Reanimated, "withTiming");
    const onDone = jest.fn();
    const view = await render(<SuccessRig size={180} play={false} onDone={onDone} />);
    await view.rerender(<SuccessRig size={180} play onDone={onDone} />);
    await act(() => jest.advanceTimersByTime(SUCCESS_RIG_MS));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(timing).not.toHaveBeenCalled();
  });

  it("cancels a play that is stopped before it ends: no late callback", async () => {
    jest.useFakeTimers();
    const onDone = jest.fn();
    const view = await render(<SuccessRig size={180} play onDone={onDone} />);
    await act(() => jest.advanceTimersByTime(400));
    await view.unmount();
    await act(() => jest.advanceTimersByTime(SUCCESS_RIG_MS));
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe("MascotReading", () => {
  it("draws the reading rig: body, the paper highlight, each eye clipped at the seam, and the magnifier", async () => {
    await render(<MascotReading size={120} />);
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

  it("loops while its screen is focused and pauses when it loses focus", async () => {
    const repeat = jest.spyOn(Reanimated, "withRepeat");
    const cancel = jest.spyOn(Reanimated, "cancelAnimation");
    const screenNavigation = navigation(true);
    await render(
      <NavigationContext.Provider value={screenNavigation as never}>
        <MascotReading size={120} />
      </NavigationContext.Provider>,
    );
    expect(repeat).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();

    // Another screen covers it: the loop stops while the rig stays mounted.
    await act(() => screenNavigation.emit("blur"));
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("mascot-reading-body", hidden)).toBeTruthy();
    expect(repeat).toHaveBeenCalledTimes(1);

    // Back in focus, it loops again.
    await act(() => screenNavigation.emit("focus"));
    expect(repeat).toHaveBeenCalledTimes(2);

    await screen.unmount();
    repeat.mockClear();
    await render(
      <NavigationContext.Provider value={navigation(false) as never}>
        <MascotReading size={120} />
      </NavigationContext.Provider>,
    );
    expect(repeat).not.toHaveBeenCalled();
  });

  it("shows the membaca still under reduced motion and never loops", async () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    const repeat = jest.spyOn(Reanimated, "withRepeat");
    await render(<MascotReading size={120} />);
    expect(screen.queryByTestId("mascot-reading-body", hidden)).toBeNull();
    expect(sourceOf("mascot-art-image")).toContain("phase-f/runtime/mascot-membaca.png");
    expect(repeat).not.toHaveBeenCalled();
  });
});

describe("SuccessRing and Sparkle", () => {
  it("SuccessRing grows from 0.35 to 1 by transform with its progress", async () => {
    const view = await render(<SuccessRing size={180} progress={{ value: 0 } as never} />);
    expect(flat("success-ring").transform).toEqual([{ scale: 0.35 }]);
    await view.rerender(<SuccessRing size={180} progress={{ value: 1 } as never} />);
    expect(flat("success-ring").transform).toEqual([{ scale: 1 }]);
    const disc = flat("success-ring");
    expect(disc.width).toBe(180);
    expect(disc.height).toBe(180);
    expect(disc.borderRadius).toBe(90);
    expect(disc.borderWidth).toBe(3);
  });

  it.each(["light", "dark"] as const)("SuccessRing keeps its cream disc and sunrise-ink ring in the %s theme", async (scheme) => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(scheme);
    await render(
      <ThemeProvider storageKey="k">
        <SuccessRing size={180} progress={{ value: 1 } as never} />
      </ThemeProvider>,
    );
    await act(async () => {});
    expect(SecureStore.getItemAsync).toHaveBeenCalled();
    expect(flat("success-ring").backgroundColor).toBe("#FFEFD9");
    expect(flat("success-ring").borderColor).toBe("#9B4309");
  });

  it("Sparkle draws a four-point star or a dot in the colour it is given", async () => {
    const view = await render(<Sparkle kind="star" color="#9B4309" size={14} />);
    expect(screen.getByTestId("sparkle-star", hidden).props.fill.payload).toBe(ReactNative.processColor("#9B4309"));
    await view.rerender(<Sparkle kind="dot" color="#163D2E" size={6} />);
    expect(screen.queryByTestId("sparkle-star", hidden)).toBeNull();
    expect(screen.getByTestId("sparkle-dot", hidden).props.fill.payload).toBe(ReactNative.processColor("#163D2E"));
  });
});

describe("MascotReading transform origins", () => {
  it("renders with magnifierPivot y 0.8094098883572568", async () => {
    await render(<MascotReading size={120} />);
    {
      const origin = flat("mascot-reading-magnifier").transformOrigin;
      // Numbers, never a string holding an unrounded float.
      expect(Array.isArray(origin)).toBe(true);
      expect((origin as unknown[]).every((part) => typeof part === "number" && Number.isFinite(part))).toBe(true);
      expect((origin as number[])[1]).toBeCloseTo(readingRig.magnifierPivot.y * mascotArtFrame(readingRigBox, 120).canvas, 5);
    }
  });
});

describe("stateArtSize", () => {
  it("draws 88, or 72 on a 360dp phone at font scale 1.3 or more", async () => {
    expect(stateArtSize({ width: 360, fontScale: 1 })).toBe(88);
    expect(stateArtSize({ width: 360, fontScale: 1.3 })).toBe(72);
    expect(stateArtSize({ width: 412, fontScale: 1.3 })).toBe(88);
  });
  it("scales a base by the same four-fifths rule: 72 stays 72, and becomes 59 when compact", async () => {
    expect(stateArtSize({ width: 411, fontScale: 1 }, 72)).toBe(72);
    expect(stateArtSize({ width: 360, fontScale: 1.3 }, 72)).toBe(59);
  });
});
