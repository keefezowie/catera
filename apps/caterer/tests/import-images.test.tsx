import { ImageManipulator } from "expo-image-manipulator";
import { MAX_IMAGES, fitsUpload, shrinkPhoto } from "../src/import/images";

jest.mock("expo-image-manipulator", () => {
  const resize = jest.fn();
  const context = {
    resize: jest.fn((size: unknown) => {
      resize(size);
      return context;
    }),
    renderAsync: jest.fn(async () => ({ saveAsync: jest.fn(async () => ({ base64: "c21hbGw=" })) })),
  };
  return { __resize: resize, ImageManipulator: { manipulate: jest.fn(() => context) }, SaveFormat: { JPEG: "jpeg" } };
});

const resize = (jest.requireMock("expo-image-manipulator") as { __resize: jest.Mock }).__resize;

it("shrinks a full-size notebook photo to 1600 px on its long side as JPEG", async () => {
  const photo = await shrinkPhoto({ uri: "file:///a.jpg", width: 3000, height: 4000 });
  expect(ImageManipulator.manipulate).toHaveBeenCalledWith("file:///a.jpg");
  expect(resize).toHaveBeenCalledWith({ height: 1600 });
  // The picked file's uri rides along for the thumbnail; only the shrunk base64 is ever uploaded.
  expect(photo).toEqual({ mediaType: "image/jpeg", data: "c21hbGw=", uri: "file:///a.jpg" });
});

it("keeps the picked uri for a photo that needs no shrinking", async () => {
  const photo = await shrinkPhoto({ uri: "content://media/7", width: 1200, height: 900 });
  expect(photo.uri).toBe("content://media/7");
  expect(photo.data).toBe("c21hbGw=");
});

it("matches the server's limits", () => {
  expect(MAX_IMAGES).toBe(6);
  expect(fitsUpload(["a".repeat(1_000_000), "b".repeat(1_000_000)])).toBe(true);
  expect(fitsUpload(["a".repeat(2_500_000), "b".repeat(1_500_000)])).toBe(false);
});
