import { View } from "react-native";
import { Image } from "expo-image";
import type Ionicons from "@expo/vector-icons/Ionicons";
import type { PaymentGroup, PaymentMethodInfo } from "@catera/domain";
import { themedStyles, useColors } from "@catera/mobile-ui";
import { DecorativeIcon } from "../layout";
import { paymentLogo } from "./paymentLogos";

const GLYPH: Record<PaymentGroup, keyof typeof Ionicons.glyphMap> = {
  qris: "qr-code-outline",
  ewallet: "wallet-outline",
  va: "business-outline",
  card: "card-outline",
  retail: "storefront-outline",
  paylater: "time-outline",
};

/**
 * The 56×40 tile a payment method leads with: its mark contained in 48×28 (most marks are wordmarks about three times
 * as wide as tall, so a square tile would draw them about 10 tall), or the group glyph while the mark is missing.
 */
export function MethodMark({ info, group }: { info?: PaymentMethodInfo; group?: PaymentGroup }) {
  const styles = useStyles();
  const c = useColors();
  const logo = info ? paymentLogo(info.logo) : undefined;
  return (
    <View testID="pay-mark" style={[styles.tile, logo ? styles.onWhite : null]}>
      {logo ? (
        <Image source={logo} contentFit="contain" style={styles.logo} accessible={false} />
      ) : (
        <DecorativeIcon name={GLYPH[(info?.group ?? group)!]} size={20} color={c.charcoal} />
      )}
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  tile: {
    width: 56,
    height: 40,
    borderRadius: 12,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  // Most marks are dark ink on transparent, made for a light field: the tile under a mark stays white in every theme,
  // as the QRIS quiet zone does.
  onWhite: { backgroundColor: "#FFFFFF" },
  logo: { width: 48, height: 28 },
}));
