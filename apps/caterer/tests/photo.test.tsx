import { photoUri } from "../src/photo";

describe("photoUri", () => {
  const base = "https://api.example.test";
  it("prefixes site-relative paths with the API base", () => {
    expect(photoUri("/uploads/k-1/a.jpg", base)).toBe("https://api.example.test/uploads/k-1/a.jpg");
  });
  it("leaves absolute, protocol-relative and local uris alone", () => {
    expect(photoUri("https://cdn.example.test/a.jpg", base)).toBe("https://cdn.example.test/a.jpg");
    expect(photoUri("//cdn.example.test/a.jpg", base)).toBe("//cdn.example.test/a.jpg");
    expect(photoUri("file:///data/picked.jpg", base)).toBe("file:///data/picked.jpg");
  });
});
