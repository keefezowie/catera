import * as Haptics from "expo-haptics";
import { hapticsFor } from "@catera/mobile-ui";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => jest.clearAllMocks());

describe("hapticsFor", () => {
  it("plays Android's own segment tick for a choice and its key click for a press, not the vibrator", async () => {
    const play = hapticsFor("android");
    play.select();
    play.tap();
    await flush();
    expect(Haptics.performAndroidHapticsAsync).toHaveBeenCalledWith(Haptics.AndroidHaptics.Segment_Tick);
    expect(Haptics.performAndroidHapticsAsync).toHaveBeenCalledWith(Haptics.AndroidHaptics.Virtual_Key);
  });

  it("falls back to the clock tick where the segment tick does not exist (before Android 14)", async () => {
    (Haptics.performAndroidHapticsAsync as jest.Mock).mockImplementationOnce(() => Promise.reject(new Error("unsupported")));
    hapticsFor("android").select();
    await flush();
    expect(Haptics.performAndroidHapticsAsync).toHaveBeenNthCalledWith(1, Haptics.AndroidHaptics.Segment_Tick);
    expect(Haptics.performAndroidHapticsAsync).toHaveBeenNthCalledWith(2, Haptics.AndroidHaptics.Clock_Tick);
  });

  it("keeps the iOS feedback generators on iOS", async () => {
    const play = hapticsFor("ios");
    play.select();
    play.tap();
    await flush();
    expect(Haptics.performAndroidHapticsAsync).not.toHaveBeenCalled();
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });

  it("never throws when the haptics module refuses", async () => {
    (Haptics.performAndroidHapticsAsync as jest.Mock).mockImplementation(() => Promise.reject(new Error("no motor")));
    expect(() => hapticsFor("android").select()).not.toThrow();
    await flush();
    (Haptics.performAndroidHapticsAsync as jest.Mock).mockReset();
  });
});
