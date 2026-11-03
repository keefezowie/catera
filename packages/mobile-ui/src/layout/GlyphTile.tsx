import type { ComponentProps } from "react";
import { View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useColors } from "../theme";
import { DecorativeIcon } from "./DecorativeIcon";

/** An Ionicons glyph name. */
export type GlyphName = ComponentProps<typeof Ionicons>["name"];

/**
 * The rounded square a saved address leads with (Alamat 44, the Beli picker 40): an outline glyph in forest on the
 * `scheduled` fill. Drawn for the eye only; the row names itself.
 */
export function GlyphTile({ name, size = 44, testID }: { name: GlyphName; size?: number; testID?: string }) {
  const c = useColors();
  return (
    <View
      testID={testID}
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        borderCurve: "continuous",
        backgroundColor: c.scheduled,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <DecorativeIcon name={name} size={size === 44 ? 22 : 20} color={c.forest} />
    </View>
  );
}
