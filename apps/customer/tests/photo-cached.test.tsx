import { readFileSync } from "node:fs";
import { join } from "node:path";
import { nativeMotion } from "@catera/design-tokens";
import { render, screen } from "@testing-library/react-native";
import { Image as CachedImage } from "expo-image";
import { StyleSheet } from "react-native";
import * as Reanimated from "react-native-reanimated";
import { CalendarPhotoCell, StoryCover } from "@catera/mobile-ui";

// The Jest environment reports a font scale of 2, which hides the cell photos.
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 800, scale: 2, fontScale: 1 }),
}));

const root = join(__dirname, "..", "..", "..");
const source = (path: string) => readFileSync(join(root, path), "utf8");

// Every remote food photo draws through the shared Photo (expo-image: cache, ground while loading, 180 ms dissolve).
// Bundled brand art (MascotLoading, LaunchCover, SuccessRig, MascotReading, the wordmark) keeps React Native's Image.
const REMOTE = [
  "apps/customer/src/discover/PackageCard.tsx",
  "apps/customer/src/schedule/DayScreen.tsx",
  "apps/customer/src/schedule/ChooseMenu.tsx",
  "apps/customer/src/today/RecapCard.tsx",
  "apps/customer/src/today/EmptyHome.tsx",
  "apps/customer/src/buy/PaidOutcome.tsx",
  "apps/customer/src/tomorrow/TomorrowStory.tsx",
  "packages/mobile-ui/src/CalendarPhotoCell.tsx",
  "packages/mobile-ui/src/StoryCover.tsx",
  "packages/mobile-ui/src/CheckRow.tsx",
];

describe("remote food photos", () => {
  it.each(REMOTE)(
    "%s draws its photo through Photo, not React Native's Image",
    (path) => {
      const text = source(path);
      const rn =
        text.match(/import \{([^}]*)\} from "react-native";/s)?.[1] ?? "";
      expect(rn.split(",").map((s) => s.trim())).not.toContain("Image");
      expect(text).toMatch(/<Photo\b/);
    },
  );

  it("the calendar cell photo is a cached cover image with the selection dissolve", () => {
    render(
      <CalendarPhotoCell
        day={12}
        uri="https://example.test/a.jpg"
        menuSet
        dinnerToo={false}
        past={false}
        today={false}
        selected={false}
        accessibilityLabel="Senin 12"
        onPress={() => undefined}
      />,
    );
    const image = screen.UNSAFE_getByType(CachedImage);
    expect(image.props.source).toEqual({ uri: "https://example.test/a.jpg" });
    expect(image.props.contentFit).toBe("cover");
    expect(image.props.transition).toBe(nativeMotion.selection);
    expect(StyleSheet.flatten(image.props.style).borderRadius).toBeGreaterThan(
      0,
    );
  });

  it("the story cover photo is a cached cover image and keeps its radius", () => {
    render(
      <StoryCover
        uri="https://example.test/a.jpg"
        title="Senin"
        segments={2}
        active={0}
        width={300}
        height={500}
      />,
    );
    const image = screen.UNSAFE_getByType(CachedImage);
    expect(image.props.contentFit).toBe("cover");
    expect(image.props.transition).toBe(nativeMotion.selection);
  });

  it("no fade under reduced motion", () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    render(
      <StoryCover
        uri="https://example.test/a.jpg"
        title="Senin"
        segments={2}
        active={0}
        width={300}
        height={500}
      />,
    );
    expect(screen.UNSAFE_getByType(CachedImage).props.transition).toBe(0);
  });
});
