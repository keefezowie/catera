import config from "../app.config";

describe("app config", () => {
  const picker = (config.plugins as unknown[]).find((p) => Array.isArray(p) && p[0] === "expo-image-picker") as [string, Record<string, unknown>];

  it("asks for photos and the camera only: no microphone, and the photo reason names every use", () => {
    expect(picker[1].microphonePermission).toBe(false);
    expect(picker[1].photosPermission).toMatch(/paket/);
    expect(picker[1].photosPermission).toMatch(/menu/);
    expect(picker[1].photosPermission).toMatch(/impor/i);
    expect(picker[1].cameraPermission).toEqual(expect.any(String));
  });
});
