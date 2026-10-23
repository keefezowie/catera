import { View } from "react-native";
import { Image } from "expo-image";
import { nativeLayout } from "@catera/design-tokens";
import { themedStyles, useColors } from "@catera/mobile-ui";
import { DecorativeIcon } from "./DecorativeIcon";

/**
 * A square dish photo: 56 (rows) or 64 (rich rows), radius 8. `notSet` is a menu the person has not chosen yet: a
 * 1.5 dashed `controlRing` tile with the utensils glyph. With neither a photo nor `notSet` it is a quiet tone tile.
 * `testID` names the tile; a not-set tile takes `-not-set` after it.
 */
export function Thumb({
  uri,
  size = nativeLayout.thumb.sm,
  notSet = false,
  testID = "thumb",
}: {
  uri?: string | null;
  size?: 56 | 64;
  notSet?: boolean;
  testID?: string;
}) {
  const c = useColors();
  const styles = useStyles();
  const box = { width: size, height: size };
  if (notSet) {
    return (
      <View testID={`${testID}-not-set`} style={[styles.tile, styles.notSet, box]}>
        <DecorativeIcon name="restaurant-outline" size={Math.round(size * 0.4)} color={c.controlRing} />
      </View>
    );
  }
  return (
    <View testID={testID} style={[styles.tile, styles.photo, box]}>
      {uri ? <Image source={{ uri }} contentFit="cover" style={styles.fill} accessible={false} /> : null}
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  tile: { borderRadius: nativeLayout.radius.thumb, borderCurve: "continuous", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  photo: { backgroundColor: c.sage },
  notSet: { borderWidth: 1.5, borderStyle: "dashed", borderColor: c.controlRing },
  fill: { width: "100%", height: "100%" },
}));
