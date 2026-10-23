import { readFileSync } from "fs";
import { join } from "path";

// REPORT items of the 2026-10-23 expo-native-ui audit (AU-1). Style-scan tests: they read the source, because each
// rule is a one-line property that a render test would only reach through several screens.
const root = join(__dirname, "..", "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const A = "apps/customer/src/";
const M = "packages/mobile-ui/src/";

describe("copyable money", () => {
  const cases: [string, RegExp][] = [
    [A + "buy/PaymentScreen.tsx", /<Text variant="title" selectable style=\{\[\{ fontSize: 32/],
    [A + "buy/BuyScreen.tsx", /<Text variant="section" selectable accessibilityRole="text"/],
    [A + "buy/Breakdown.tsx", /<Text variant="bodyL" selectable style=\{\[styles\.rowValue/],
  ];
  it.each(cases)("%s marks the amount selectable", (file, re) => {
    expect(read(file)).toMatch(re);
  });
  it("account payments amounts are selectable", () => {
    expect(read(A + "account/Row.tsx")).toMatch(/selectable={!onPress}/);
  });
});

describe("continuous corners", () => {
  const lines: [string, number[]][] = [
    [M + "components.tsx", [667, 719, 725]],
    [M + "layout/ListCard.tsx", [39]],
    [M + "layout/Thumb.tsx", [41]],
    [A + "today/LiveSlot.tsx", [91]],
    [A + "buy/BuyParts.tsx", [220]],
    [A + "schedule/WeekAgenda.tsx", [219, 228]],
    [M + "FormError.tsx", [57]],
    [M + "ConnectionBanner.tsx", [98]],
    [M + "CalendarSheet.tsx", [285]],
  ];
  it.each(lines)("%s carries borderCurve next to its surface radius", (file) => {
    const src = read(file);
    expect(src).toMatch(/borderRadius: [^,\n]+,\s*borderCurve: "continuous"/);
  });
});

describe("iOS-only trailing chevrons", () => {
  it.each([M + "layout/MediaRow.tsx", A + "account/Row.tsx", A + "plan/PlanList.tsx", A + "schedule/WeekAgenda.tsx"])(
    "%s gates chevron-forward on iOS",
    (file) => {
      const src = read(file);
      expect(src).toMatch(/process\.env\.EXPO_OS === "ios"/);
    },
  );
});

describe("scrim token", () => {
  it.each([A + "discover/PackageDetail.tsx", A + "tomorrow/TomorrowStory.tsx", A + "today/Plate.tsx"])(
    "%s builds its overlay from overlayInk",
    (file) => {
      const src = read(file);
      expect(src).not.toMatch(/rgba\(27,\s*27,\s*26/);
      expect(src).toMatch(/overlayInk/);
    },
  );
  it("withAlpha lives in mobile-ui", () => {
    const { withAlpha } = require("@catera/mobile-ui");
    expect(withAlpha("#1B1B1A", 0.6)).toBe("rgba(27,27,26,0.6)");
  });
});

describe("tidy-ups", () => {
  it.each([M + "FormError.tsx", M + "ConnectionBanner.tsx", "packages/mobile-core/src/provider.tsx"])("%s uses process.env.EXPO_OS", (file) => {
    expect(read(file)).not.toMatch(/Platform\.OS/);
  });
  it.each([M + "SheetHeader.tsx", M + "TopInset.tsx", "packages/mobile-core/src/provider.tsx"])("%s uses use() not useContext", (file) => {
    expect(read(file)).not.toMatch(/useContext/);
  });
});
