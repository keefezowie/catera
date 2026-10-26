import { describe, expect, it } from "vitest";
import { nativeMood, type ThemeName } from "../packages/design-tokens/src";

// Palette K (DESIGN.md, Colour revision (Phase G), Mood tokens): "the mood is only the header tint: within a theme, every
// key except `header` is the same for Siang and Malam". `useMoodInks` (packages/mobile-ui/src/mood.tsx) relies on it to
// read the band inks, the selection marks, the hero and the tracker without subscribing to the mood, which keeps a
// Siang/Malam switch from rendering the heroes, the month grid and the hidden tabs again. If a palette ever tints one of
// these keys by mood, this fails, and the readers of `useMoodInks` must go back to `useMoodColors`.
describe("mood palette invariants", () => {
  it.each(["light", "dark"] as ThemeName[])("every key but the header is the same in Siang and Malam (%s)", (scheme) => {
    const { header: _siangHeader, ...siang } = nativeMood[scheme].siang;
    const { header: _malamHeader, ...malam } = nativeMood[scheme].malam;
    expect(malam).toEqual(siang);
  });
});
