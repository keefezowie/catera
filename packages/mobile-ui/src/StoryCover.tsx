import { Image, View } from "react-native";
import { nativeThemes } from "@catera/design-tokens";
import { Text } from "./components";

// A cover sits on a photo, so its inks do not follow the theme: the photo is the same in both.
const ink = nativeThemes.light;
const SEGMENT_HEIGHT = 3;
const RADIUS = 16;

/**
 * A story-style cover: the photo cover-fit, a row of progress bars along the top, and the title over a dark gradient
 * at the bottom. The first `active` bars are solid cream and the rest are dimmed, so the cover reads as "this far
 * through". The bars are decoration, hidden from screen readers; the title carries the meaning.
 */
export function StoryCover({
  uri,
  title,
  segments,
  active,
  width,
  height,
}: {
  uri: string;
  title: string;
  segments: number;
  active: number;
  width: number;
  height: number;
}) {
  return (
    <View
      testID="story-cover"
      style={{ width, height, borderRadius: RADIUS, borderCurve: "continuous", overflow: "hidden", backgroundColor: ink.forest }}
    >
      {/* A uri of "" (real data for a day without a photo) leaves the dark ground, which the title still reads on. */}
      {uri ? (
        <Image
          accessibilityIgnoresInvertColors
          source={{ uri }}
          resizeMode="cover"
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width, height }}
        />
      ) : null}
      <View
        testID="story-gradient"
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          experimental_backgroundImage: "linear-gradient(rgba(11,31,22,0) 40%, rgba(11,31,22,0.9))",
        }}
      />
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: "absolute", top: 10, left: 12, right: 12, flexDirection: "row", gap: 4 }}
      >
        {Array.from({ length: segments }, (_, i) => (
          <View
            key={i}
            testID={`story-segment-${i}`}
            style={{
              flex: 1,
              height: SEGMENT_HEIGHT,
              borderRadius: SEGMENT_HEIGHT / 2,
              backgroundColor: ink.cream,
              opacity: i < active ? 1 : 0.4,
            }}
          />
        ))}
      </View>
      <View style={{ position: "absolute", left: 12, right: 12, bottom: 12 }}>
        <Text variant="label" style={{ color: ink.cream, lineHeight: 17 }}>
          {title}
        </Text>
      </View>
    </View>
  );
}
