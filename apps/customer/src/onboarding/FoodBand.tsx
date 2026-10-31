import { useState } from "react";
import { View } from "react-native";
import Svg, { Polygon } from "react-native-svg";
import { fonts, PolishArt, Text, useColors, useThemePreference, type PolishArtName } from "@catera/mobile-ui";

/** The band as drawn on the 390-wide canvas: five food tokens on scalloped seals, each turned a little. */
const DRAWN_WIDTH = 390;
const DRAWN_HEIGHT = 210;
const TOKENS: { name: PolishArtName; left: number; top: number; size: number; turn: number; rp?: boolean }[] = [
  { name: "token-nasi-kotak", left: 6, top: 0, size: 112, turn: -8, rp: true },
  { name: "token-sate", left: 134, top: 30, size: 96, turn: 7 },
  { name: "token-gado-gado", left: 248, top: 0, size: 104, turn: -5 },
  { name: "token-pisang-goreng", left: 64, top: 112, size: 88, turn: 9 },
  { name: "token-es-teh", left: 286, top: 104, size: 92, turn: -10, rp: true },
];

/** A 28-scallop seal in a 100 box: outer radius 50, inner 46, as on the canvas. */
const SEAL = Array.from({ length: 56 }, (_, i) => {
  const r = i % 2 ? 46 : 50;
  const a = (i * Math.PI) / 28;
  return `${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`;
}).join(" ");

/**
 * Masuk's food band, above the heading on the providers step only. Decorative: the heading says what the screen is.
 * It scales with the width it is given and never past the drawn size, so a narrow phone gets a smaller band, not a
 * cropped one.
 */
export function FoodBand() {
  const c = useColors();
  const { scheme } = useThemePreference();
  // Paper seals: cream on light; in dark the cream token is a deep forest, so the seal takes the card surface and line.
  const dark = scheme === "dark";
  const sealFill = dark ? c.surface : c.cream;
  const sealEdge = dark ? c.line : c.attentionBorder;
  const [width, setWidth] = useState(0);
  const k = width ? Math.min(width / DRAWN_WIDTH, 1) : 0;
  return (
    <View
      testID="food-band"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height: Math.round(DRAWN_HEIGHT * (k || 1)) }}
    >
      {k
        ? TOKENS.map((token) => {
            const size = token.size * k;
            // The art sits inside the seal with 8% margin all round, as drawn.
            const art = size * 0.84;
            return (
              <View
                key={token.name}
                style={{ position: "absolute", left: token.left * k, top: token.top * k, width: size, height: size, transform: [{ rotate: `${token.turn}deg` }] }}
              >
                <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute" }}>
                  <Polygon points={SEAL} fill={sealFill} stroke={sealEdge} strokeWidth={1} strokeLinejoin="round" />
                </Svg>
                <PolishArt name={token.name} size={art} style={{ position: "absolute", left: (size - art) / 2, top: (size - art) / 2 }} />
                {token.rp ? (
                  <View
                    style={{
                      position: "absolute",
                      right: -4,
                      top: -2,
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      backgroundColor: c.forest,
                      alignItems: "center",
                      justifyContent: "center",
                      transform: [{ rotate: `${-token.turn}deg` }],
                    }}
                  >
                    <Text style={{ fontFamily: fonts.extrabold, fontSize: 12, lineHeight: 16, color: c.cream }}>Rp</Text>
                  </View>
                ) : null}
              </View>
            );
          })
        : null}
    </View>
  );
}
