// FB2 palette directions, second round (Phase G G-a, October 13, 2026). D, E and F from the Mobbin research; G from
// the owner's reference palette (five hexes, plus the derived steps listed in DERIVED_G).
// The owner rejected A, B and C and reopened the hues ("maybe use mobbin's brand colours to rethink the colours").
// This is an extended copy of palette-directions.cjs: same WCAG 2.x maths, same pair list (plus four standalone
// pairs), new directions D, E and F, each with a full token set per look. Research: palette/mobbin-brand-research.md.
// Writes:
//   output/native-review/phase-g/palette/directions-v2.json
//   output/native-review/phase-g/palette/directions-v2.md
// With --embed it rewrites the <script type="application/json" id="fb2-data"> island in canvas/index.html with Today,
// D, E and F, and carries the rejected A, B and C (values and summary only, read from directions.json) marked
// `rejected`, so the canvas can list them under its collapsed note. The old script's --embed would put A/B/C back
// as the live set; do not run it against the canvas any more.
// Run: node output/native-review/phase-g/scripts/palette-directions-v2.cjs [--embed]
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "palette");
const CANVAS = path.join(__dirname, "..", "canvas", "index.html");

/* ---------- WCAG 2.x ---------- */
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (h) => { const [r, g, b] = rgb(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
const over = (fg, a, bg) => hex(rgb(bg).map((v, k) => rgb(fg)[k] * a + v * (1 - a)));

const SUNRISE = "#F47B2A", CHARCOAL = "#2E2E2E", CREAM = "#FFF7E9";
const TODAY_OVERLAY = "#0C1E16"; // rgba(12,30,22,a), Plate.tsx
const WHITE_PHOTO = "#FFFFFF"; // worst case under the overlay
const OVERLAY_TEXT = CREAM; // the hero's photo text stays cream in every direction

const LOOKS = ["light-siang", "light-malam", "dark-siang", "dark-malam"];
const themeOf = (look) => look.split("-")[0];

/* ---------- today (shipped on October 12, 2026), as in palette-directions.cjs ---------- */
const TODAY_THEME = {
  light: { canvas: "#FDFAF3", surface: "#FFFEFA", sage: "#F0F3E9", line: "#E2E3D8", tabBar: "#F2ECDF", charcoal: "#2E2E2E", muted: "#60675F", forest: "#163D2E" },
  dark: { canvas: "#151514", surface: "#232321", sage: "#2A2D27", line: "#34332F", tabBar: "#1E1E1C", charcoal: "#F5F1E8", muted: "#B5B2AA", forest: "#FFF7E9" },
};
const TODAY_MOOD = {
  "light-siang": { header: "#FFEFD9", headerText: "#163D2E", headerMeta: "#6B4A2B", toggleTrack: "#F6DDBE", toggleActive: "#9B4309", onToggleActive: "#FFF7E9", arcTrack: "#E2C29C", markerActive: "#9B4309", markerIdle: "#9A7A55", todayRing: "#9B4309", hero: "#FFFEFA", heroText: "#163D2E", heroMeta: "#60675F", heroShadow: "0 10px 28px rgba(107,74,43,0.16)", pattern: null },
  "light-malam": { header: "#0B1F16", headerText: "#FFF7E9", headerMeta: "#A9BDB0", toggleTrack: "#1C3A2C", toggleActive: "#FFF7E9", onToggleActive: "#0B1F16", arcTrack: "#2C4C3C", markerActive: "#FFF7E9", markerIdle: "#6E8C7C", todayRing: "#F5C9A6", hero: "#1C3A2C", heroText: "#FFF7E9", heroMeta: "#A9BDB0", heroShadow: "0 10px 28px rgba(0,0,0,0.35)", pattern: "#1A3A2B" },
  "dark-siang": { header: "#3A2617", headerText: "#F5F1E8", headerMeta: "#E6C3A2", toggleTrack: "#4C3322", toggleActive: "#F5C9A6", onToggleActive: "#3A1A04", arcTrack: "#6A4A33", markerActive: "#F5C9A6", markerIdle: "#A88A6A", todayRing: "#F5C9A6", hero: "#232321", heroText: "#F5F1E8", heroMeta: "#B5B2AA", heroShadow: "0 10px 28px rgba(0,0,0,0.35)", pattern: null },
  "dark-malam": { header: "#163D2E", headerText: "#F5F1E8", headerMeta: "#CFE0D2", toggleTrack: "#25553F", toggleActive: "#FFF7E9", onToggleActive: "#163D2E", arcTrack: "#2C5A45", markerActive: "#FFF7E9", markerIdle: "#7FA08E", todayRing: "#F5C9A6", hero: "#1C3A2C", heroText: "#F5F1E8", heroMeta: "#CFE0D2", heroShadow: "0 10px 28px rgba(0,0,0,0.35)", pattern: "#1F4A38" },
};
const TODAY_PARTS = (look) => {
  const th = TODAY_THEME[themeOf(look)], m = TODAY_MOOD[look];
  return {
    cta: { fill: SUNRISE, label: CHARCOAL, edge: null },
    field: { fill: m.toggleTrack, edge: null, text: m.headerMeta },
    demo: { fill: th.sage, text: th.muted, edge: null },
    cardEdge: th.line, trackEdge: null, tabEdge: null, heroEdge: null, heroWarn: null,
    photo: { fallback: th.sage, overlayInk: TODAY_OVERLAY, scrimTopAlpha: 0, scrimStartsAt: 0.25, scrimAlpha: 0.22, overlayAlpha: 0.66, ramp: false },
  };
};

/* ---------- the directions ---------- */
// Every direction lists the full theme set (all eight keys the checks read), every nativeMood key per look, and the
// parts. `refs` are the Mobbin screens each direction is drawn from (palette/mobbin-brand-research.md).
const DIRS = {
  today: { label: "Today", name: "Today (shipped October 12)", theme: { light: {}, dark: {} }, mood: TODAY_MOOD, parts: TODAY_PARTS, refs: [] },

  d: {
    label: "D",
    name: "D · One green, two depths",
    line: "One leaf green does the brand's work: the Siang header, the button and the selected tab. Malam is the same green at night depth (today's forest, kept). The meal card is always a plain white card with a drawn edge on a rice-white page, so it never melts into the header. Sunrise steps back to a warning colour.",
    idea: "Brand in one hue at two depths; neutral room; white meal card.",
    refs: [
      { app: "HelloFresh", url: "https://mobbin.com/screens/f504dc3e-3c55-4270-bad9-628cf4c3cbc2", note: "green header, warm off-white page, white cards" },
      { app: "Starbucks", url: "https://mobbin.com/screens/e02f36c5-8004-4844-9e37-8d9a5310cd76", note: "house green deep, accent green for actions" },
      { app: "Too Good To Go", url: "https://mobbin.com/screens/e2b55d00-dcd9-4742-8201-69e1bf965ef2", note: "one deep brand hue for every action" },
      { app: "Glovo (dark)", url: "https://mobbin.com/screens/47740ec5-089f-415d-b440-d8bbb797bde2", note: "neutral dark, brand only where selected" },
    ],
    theme: {
      light: { canvas: "#F7F5F0", surface: "#FFFFFF", sage: "#EEF0EA", line: "#D6D2C7", tabBar: "#FFFFFF", charcoal: "#1E2420", muted: "#5B625C", forest: "#155C3E" },
      dark: { canvas: "#121413", surface: "#1F2321", sage: "#262B28", line: "#333935", tabBar: "#1A1D1B", charcoal: "#EEF1EC", muted: "#A9B0AA", forest: "#8FD6AE" },
    },
    mood: {
      "light-siang": { header: "#1F7A52", headerText: "#FFFFFF", headerMeta: "#E6F3EA", toggleTrack: "#145238", toggleActive: "#FFFFFF", onToggleActive: "#155C3E", arcTrack: "#8CC4A4", markerActive: "#FFFFFF", markerIdle: "#BFE0CC", todayRing: "#FFD27A", hero: "#FFFFFF", heroText: "#155C3E", heroMeta: "#5B625C", heroShadow: "0 10px 28px rgba(20,60,40,0.14)", pattern: null },
      "light-malam": { header: "#163D2E", headerText: "#FBFAF5", headerMeta: "#B9D3C3", toggleTrack: "#0F2C21", toggleActive: "#FBFAF5", onToggleActive: "#163D2E", arcTrack: "#3E6A55", markerActive: "#FBFAF5", markerIdle: "#86AE98", todayRing: "#FFD27A", hero: "#FFFFFF", heroText: "#155C3E", heroMeta: "#5B625C", heroShadow: "0 10px 28px rgba(20,60,40,0.18)", pattern: "#1C4636" },
      "dark-siang": { header: "#23664A", headerText: "#F2F5F0", headerMeta: "#CBE6D6", toggleTrack: "#174A34", toggleActive: "#8FD6AE", onToggleActive: "#0E2E1F", arcTrack: "#4E8A6C", markerActive: "#8FD6AE", markerIdle: "#86C2A2", todayRing: "#FFD27A", hero: "#1F2321", heroText: "#EEF1EC", heroMeta: "#A9B0AA", heroShadow: "0 10px 28px rgba(0,0,0,0.40)", pattern: null },
      "dark-malam": { header: "#163D2E", headerText: "#F2F5F0", headerMeta: "#B9D3C3", toggleTrack: "#0F2C21", toggleActive: "#8FD6AE", onToggleActive: "#0E2E1F", arcTrack: "#3E6A55", markerActive: "#8FD6AE", markerIdle: "#7FA892", todayRing: "#FFD27A", hero: "#1F2321", heroText: "#EEF1EC", heroMeta: "#A9B0AA", heroShadow: "0 10px 28px rgba(0,0,0,0.40)", pattern: "#1C4636" },
    },
    parts: (look, m) => {
      const dark = themeOf(look) === "dark";
      return {
        cta: dark ? { fill: "#8FD6AE", label: "#0E2E1F", edge: null } : { fill: "#155C3E", label: "#FFFFFF", edge: null },
        field: dark ? { fill: "#2A302D", edge: m.markerIdle, text: "#C9D1CB" } : { fill: "#FFFFFF", edge: null, text: "#5B625C" },
        demo: dark ? { fill: "#F3D9A6", text: "#3A2A08", edge: null } : { fill: "#FCEBC0", text: "#5C4400", edge: null },
        cardEdge: dark ? "#4A524D" : "#C9C3B6", tabEdge: dark ? "#333935" : "#C9C3B6", heroEdge: dark ? "#4A524D" : "#C9C3B6",
        heroWarn: dark ? "#FF9B6B" : "#C2410C", trackEdge: m.markerIdle,
        photo: { fallback: "#1E3B2E", overlayInk: TODAY_OVERLAY, scrimTopAlpha: 0, scrimStartsAt: 0, scrimAlpha: 0.30, overlayAlpha: 0.72, ramp: true },
      };
    },
  },

  e: {
    label: "E",
    name: "E · Sambal on a white table",
    line: "A warm chili orange becomes the only brand colour and green leaves the interface (it stays in the art). Siang wears a solid sambal header, Malam a deep kopi brown with peach markers. The page is a white table, cards a warm step down with a drawn edge, and the meal card is white. Every action is the same chili with a white label.",
    idea: "Warm single brand on a white room, the way SEA delivery apps spend one loud colour.",
    refs: [
      { app: "Gojek (GoFood)", url: "https://mobbin.com/screens/4ec458f0-18fe-4b06-963e-a38a06899763", note: "white room, brand only in pills, tab and badges" },
      { app: "Grab", url: "https://mobbin.com/screens/f62e8c4f-d38a-436e-98ef-c2181fef0140", note: "solid brand header over a white list" },
      { app: "DoorDash", url: "https://mobbin.com/screens/efa74da2-de38-4b51-b8d3-c56bb4b52315", note: "one red for every primary action, white label" },
      { app: "talabat", url: "https://mobbin.com/screens/7c91f2fa-a22c-4a44-8e86-8c1d321e45d9", note: "orange brand, action pill in the brand" },
    ],
    theme: {
      light: { canvas: "#FFFFFF", surface: "#F3EEE7", sage: "#F6F2EC", line: "#E3DCD1", tabBar: "#FFFFFF", charcoal: "#22201E", muted: "#625D57", forest: "#B23C0A" },
      dark: { canvas: "#141211", surface: "#221F1D", sage: "#2A2623", line: "#3A3531", tabBar: "#1B1917", charcoal: "#F3EEE7", muted: "#B3ACA4", forest: "#FF9F70" },
    },
    mood: {
      "light-siang": { header: "#B23C0A", headerText: "#FFFFFF", headerMeta: "#FFE6D8", toggleTrack: "#8E2F06", toggleActive: "#FFFFFF", onToggleActive: "#B23C0A", arcTrack: "#E88A5F", markerActive: "#FFFFFF", markerIdle: "#FFB892", todayRing: "#FFE08A", hero: "#FFFFFF", heroText: "#22201E", heroMeta: "#625D57", heroShadow: "0 10px 28px rgba(120,40,8,0.14)", pattern: null },
      "light-malam": { header: "#2A211C", headerText: "#FBF4EA", headerMeta: "#D9C7B5", toggleTrack: "#3D302A", toggleActive: "#FFB892", onToggleActive: "#2A211C", arcTrack: "#6B5546", markerActive: "#FFB892", markerIdle: "#A88F7D", todayRing: "#FFB892", hero: "#FFFFFF", heroText: "#22201E", heroMeta: "#625D57", heroShadow: "0 10px 28px rgba(42,33,28,0.20)", pattern: "#33281F" },
      "dark-siang": { header: "#7A2A08", headerText: "#FBF4EA", headerMeta: "#FFD2BA", toggleTrack: "#5C1F05", toggleActive: "#FFB892", onToggleActive: "#3A1404", arcTrack: "#B65A33", markerActive: "#FFB892", markerIdle: "#E0956C", todayRing: "#FFE08A", hero: "#221F1D", heroText: "#F3EEE7", heroMeta: "#B3ACA4", heroShadow: "0 10px 28px rgba(0,0,0,0.40)", pattern: null },
      "dark-malam": { header: "#3B2E24", headerText: "#FBF4EA", headerMeta: "#D9C7B5", toggleTrack: "#2A211C", toggleActive: "#FFB892", onToggleActive: "#2A1206", arcTrack: "#6B5546", markerActive: "#FFB892", markerIdle: "#B39A86", todayRing: "#FFB892", hero: "#221F1D", heroText: "#F3EEE7", heroMeta: "#B3ACA4", heroShadow: "0 10px 28px rgba(0,0,0,0.40)", pattern: "#46372B" },
    },
    parts: (look, m) => {
      const dark = themeOf(look) === "dark";
      return {
        cta: dark ? { fill: "#FF9F70", label: "#2A1206", edge: null } : { fill: "#B23C0A", label: "#FFFFFF", edge: null },
        field: dark ? { fill: "#2A2623", edge: m.markerIdle, text: "#CFC7BE" } : { fill: "#FFFFFF", edge: null, text: "#625D57" },
        demo: dark ? { fill: "#FFD2BA", text: "#3A1404", edge: null } : { fill: "#FFE6D6", text: "#7A2A08", edge: null },
        cardEdge: dark ? "#4D4640" : "#CFC6B8", tabEdge: dark ? "#3A3531" : "#CFC6B8", heroEdge: dark ? "#4D4640" : "#CFC6B8",
        heroWarn: dark ? "#FF8A80" : "#A8201A", trackEdge: m.markerIdle,
        photo: { fallback: "#2A211C", overlayInk: "#1E1410", scrimTopAlpha: 0, scrimStartsAt: 0, scrimAlpha: 0.30, overlayAlpha: 0.72, ramp: true },
      };
    },
  },

  f: {
    label: "F",
    name: "F · Deep teal, tonal cards",
    line: "A new deep teal replaces forest, and the meal card wears it in every look, with a white button on it. Siang has a light mint header, Malam a deep ink one. Cards are one tonal step below the page with no border, as Material 3 does, and marigold is the one warm accent (today ring, Gagal diantar).",
    idea: "A calm new hue that is not the old forest, carried by tone rather than lines.",
    refs: [
      { app: "Too Good To Go", url: "https://mobbin.com/screens/f85e52d4-7e9f-41b4-9794-d94db8421ffc", note: "deep teal actions, tonal cards with no border" },
      { app: "sweetgreen", url: "https://mobbin.com/screens/f77bb82b-0ccc-4660-a7bd-c6938d5e46c6", note: "deep green-teal for selection, tonal greige cards" },
      { app: "Deliveroo", url: "https://mobbin.com/screens/fa8ec815-fc60-4287-91e7-e491e4448dc4", note: "bright teal for icons, a darker teal ink for text" },
      { app: "Starbucks", url: "https://mobbin.com/screens/e02f36c5-8004-4844-9e37-8d9a5310cd76", note: "status card in the brand with a white pill on it" },
    ],
    theme: {
      light: { canvas: "#FAF9F6", surface: "#DDE5E0", sage: "#E7ECE9", line: "#C3CEC8", tabBar: "#DDE5E0", charcoal: "#1C2423", muted: "#55605C", forest: "#0B5E59" },
      dark: { canvas: "#101413", surface: "#212B29", sage: "#263230", line: "#33403D", tabBar: "#212B29", charcoal: "#EDF3F1", muted: "#A7B5B1", forest: "#7FD3C6" },
    },
    mood: {
      "light-siang": { header: "#CBE7DF", headerText: "#0B3B39", headerMeta: "#2F5A55", toggleTrack: "#FFFFFF", toggleActive: "#0B5E59", onToggleActive: "#FFFFFF", arcTrack: "#8DBDB2", markerActive: "#0B5E59", markerIdle: "#4F7F78", todayRing: "#9A4A0C", hero: "#0B5E59", heroText: "#FFFFFF", heroMeta: "#CDEAE3", heroShadow: "0 10px 28px rgba(11,94,89,0.22)", pattern: null },
      "light-malam": { header: "#10262B", headerText: "#F2F7F5", headerMeta: "#A9C4BE", toggleTrack: "#1B3A3F", toggleActive: "#F2F7F5", onToggleActive: "#10262B", arcTrack: "#3D6863", markerActive: "#F2F7F5", markerIdle: "#6F9690", todayRing: "#F2B33D", hero: "#0F6A64", heroText: "#FFFFFF", heroMeta: "#D3ECE6", heroShadow: "0 10px 28px rgba(0,0,0,0.30)", pattern: "#17323A" },
      "dark-siang": { header: "#1E4A45", headerText: "#EDF3F1", headerMeta: "#BFD9D3", toggleTrack: "#163935", toggleActive: "#7FD3C6", onToggleActive: "#0B2B28", arcTrack: "#3E7A71", markerActive: "#7FD3C6", markerIdle: "#6FA59C", todayRing: "#F2B33D", hero: "#0F6A64", heroText: "#FFFFFF", heroMeta: "#D3ECE6", heroShadow: "0 10px 28px rgba(0,0,0,0.40)", pattern: null },
      "dark-malam": { header: "#1A2E33", headerText: "#EDF3F1", headerMeta: "#A9C4BE", toggleTrack: "#24414A", toggleActive: "#EDF3F1", onToggleActive: "#1A2E33", arcTrack: "#3D5F66", markerActive: "#EDF3F1", markerIdle: "#6F9690", todayRing: "#F2B33D", hero: "#0F6A64", heroText: "#FFFFFF", heroMeta: "#D3ECE6", heroShadow: "0 10px 28px rgba(0,0,0,0.40)", pattern: "#20383E" },
    },
    parts: (look, m) => {
      const dark = themeOf(look) === "dark";
      return {
        cta: { fill: "#FFFFFF", label: m.hero, edge: null },
        field: {
          "light-siang": { fill: "#FFFFFF", edge: "#4F7F78", text: "#55605C" },
          "light-malam": { fill: "#1B3A3F", edge: "#6F9690", text: "#C9DCD7" },
          "dark-siang": { fill: "#163935", edge: "#6FA59C", text: "#BFD9D3" },
          "dark-malam": { fill: "#24414A", edge: "#6F9690", text: "#C9DCD7" },
        }[look],
        demo: dark ? { fill: "#F2B33D", text: "#2A1E00", edge: null } : { fill: "#0B3B39", text: "#CBE7DF", edge: null },
        cardEdge: null, tabEdge: null, heroEdge: null,
        heroWarn: "#F2B33D", trackEdge: m.markerIdle,
        photo: { fallback: "#0B3B39", overlayInk: "#071E1D", scrimTopAlpha: 0, scrimStartsAt: 0, scrimAlpha: 0.30, overlayAlpha: 0.72, ramp: true },
      };
    },
  },

  // G: the owner's reference palette (five hexes). Base hexes are used as given; every other value is a tonal step of
  // one of those hues, added only where a pair failed with the base hexes. See DERIVED_G below.
  g: {
    label: "G",
    name: "G · Linen, olive and forest",
    line: "Built from your reference palette. Light is linen and beige with forest ink: beige cards and tab bar one tonal step below a linen page, a linen meal card with a taupe edge, a beige Siang header and a forest Malam header, and a forest button. Dark is made from forest and taupe depths, not grey. There is no orange: warnings and markers use the palette's own deep tones.",
    idea: "The owner's calm, earthy palette: linen sofa, olive branch, forest.",
    refs: [{ app: "Owner's reference palette", url: null, note: "five colours supplied on 2026-10-13" }],
    palette: [["Linen Cream", "#EDE5D8"], ["Warm Beige", "#D8C8B4"], ["Mushroom Taupe", "#9B8D7A"], ["Olive Sage", "#6E7C61"], ["Forest Green", "#2F4A3A"]],
    theme: {
      light: { canvas: "#EDE5D8", surface: "#D8C8B4", sage: "#EDE5D8", line: "#D8C8B4", tabBar: "#D8C8B4", charcoal: "#2F4A3A", muted: "#5A4F42", forest: "#2F4A3A" },
      dark: { canvas: "#16231C", surface: "#2F4A3A", sage: "#2F4A3A", line: "#3E362D", tabBar: "#2F4A3A", charcoal: "#EDE5D8", muted: "#D8C8B4", forest: "#EDE5D8" },
    },
    mood: {
      "light-siang": { header: "#D8C8B4", headerText: "#2F4A3A", headerMeta: "#5A4F42", toggleTrack: "#EDE5D8", toggleActive: "#2F4A3A", onToggleActive: "#EDE5D8", arcTrack: "#9B8D7A", markerActive: "#2F4A3A", markerIdle: "#5E6B52", todayRing: "#5A4F42", hero: "#EDE5D8", heroText: "#2F4A3A", heroMeta: "#5A4F42", heroShadow: "0 10px 28px rgba(47,74,58,0.14)", pattern: null },
      "light-malam": { header: "#2F4A3A", headerText: "#EDE5D8", headerMeta: "#D8C8B4", toggleTrack: "#16231C", toggleActive: "#EDE5D8", onToggleActive: "#2F4A3A", arcTrack: "#6E7C61", markerActive: "#EDE5D8", markerIdle: "#B0A390", todayRing: "#D8C8B4", hero: "#EDE5D8", heroText: "#2F4A3A", heroMeta: "#5A4F42", heroShadow: "0 10px 28px rgba(22,35,28,0.24)", pattern: null },
      "dark-siang": { header: "#3E362D", headerText: "#EDE5D8", headerMeta: "#D8C8B4", toggleTrack: "#16231C", toggleActive: "#D8C8B4", onToggleActive: "#2F4A3A", arcTrack: "#6E7C61", markerActive: "#EDE5D8", markerIdle: "#9B8D7A", todayRing: "#D8C8B4", hero: "#2F4A3A", heroText: "#EDE5D8", heroMeta: "#D8C8B4", heroShadow: "0 10px 28px rgba(0,0,0,0.40)", pattern: null },
      "dark-malam": { header: "#2F4A3A", headerText: "#EDE5D8", headerMeta: "#D8C8B4", toggleTrack: "#16231C", toggleActive: "#D8C8B4", onToggleActive: "#2F4A3A", arcTrack: "#6E7C61", markerActive: "#EDE5D8", markerIdle: "#B0A390", todayRing: "#D8C8B4", hero: "#3E362D", heroText: "#EDE5D8", heroMeta: "#D8C8B4", heroShadow: "0 10px 28px rgba(0,0,0,0.40)", pattern: null },
    },
    parts: (look, m) => {
      const dark = themeOf(look) === "dark";
      return {
        cta: dark ? { fill: "#EDE5D8", label: "#2F4A3A", edge: null } : { fill: "#2F4A3A", label: "#EDE5D8", edge: null },
        field: dark || look === "light-malam" ? { fill: "#16231C", edge: m.markerIdle, text: "#D8C8B4" } : { fill: "#EDE5D8", edge: "#5E6B52", text: "#5A4F42" },
        demo: dark ? { fill: "#D8C8B4", text: "#2F4A3A", edge: null } : { fill: "#5E6B52", text: "#EDE5D8", edge: null },
        cardEdge: dark ? null : null, tabEdge: null, heroEdge: dark ? null : "#9B8D7A",
        heroWarn: dark ? "#D8C8B4" : "#5A4F42", trackEdge: m.markerIdle,
        photo: { fallback: "#16231C", overlayInk: "#16231C", scrimTopAlpha: 0, scrimStartsAt: 0, scrimAlpha: 0.30, overlayAlpha: 0.72, ramp: true },
      };
    },
  },
};
// H: today's palette, neutral-led (owner, 2026-10-13). Same hues as today's tokens. Neutrals carry headers, meal
// cards, page, tab bar and markers; forest is the primary button and the today ring, sunrise ink the single active
// tracker stop (`activeStop`). Siang is a warm neutral header (today's cream), Malam a cool one (today's sage); the
// roles keep one family in every look and only the tone moves. Derived steps: DERIVED_H.
const H = {
  label: "H",
  name: "H · Today's palette, neutral-led",
  line: "Today's hues, with neutrals doing most of the work. Headers are a tinted neutral: warm cream for Siang, cool sage for Malam, the same two tones darkened in dark mode. The meal card is the plain card with a fine edge, the page one neutral step down, markers charcoal and grey. Forest is spent on the main button and the today ring; sunrise ink marks the one active tracker stop.",
  idea: "Today's palette with the colour taken off the big surfaces.",
  refs: [{ app: "Today's palette, neutral-led", url: null, note: "forest, sunrise, cream, charcoal and today's neutrals" }],
  theme: {
    light: { canvas: "#E0DBCE", surface: "#FFFEFA", sage: "#F0F3E9", line: "#D3CEC1", tabBar: "#FFFEFA", charcoal: "#2E2E2E", muted: "#555B54", forest: "#163D2E" },
    dark: { canvas: "#151514", surface: "#292927", sage: "#2A2D27", line: "#3A3A37", tabBar: "#292927", charcoal: "#F5F1E8", muted: "#B5B2AA", forest: "#9CCBAE" },
  },
  mood: {},
  parts: (look, m) => {
    const dark = themeOf(look) === "dark";
    return {
      cta: dark ? { fill: "#9CCBAE", label: "#163D2E", edge: null } : { fill: "#163D2E", label: "#FFF7E9", edge: null },
      field: dark ? { fill: "#292927", edge: "#8A8780", text: "#B5B2AA" } : { fill: "#FFFEFA", edge: "#858D80", text: "#555B54" },
      demo: dark ? { fill: "#151514", text: "#B5B2AA", edge: null } : { fill: "#E0DBCE", text: "#555B54", edge: null },
      cardEdge: null, tabEdge: null, heroEdge: dark ? "#4E4C47" : "#C9C6BA",
      heroWarn: dark ? "#FF8F80" : "#A33024", trackEdge: m.markerIdle,
      activeStop: dark ? "#F47B2A" : "#9B4309",
      photo: { fallback: "#2E2E2E", overlayInk: "#1B1B1A", scrimTopAlpha: 0, scrimStartsAt: 0, scrimAlpha: 0.30, overlayAlpha: 0.72, ramp: true },
    };
  },
};
{
  const lightMood = (header) => ({ header, headerText: "#2E2E2E", headerMeta: "#555B54", toggleTrack: "#E0DBCE", toggleActive: "#2E2E2E", onToggleActive: "#FFF7E9", arcTrack: "#C9C6BA", markerActive: "#2E2E2E", markerIdle: "#858D80", todayRing: "#163D2E", hero: "#FFFEFA", heroText: "#2E2E2E", heroMeta: "#555B54", heroShadow: "0 6px 18px rgba(46,46,46,0.10)", pattern: null });
  const darkMood = (header) => ({ header, headerText: "#F5F1E8", headerMeta: "#B5B2AA", toggleTrack: "#151514", toggleActive: "#F5F1E8", onToggleActive: "#2E2E2E", arcTrack: "#4E4C47", markerActive: "#F5F1E8", markerIdle: "#8A8780", todayRing: "#9CCBAE", hero: "#292927", heroText: "#F5F1E8", heroMeta: "#B5B2AA", heroShadow: "0 6px 18px rgba(0,0,0,0.35)", pattern: null });
  H.mood = { "light-siang": lightMood("#FFF7E9"), "light-malam": lightMood("#F0F3E9"), "dark-siang": darkMood("#2E2B25"), "dark-malam": darkMood("#2A2D27") };
}
const DERIVED_H = [
  { name: "Page neutral", hex: "#E0DBCE", of: "today's canvas #FDFAF3 / cream", why: "the light page: today's canvas sits 1.03:1 under white cards and 1.08:1 under the cream header; this step puts cards 1.37:1, the cream (Siang) header 1.30:1 and the sage (Malam) header 1.23:1 off the page" },
  { name: "Muted deep", hex: "#555B54", of: "today's muted #60675F", why: "muted text, header meta, demo strip text: #60675F is 4.22:1 on the new page; this step gives 5.05:1 or more on every light ground" },
  { name: "Card edge", hex: "#C9C6BA", of: "today's line #E2E3D8", why: "the meal card's drawn edge (light): the white card is 1.06:1 on the cream header and 1.11:1 on the sage one; the edge reaches 1.61:1 and 1.52:1 (also the light arc track, decorative)" },
  { name: "Dark card", hex: "#292927", of: "today's dark surface #232321", why: "dark cards, tab bar and meal card: #232321 is 1.16:1 on the dark page; this step clears 1.2:1" },
  { name: "Dark warm header", hex: "#2E2B25", of: "today's dark sage #2A2D27, warmed toward cream", why: "dark Siang header, the dark twin of the cream header (Malam keeps today's dark sage #2A2D27)" },
  { name: "Dark card edge", hex: "#4E4C47", of: "today's dark line #34332F", why: "the dark meal card's edge: the card is about 1.04:1 on either dark header; the edge reaches 1.63:1 or more" },
  { name: "Forest light", hex: "#9CCBAE", of: "Forest #163D2E", why: "the dark primary button, today ring and selected tab label: forest itself is 1.21:1 on the dark card; the same hue lightened keeps forest's role in dark mode" },
  { name: "Overlay ink", hex: "#1B1B1A", of: "Charcoal #2E2E2E", why: "a neutral photo overlay instead of today's green-black one, so the photo text block carries no hue" },
  { name: "Lines (decorative)", hex: "#D3CEC1 / #3A3A37", of: "today's line", why: "row separators re-stepped for the new page tone; decorative, not in the pair list" },
];
H.derived = DERIVED_H;
// The owner found H too neutral ("the app lost its design touch, turn it up a notch"). H above is kept for the record as
// "H (v1)" (md and json only, not on the canvas); H2 below is the live H.
H.label = "H (v1)";
H.name = "H (v1) · Today's palette, neutral-led";

// H, revised: still neutral-led, but recognisably Catera. Headers carry a real mood tint (apricot Siang, sage Malam;
// warm brown and green in dark), the meal card is a tinted card with an edge in the mood's deep ink, forest marks the
// active tab, the today ring, the selected Siang/Malam pill and the button, and sunrise ink is the highlight on the
// active tracker stop and on prices (`accent`). Every role keeps one family in all four looks; only the tone moves.
const H2 = {
  label: "H",
  name: "H · Today's palette, neutral-led",
  line: "Today's hues with neutrals still doing most of the work, turned up a notch. Siang has a soft apricot header and Malam a soft sage one (a warm brown and a green in dark). The meal card is a tinted card (cream by day, pale sage at night) with an edge in the mood's deep ink. Forest marks the button, the active tab, the selected pill and the today ring; sunrise ink is the highlight on the active tracker stop and on prices.",
  idea: "Neutral-led, with the mood tint and the brand back in a few chosen spots.",
  refs: [{ app: "Today's palette, neutral-led", url: null, note: "forest, sunrise, cream, charcoal and today's neutrals; revised after the owner's note" }],
  theme: {
    light: { canvas: "#ECE6DA", surface: "#FFFEFA", sage: "#F0F3E9", line: "#DCD5C7", tabBar: "#FFFEFA", charcoal: "#2E2E2E", muted: "#60675F", forest: "#163D2E" },
    dark: { canvas: "#151514", surface: "#292927", sage: "#2A2D27", line: "#3A3A37", tabBar: "#292927", charcoal: "#F5F1E8", muted: "#B5B2AA", forest: "#9CCBAE" },
  },
  mood: {
    "light-siang": { header: "#F2C998", headerText: "#163D2E", headerMeta: "#5E3F22", toggleTrack: "#FFFEFA", toggleActive: "#163D2E", onToggleActive: "#FFF7E9", arcTrack: "#D49A5E", markerActive: "#163D2E", markerIdle: "#7E5933", todayRing: "#163D2E", hero: "#FFF7E9", heroText: "#163D2E", heroMeta: "#60675F", heroShadow: "0 8px 22px rgba(107,74,43,0.14)", pattern: null },
    "light-malam": { header: "#C5D6BE", headerText: "#163D2E", headerMeta: "#33493B", toggleTrack: "#FFFEFA", toggleActive: "#163D2E", onToggleActive: "#FFF7E9", arcTrack: "#8FAE96", markerActive: "#163D2E", markerIdle: "#4F6B58", todayRing: "#163D2E", hero: "#F3F6EF", heroText: "#163D2E", heroMeta: "#5A6159", heroShadow: "0 8px 22px rgba(22,61,46,0.14)", pattern: null },
    "dark-siang": { header: "#4A3423", headerText: "#F5F1E8", headerMeta: "#E6C3A2", toggleTrack: "#151514", toggleActive: "#9CCBAE", onToggleActive: "#163D2E", arcTrack: "#7A5A3E", markerActive: "#9CCBAE", markerIdle: "#B08A66", todayRing: "#9CCBAE", hero: "#2E2A25", heroText: "#F5F1E8", heroMeta: "#B5B2AA", heroShadow: "0 8px 22px rgba(0,0,0,0.35)", pattern: null },
    "dark-malam": { header: "#22402F", headerText: "#F5F1E8", headerMeta: "#CFE0D2", toggleTrack: "#151514", toggleActive: "#9CCBAE", onToggleActive: "#163D2E", arcTrack: "#4F7360", markerActive: "#9CCBAE", markerIdle: "#7FA08E", todayRing: "#9CCBAE", hero: "#232B26", heroText: "#F5F1E8", heroMeta: "#B5B2AA", heroShadow: "0 8px 22px rgba(0,0,0,0.35)", pattern: null },
  },
  parts: (look, m) => {
    const dark = themeOf(look) === "dark";
    const malam = look.endsWith("malam");
    return {
      cta: dark ? { fill: "#9CCBAE", label: "#163D2E", edge: null } : { fill: "#163D2E", label: "#FFF7E9", edge: null },
      field: dark ? { fill: "#292927", edge: m.markerIdle, text: "#B5B2AA" } : { fill: "#FFFEFA", edge: m.markerIdle, text: "#60675F" },
      demo: dark ? { fill: "#9CCBAE", text: "#163D2E", edge: null } : { fill: "#163D2E", text: "#FFF7E9", edge: null },
      cardEdge: null, tabEdge: null,
      heroEdge: dark ? (malam ? "#4F7360" : "#7A5A3E") : (malam ? "#8FAE96" : "#D49A5E"),
      heroWarn: dark ? "#FF8F80" : "#A33024", trackEdge: m.markerIdle,
      activeStop: dark ? "#F47B2A" : "#9B4309",
      accent: dark ? "#F5C9A6" : "#9B4309",
      photo: { fallback: "#163D2E", overlayInk: TODAY_OVERLAY, scrimTopAlpha: 0, scrimStartsAt: 0, scrimAlpha: 0.30, overlayAlpha: 0.72, ramp: true },
    };
  },
};
// I: no moods, plain system light and dark (owner, 2026-10-13). Spirit of the revised H. The script is keyed on four
// looks, so Siang and Malam carry the same values; the pair count stays 156 but light and dark are the only real looks.
// One header for both: sage, the light tint of forest, because it carries the brand without implying a time of day.
const I_LIGHT = { header: "#C5D6BE", headerText: "#163D2E", headerMeta: "#33493B", toggleTrack: "#FFFEFA", toggleActive: "#163D2E", onToggleActive: "#FFF7E9", arcTrack: "#8FAE96", markerActive: "#163D2E", markerIdle: "#4F6B58", todayRing: "#163D2E", hero: "#FFF7E9", heroText: "#163D2E", heroMeta: "#60675F", heroShadow: "0 8px 22px rgba(22,61,46,0.14)", pattern: null };
const I_DARK = { header: "#22402F", headerText: "#F5F1E8", headerMeta: "#CFE0D2", toggleTrack: "#151514", toggleActive: "#9CCBAE", onToggleActive: "#163D2E", arcTrack: "#4F7360", markerActive: "#9CCBAE", markerIdle: "#7FA08E", todayRing: "#9CCBAE", hero: "#2E2A25", heroText: "#F5F1E8", heroMeta: "#B5B2AA", heroShadow: "0 8px 22px rgba(0,0,0,0.35)", pattern: null };
const I = {
  label: "I",
  name: "I · No moods, light and dark",
  line: "No Siang or Malam: the app follows the system's light or dark mode only. One sage header (forest's light tint), a cream meal card with an apricot edge, a neutral page and white cards. Forest is the button, the active tab, selected chips and the today ring; sunrise ink marks the active tracker stop and prices.",
  idea: "The revised H without the mood layer: one look per system theme.",
  noMood: true,
  header: "Sage header in both modes: forest's light tint carries the brand without implying a time of day.",
  refs: [{ app: "No moods: system light and dark", url: null, note: "spirit of the revised H" }],
  theme: H2.theme,
  mood: { "light-siang": I_LIGHT, "light-malam": I_LIGHT, "dark-siang": I_DARK, "dark-malam": I_DARK },
  parts: (look, m) => {
    const dark = themeOf(look) === "dark";
    return {
      cta: dark ? { fill: "#9CCBAE", label: "#163D2E", edge: null } : { fill: "#163D2E", label: "#FFF7E9", edge: null },
      field: dark ? { fill: "#292927", edge: m.markerIdle, text: "#B5B2AA" } : { fill: "#FFFEFA", edge: m.markerIdle, text: "#60675F" },
      demo: dark ? { fill: "#9CCBAE", text: "#163D2E", edge: null } : { fill: "#163D2E", text: "#FFF7E9", edge: null },
      cardEdge: null, tabEdge: null, heroEdge: dark ? "#7A5A3E" : "#D49A5E",
      heroWarn: dark ? "#FF8F80" : "#A33024", trackEdge: m.markerIdle,
      activeStop: dark ? "#F47B2A" : "#9B4309",
      accent: dark ? "#F5C9A6" : "#9B4309",
      photo: { fallback: "#163D2E", overlayInk: TODAY_OVERLAY, scrimTopAlpha: 0, scrimStartsAt: 0, scrimAlpha: 0.30, overlayAlpha: 0.72, ramp: true },
    };
  },
};
I.derived = [
  { name: "From the revised H, unchanged", hex: "#ECE6DA, #C5D6BE, #33493B, #4F6B58, #8FAE96, #D49A5E; dark #22402F, #2E2A25, #7A5A3E, #7FA08E, #4F7360, #292927, #9CCBAE", of: "today's hues", why: "I reuses the revised H's light page, its Malam header family (sage) and its Siang meal card family (cream with an apricot edge); no new step was needed" },
];
const I_REMOVAL = [
  "**Tokens** (`packages/design-tokens/src/index.ts`): `nativeMood`, the `Mood` and `MoodKey` types and `MoodPalette` go or collapse to one palette per theme (header, hero, markers, track) folded into `nativeThemes`. `nativeArt.successDisc` reads `nativeMood.light.siang.header` and needs its own fixed value.",
  "**Mood plumbing** (`packages/mobile-ui/src`): `mood.tsx` (`MoodProvider`, `useMood`, `useMoodColors`, `defaultMood`, `MoodLabels`), `MoodHeader`, `MoodFill`, `brand/MoodArc`, `brand/useMoodProgress`, `brand/MalamPattern`, plus mood reads in `components.tsx`, `RantangTrack`, `StatusBand`, `DemoStrip`, `Skeleton`, `CalendarPhotoCell`, `TopInset`, `screenInsets` and `toastAnchor`.",
  "**Customer app** (13 files read mood, for example `today/Beranda.tsx`, `today/Plate.tsx`, `discover/Jelajah.tsx`, `schedule/Jadwal.tsx`, `plan/PlanDetail.tsx`): the sun/moon `MoodArc` switch on Beranda goes. Lunch and dinner still exist as meals, so Beranda shows them as one card per meal or a plain Makan siang / Makan malam segmented control. Jelajah's Siang/Malam track becomes a meal-time filter with no colour change.",
  "**Dapur** (7 files, for example `today/TodayScreen.tsx`, `RoleGate.tsx`): the Siang/Malam toggle on Hari ini also picks the meal session (one session per meal), so it stays as a plain Makan siang / Makan malam segmented control with no colour change.",
  "**Artwork**: the mascot and food art are the same files in every mood, so nothing is recoloured. Only the Malam pattern and the success disc's header-derived colour are affected.",
  "**Persisted preference**: there is none to migrate. The mood lives in memory, one provider per app, and each launch defaults from the Jakarta clock (Siang before 15:00, `defaultMood` in `mood.tsx`). The theme preference (\"Ikuti sistem\") is separate and stays.",
  "**Tests**: `tests/native-contrast.test.ts` (mood rows) and `tests/native-theme-guard.test.ts` read mood, as do any app tests of the arc or toggle; the four-look checks become two-look checks. DESIGN.md's mood table is superseded."
];
I.removal = I_REMOVAL;

H2.derived = [
  { name: "Page neutral", hex: "#ECE6DA", of: "today's canvas #FDFAF3 / cream", why: "the light page one step down, so white cards and the tab bar clear 1.2:1 without a border and the tinted headers stand off it" },
  { name: "Apricot header", hex: "#F2C998", of: "today's Siang header #FFEFD9 (sunrise tint)", why: "a real Siang tint: today's #FFEFD9 would be 1.10:1 on this page; this tone is 1.24:1" },
  { name: "Sage header", hex: "#C5D6BE", of: "today's sage #F0F3E9 (forest tint)", why: "the Malam twin of the apricot header at the same weight, clearing 1.2:1 on the page" },
  { name: "Apricot and sage deep", hex: "#D49A5E / #8FAE96, #7E5933 / #4F6B58", of: "the two header tints", why: "the meal card's edge (1.5:1 or more on the page) and the idle marker, track and search edge (3:1 or more on the header)" },
  { name: "Pale sage card", hex: "#F3F6EF", of: "today's sage", why: "the Malam meal card tint, the twin of cream (#FFF7E9, today's token) by day" },
  { name: "Header meta inks", hex: "#5E3F22 / #33493B", of: "today's #6B4A2B / forest", why: "secondary header text at 4.5:1 or more on the deeper header tints" },
  { name: "Dark mood headers", hex: "#4A3423 / #22402F", of: "apricot and forest, at dark depth", why: "dark headers that read warm and green rather than near-black, 1.5:1 or more off the dark page" },
  { name: "Dark meal cards", hex: "#2E2A25 / #232B26", of: "the dark headers' hues", why: "tinted dark cards at least 1.2:1 off both the header and the page" },
  { name: "Dark edges and markers", hex: "#7A5A3E / #4F7360, #B08A66", of: "the dark header hues", why: "the dark meal card edge and the Siang idle marker at 3:1 or more" },
  { name: "Dark card, forest light", hex: "#292927, #9CCBAE", of: "today's dark surface / forest", why: "kept from H (v1): dark cards clear 1.2:1, and forest keeps its roles in dark mode" },
];

// Derived tonal steps in G and the pair that needed each one (base hexes alone fail these).
const DERIVED_G = [
  { name: "Taupe deep", hex: "#5A4F42", of: "Mushroom Taupe #9B8D7A", why: "muted text, header meta, today ring and the light Gagal diantar stop: taupe as muted text is 2.59:1 on linen and 1.98:1 on beige; this step gives 6.38:1 on linen and 4.88:1 on beige" },
  { name: "Olive deep", hex: "#5E6B52", of: "Olive Sage #6E7C61", why: "idle marker, track and search edge on the beige Siang header (olive is 2.72:1 there, this step 3.47:1), and the light demo strip fill (linen text on olive is 3.56:1, on this step 4.54:1; white on olive is 4.45:1)" },
  { name: "Taupe light", hex: "#B0A390", of: "Mushroom Taupe #9B8D7A", why: "idle marker and track edge on the forest Malam header: taupe is 3.00:1 there, at the 3:1 floor with no margin; this step gives 3.93:1" },
  { name: "Forest night", hex: "#16231C", of: "Forest Green #2F4A3A", why: "dark canvas, Malam track, dark search field and the photo ground: forest cards on a forest page would be 1.0:1; this step puts forest cards 1.67:1 off the page" },
  { name: "Taupe night", hex: "#3E362D", of: "Mushroom Taupe #9B8D7A", why: "dark Siang header and dark Malam meal card: needs a dark ground that is not forest, so the header and the forest meal card (or the forest Malam header and the meal card) part at 1.2:1 or more" },
];
DIRS.g.derived = DERIVED_G;
// The owner liked G but asked for linen, olive and forest as the main colours, much less beige and taupe, and Pale
// Copper as a reddish accent in a few places (2026-10-13). G above is kept for the record as "G (v1)" (md and json only,
// not on the canvas); G2 below is the live G.
const G1 = DIRS.g;
G1.label = "G (v1)";
G1.name = "G (v1) · Linen, olive and forest";

// G, revised: linen, olive and forest carry the page, cards, headers, buttons, tab bar and markers in every look; beige
// and taupe survive only as hairlines (row lines, card and tab bar edges). Siang is the olive end of the green scale,
// Malam the forest end, in light and dark alike. Copper is spent in three places: the active tracker stop
// (`activeStop`), prices (`accent`) and the Gagal diantar stop (`heroWarn`), a deeper step wherever it carries text.
const G2 = {
  label: "G",
  name: "G · Linen, olive and forest",
  line: "Your reference palette, revised: linen, olive and forest do the work. A linen page with lighter linen cards, tab bar and meal card (the meal card edged in olive); an olive Siang header and a forest Malam header, the same two greens at night depth in dark mode; a forest button and forest markers. Beige and taupe are only hairlines. Pale copper is the reddish accent in three places: the active tracker stop, prices and the Gagal diantar stop.",
  idea: "The owner's palette led by linen, olive and forest, with a copper accent.",
  refs: [
    { app: "Owner's reference palette", url: null, note: "five colours supplied on 2026-10-13, plus Pale Copper" },
    { app: "Revised per owner 2026-10-13", url: null, note: "main colours linen, olive and forest; much less beige and taupe; Pale Copper as a reddish accent in a few places" },
  ],
  palette: [["Linen Cream", "#EDE5D8"], ["Olive Sage", "#6E7C61"], ["Forest Green", "#2F4A3A"], ["Pale Copper", "#DA8A67"], ["Warm Beige", "#D8C8B4"], ["Mushroom Taupe", "#9B8D7A"]],
  theme: {
    light: { canvas: "#EDE5D8", surface: "#F8F4ED", sage: "#C3CBB3", line: "#D8C8B4", tabBar: "#F8F4ED", charcoal: "#2F4A3A", muted: "#4F5B45", forest: "#2F4A3A" },
    dark: { canvas: "#16231C", surface: "#2F4A3A", sage: "#3B4535", line: "#3E362D", tabBar: "#2F4A3A", charcoal: "#EDE5D8", muted: "#C3CBB3", forest: "#A9C4B1" },
  },
  mood: {
    "light-siang": { header: "#C3CBB3", headerText: "#2F4A3A", headerMeta: "#3F4A35", toggleTrack: "#F8F4ED", toggleActive: "#2F4A3A", onToggleActive: "#EDE5D8", arcTrack: "#6E7C61", markerActive: "#2F4A3A", markerIdle: "#4F5B45", todayRing: "#2F4A3A", hero: "#F8F4ED", heroText: "#2F4A3A", heroMeta: "#4F5B45", heroShadow: "0 8px 22px rgba(47,74,58,0.14)", pattern: null },
    "light-malam": { header: "#2F4A3A", headerText: "#EDE5D8", headerMeta: "#C3CBB3", toggleTrack: "#16231C", toggleActive: "#EDE5D8", onToggleActive: "#2F4A3A", arcTrack: "#6E7C61", markerActive: "#A9C4B1", markerIdle: "#A3AD93", todayRing: "#A9C4B1", hero: "#F8F4ED", heroText: "#2F4A3A", heroMeta: "#4F5B45", heroShadow: "0 8px 22px rgba(22,35,28,0.22)", pattern: null },
    "dark-siang": { header: "#3B4535", headerText: "#EDE5D8", headerMeta: "#C3CBB3", toggleTrack: "#16231C", toggleActive: "#A9C4B1", onToggleActive: "#2F4A3A", arcTrack: "#6E7C61", markerActive: "#A9C4B1", markerIdle: "#A3AD93", todayRing: "#A9C4B1", hero: "#243A2E", heroText: "#EDE5D8", heroMeta: "#C3CBB3", heroShadow: "0 8px 22px rgba(0,0,0,0.40)", pattern: null },
    "dark-malam": { header: "#2F4A3A", headerText: "#EDE5D8", headerMeta: "#C3CBB3", toggleTrack: "#16231C", toggleActive: "#A9C4B1", onToggleActive: "#2F4A3A", arcTrack: "#6E7C61", markerActive: "#A9C4B1", markerIdle: "#A3AD93", todayRing: "#A9C4B1", hero: "#243A2E", heroText: "#EDE5D8", heroMeta: "#C3CBB3", heroShadow: "0 8px 22px rgba(0,0,0,0.40)", pattern: null },
  },
  parts: (look, m) => {
    const dark = themeOf(look) === "dark";
    return {
      cta: dark ? { fill: "#A9C4B1", label: "#2F4A3A", edge: null } : { fill: "#2F4A3A", label: "#EDE5D8", edge: null },
      field: look === "light-siang" ? { fill: "#F8F4ED", edge: m.markerIdle, text: "#4F5B45" } : { fill: "#16231C", edge: m.markerIdle, text: "#C3CBB3" },
      demo: dark ? { fill: "#C3CBB3", text: "#2F4A3A", edge: null } : { fill: "#4F5B45", text: "#EDE5D8", edge: null },
      cardEdge: dark ? null : "#9B8D7A", tabEdge: dark ? null : "#9B8D7A", heroEdge: "#6E7C61",
      heroWarn: dark ? "#EBA88A" : "#A4532F", trackEdge: m.markerIdle,
      activeStop: dark ? "#DA8A67" : "#C26F4C",
      accent: dark ? "#EBA88A" : "#A4532F",
      photo: { fallback: "#16231C", overlayInk: "#16231C", scrimTopAlpha: 0, scrimStartsAt: 0, scrimAlpha: 0.30, overlayAlpha: 0.72, ramp: true },
    };
  },
};
G2.derived = [
  { name: "Linen light", hex: "#F8F4ED", of: "Linen Cream #EDE5D8", why: "cards, tab bar, meal card and the Siang search field in light: a linen step above the linen page (1.14:1), so cards and the tab bar take a taupe hairline (#9B8D7A, 2.59:1 on the page) and the meal card an olive edge (3.56:1 on the page)" },
  { name: "Olive tint", hex: "#C3CBB3", of: "Olive Sage #6E7C61", why: "the light Siang header (1.34:1 off the linen page, forest text 5.79:1), header meta on forest (5.79:1), dark muted text and the dark demo strip: olive itself carries forest text at only 2.07:1" },
  { name: "Olive deep / olive ink", hex: "#4F5B45 / #3F4A35", of: "Olive Sage #6E7C61", why: "muted text (5.76:1 on linen, olive is 3.56:1), the light demo strip (linen text 5.76:1), the idle marker, track and search edge on the olive tint header (4.29:1); the ink step is the Siang header meta (5.58:1, olive deep is 4.29:1)" },
  { name: "Olive light", hex: "#A3AD93", of: "Olive Sage #6E7C61", why: "idle marker, track and search edge on the forest and olive-night headers (4.14:1 and 4.29:1; olive is 2.2:1 there)" },
  { name: "Olive night", hex: "#3B4535", of: "Olive Sage #6E7C61", why: "the dark Siang header, the olive twin of the forest Malam header at night depth (1.62:1 off the dark page)" },
  { name: "Forest night / forest deep", hex: "#16231C / #243A2E", of: "Forest Green #2F4A3A", why: "the dark page, Malam track, dark search field and photo ground; the deep step is the dark meal card (1.26:1 on the forest header, 1.21:1 on the olive-night one, 1.33:1 on the page, plus the olive edge)" },
  { name: "Forest light", hex: "#A9C4B1", of: "Forest Green #2F4A3A", why: "the dark button, selected tab label, Siang/Malam pill, today ring and active markers: forest is 1.0:1 on the forest card; this step is 5.19:1 there" },
  { name: "Copper mid / copper deep", hex: "#C26F4C / #A4532F", of: "Pale Copper #DA8A67", why: "light only: the active tracker stop (3.38:1 on the linen meal card; Pale Copper is 2.45:1), and prices and the Gagal diantar stop (4.97:1, text-safe)" },
  { name: "Copper light", hex: "#EBA88A", of: "Pale Copper #DA8A67", why: "dark prices and the dark Gagal diantar stop: Pale Copper is 3.61:1 on the forest card, under 4.5:1 for text; this step is 4.86:1. Pale Copper itself is the dark active tracker stop (4.54:1 on the meal card)" },
];

// A, B and C are back as full options (owner, 2026-10-13). Their values come from round 1's directions.json, unchanged,
// and run through the same 156-pair list here. Order on the canvas: Today, A to C, D to G.
{
  const v1 = JSON.parse(fs.readFileSync(path.join(OUT, "directions.json"), "utf8"));
  const round1 = {};
  for (const k of ["a", "b", "c"]) {
    const v = v1.values[k];
    round1[k] = {
      label: v.label, name: v.name, line: v.line, idea: "Round 1, re-tuned from today's palette.",
      refs: [{ app: "Round 1, re-tuned from today's palette", url: null, note: "forest, sunrise, cream and charcoal" }],
      theme: { light: v.looks["light-siang"].theme, dark: v.looks["dark-siang"].theme },
      mood: Object.fromEntries(LOOKS.map((l) => [l, v.looks[l].mood])),
      parts: (look) => { const p = JSON.parse(JSON.stringify(v.looks[look].parts)); p.photo.overlayInk = TODAY_OVERLAY; return p; },
    };
  }
  // J: C with a green-ground dark mode and brown highlights (owner, 2026-10-13). Terang Siang and Terang Malam are
  // C's values unchanged (read from round 1 above). Gelap: page, cards, tab bar and meal card are tonal steps of C's
  // Terang Malam forest #163D2E; whatever is green in C's dark looks turns brown, light brown in Gelap Siang and dark
  // brown in Gelap Malam. Derived steps: J.derived.
  const C = round1.c;
  const J_DARK_THEME = { canvas: "#0F2C21", surface: "#163D2E", sage: "#1F4A38", line: "#24533F", tabBar: "#163D2E", charcoal: "#F5F1E8", muted: "#D3CEC4", forest: "#E6C3A2" };
  const J_MOOD = {
    "dark-siang": { header: "#C9A57D", headerText: "#0F2C21", headerMeta: "#4A3423", toggleTrack: "#F1E1CC", toggleActive: "#4A3423", onToggleActive: "#FFF7E9", arcTrack: "#A9845C", markerActive: "#4A3423", markerIdle: "#6B4A2B", todayRing: "#4A3423", hero: "#24533F", heroText: "#F5F1E8", heroMeta: "#D3CEC4", heroShadow: "0 10px 28px rgba(0,0,0,0.40)", pattern: null },
    "dark-malam": { header: "#4A3423", headerText: "#F5F1E8", headerMeta: "#E6C3A2", toggleTrack: "#5C4129", toggleActive: "#FFF7E9", onToggleActive: "#4A3423", arcTrack: "#7A5A3E", markerActive: "#FFF7E9", markerIdle: "#B08A66", todayRing: "#F5C9A6", hero: "#24533F", heroText: "#F5F1E8", heroMeta: "#D3CEC4", heroShadow: "0 10px 28px rgba(0,0,0,0.40)", pattern: "#553C28" },
  };
  const J = {
    label: "J",
    name: "J · C, with a green ground and brown highlights",
    line: "Terang Siang and Terang Malam are C unchanged. In dark mode the page is not charcoal: it is C's Malam forest, one step deeper, with cards, tab bar and the meal card in lighter steps of the same green. What was green in C's dark looks is brown: light brown in Gelap Siang (a tan header, a caramel button) and dark brown in Gelap Malam (a kopi header, a dark brown button with a latte edge). Card edges, markers and the selected tab follow the mood's brown.",
    idea: "C by day; a forest room with brown highlights after dark.",
    refs: [
      { app: "C, with green-ground dark mode and brown highlights (owner, 2026-10-13)", url: null, note: "light looks are C; dark looks rebuilt on C's Terang Malam forest" },
    ],
    palette: [["Forest (C Terang Malam header)", "#163D2E"], ["Forest deep (dark page)", "#0F2C21"], ["Light brown (Gelap Siang)", "#C9A57D"], ["Caramel (Gelap Siang button)", "#DDB283"], ["Dark brown (Gelap Malam)", "#6B4A2B"]],
    theme: { light: C.theme.light, dark: J_DARK_THEME },
    mood: { "light-siang": C.mood["light-siang"], "light-malam": C.mood["light-malam"], ...J_MOOD },
    parts: (look, m) => {
      if (themeOf(look) === "light") return C.parts(look, m);
      const siang = look === "dark-siang";
      const photo = { fallback: "#163D2E", overlayInk: TODAY_OVERLAY, scrimTopAlpha: 0, scrimStartsAt: 0, scrimAlpha: 0.30, overlayAlpha: 0.72, ramp: true };
      return siang
        ? { cta: { fill: "#DDB283", label: "#0F2C21", edge: null }, field: { fill: "#F1E1CC", edge: "#6B4A2B", text: "#4A3423" }, demo: { fill: "#F5C9A6", text: "#3A1A04", edge: null }, cardEdge: "#A9845C", tabEdge: "#A9845C", heroEdge: "#C9A57D", heroWarn: "#F47B2A", trackEdge: m.markerIdle, photo }
        : { cta: { fill: "#6B4A2B", label: "#FFF7E9", edge: "#E6C3A2" }, field: { fill: "#FFF7E9", edge: null, text: "#6B4A2B" }, demo: { fill: "#F5C9A6", text: "#3A1A04", edge: null }, cardEdge: "#6B4A2B", tabEdge: "#6B4A2B", heroEdge: "#6B4A2B", heroWarn: "#F47B2A", trackEdge: m.markerIdle, photo };
    },
    derived: [
      { name: "Forest deep (dark page)", hex: "#0F2C21", of: "C's Terang Malam forest #163D2E", why: "the dark page: forest cards on a forest page would be 1.0:1; one step deeper puts #163D2E cards and the tab bar 1.24:1 off it and the kopi Malam header 1.29:1" },
      { name: "Forest lift (meal card)", hex: "#24533F", of: "Forest #163D2E", why: "the dark meal card: 1.70:1 off the page and 1.32:1 off the kopi Malam header, so the tan and kopi headers both part from it without an edge" },
      { name: "Muted on forest", hex: "#D3CEC4", of: "C's dark muted #B5B2AA", why: "muted text on green: #B5B2AA is under 4.5:1 on #163D2E; this step is 7.69:1 on cards and 5.62:1 on the meal card" },
      { name: "Latte (text-safe brown)", hex: "#E6C3A2", of: "the light brown #C9A57D", why: "the selected tab label and headings on green (7.29:1 on the tab bar), the Malam header meta, and the edge that carries the dark brown button (5.32:1 on the meal card; the dark brown fill alone is 1.11:1 there)" },
      { name: "Kopi header (Gelap Malam)", hex: "#4A3423", of: "dark brown #6B4A2B", why: "a dark brown header that parts from the page (1.29:1) and the meal card (1.32:1); #6B4A2B itself is only 1.11:1 on the meal card. Also the Gelap Siang header meta, selected chip, active marker and today ring on the tan header (5.07:1)" },
      { name: "Brown light (Malam idle marker)", hex: "#B08A66", of: "dark brown #6B4A2B", why: "idle marker and track edge on the kopi header at 3:1 or more; the dark brown itself would vanish there" },
      { name: "Oat (Gelap Siang track and search)", hex: "#F1E1CC", of: "light brown #C9A57D", why: "the meal-time track and search field on the tan header, so the deep green header text reads on them (idle tab label at 4.5:1 or more)" },
      { name: "Brown mid (Gelap Siang edges)", hex: "#A9845C", of: "light brown #C9A57D", why: "card and tab bar edges in Gelap Siang (4.38:1 on the page) and the decorative arc track" },
      { name: "Kopi track and pattern", hex: "#5C4129 / #553C28 / #7A5A3E", of: "dark brown #6B4A2B", why: "the Gelap Malam meal-time track, Malam pattern and arc track, replacing C's greens #2C5A45, #2A5743 and #3A6652" },
    ],
  };
  // K: today's palette used with restraint (Mobbin rules, owner 2026-10-13; palette/mobbin-colour-restraint.md).
  // Hues are today's tokens only (forest, sunrise, cream, charcoal, the neutrals) plus the tonal steps in K.derived.
  // Page, header and tab bar are cream/neutral in light and charcoal neutrals in dark; no forest or sunrise fill behind
  // content. The one filled brand control is the forest primary button (`cta`). Selection is a small forest mark: the
  // active tab label, the today ring, and the selected Siang/Malam segment drawn as a pill in the card colour with a
  // forest ring and forest label. For that segment `toggleActive` is the ring and label colour and `onToggleActive` the
  // pill fill, so "onToggleActive on toggleActive" checks the label against its fill (contrast is symmetric) and
  // "toggleActive pill vs toggleTrack" checks the ring. Tracker, markers and prices are ink; sunrise (sunrise ink in
  // light) marks the current stop only; Gagal diantar uses today's danger tone with its words. Siang and Malam differ
  // only by a faint header tint (cream vs pale sage; warm vs green-grey charcoal) and the ink sun/moon mark.
  const K_LIGHT = (header) => ({ header, headerText: "#2E2E2E", headerMeta: "#555B54", toggleTrack: "#FFFEFA", toggleActive: "#163D2E", onToggleActive: "#FFFEFA", arcTrack: "#C9C6BA", markerActive: "#2E2E2E", markerIdle: "#858D80", todayRing: "#163D2E", hero: "#FFFEFA", heroText: "#2E2E2E", heroMeta: "#555B54", heroShadow: "0 6px 18px rgba(46,46,46,0.10)", pattern: null });
  const K_DARK = (header) => ({ header, headerText: "#F5F1E8", headerMeta: "#B5B2AA", toggleTrack: "#292927", toggleActive: "#9CCBAE", onToggleActive: "#292927", arcTrack: "#4E4C47", markerActive: "#F5F1E8", markerIdle: "#8A8780", todayRing: "#9CCBAE", hero: "#292927", heroText: "#F5F1E8", heroMeta: "#B5B2AA", heroShadow: "0 6px 18px rgba(0,0,0,0.35)", pattern: null });
  const K = {
    label: "K",
    name: "K · Today's palette, used with restraint",
    line: "Today's forest, sunrise, cream and charcoal, spent the way top food apps spend a brand colour. Page, header and tab bar are cream and neutrals (charcoal in dark); the meal card is a plain card that stands off the header by a fine edge, so the food photo carries the warmth. Forest fills only the primary button and marks the active tab, the selected segment and today's date. The tracker is ink; sunrise marks only the current stop. Prices are bold ink, and Gagal diantar keeps its own red with its words. Siang and Malam are a faint header tint and the sun/moon mark, nothing more.",
    idea: "Today's hues on neutral ground: one forest button, small forest marks, one branded moment.",
    moment: "One branded moment per screen, and only where it means something: Paket selesai and payment success. The mascot sits on the success disc (nativeArt.successDisc, pinned to #FFEFD9, with its 3dp sunrise ink ring) above the one forest button. Drawn as the seventh phone in the grid below. Everywhere else the character comes from the food photos, the mascot art and the type.",
    refs: [{ app: "Today's palette, used with restraint (Mobbin rules, owner 2026-10-13)", url: null, note: "palette/mobbin-colour-restraint.md" }],
    palette: [["Forest", "#163D2E"], ["Sunrise", "#F47B2A"], ["Sunrise ink", "#9B4309"], ["Cream", "#FFF7E9"], ["Charcoal", "#2E2E2E"]],
    theme: {
      light: { canvas: "#E4DED1", surface: "#FFFEFA", sage: "#F0F3E9", line: "#D3CEC1", tabBar: "#FFF7E9", charcoal: "#2E2E2E", muted: "#555B54", forest: "#163D2E" },
      dark: { canvas: "#151514", surface: "#292927", sage: "#2A2D27", line: "#3A3A37", tabBar: "#292927", charcoal: "#F5F1E8", muted: "#B5B2AA", forest: "#9CCBAE" },
    },
    mood: { "light-siang": K_LIGHT("#FFF7E9"), "light-malam": K_LIGHT("#F3F6EF"), "dark-siang": K_DARK("#2E2B25"), "dark-malam": K_DARK("#2A2D27") },
    parts: (look, m) => {
      const dark = themeOf(look) === "dark";
      return {
        cta: dark ? { fill: "#9CCBAE", label: "#163D2E", edge: null } : { fill: "#163D2E", label: "#FFF7E9", edge: null },
        field: dark ? { fill: "#292927", edge: "#8A8780", text: "#B5B2AA" } : { fill: "#FFFEFA", edge: "#858D80", text: "#555B54" },
        demo: dark ? { fill: "#151514", text: "#B5B2AA", edge: null } : { fill: "#E4DED1", text: "#555B54", edge: null },
        cardEdge: null, tabEdge: null, heroEdge: dark ? "#4E4C47" : "#C9C6BA",
        heroWarn: dark ? "#FF8F80" : "#A33024", trackEdge: m.markerIdle,
        activeStop: dark ? "#F47B2A" : "#9B4309",
        accent: dark ? "#F5F1E8" : "#2E2E2E",
        photo: { fallback: "#2E2E2E", overlayInk: "#1B1B1A", scrimTopAlpha: 0, scrimStartsAt: 0, scrimAlpha: 0.30, overlayAlpha: 0.72, ramp: true },
      };
    },
    derived: [
      { name: "Page neutral", hex: "#E4DED1", of: "today's canvas #FDFAF3 / cream", why: "the light page one step down, so white cards (1.33:1), the cream tab bar and Siang header (1.26:1) and the pale sage Malam header (1.23:1) stand off it without a border; today's canvas is 1.03:1 under white cards" },
      { name: "Pale sage header", hex: "#F3F6EF", of: "today's sage #F0F3E9 (forest tint)", why: "the faint Malam tint: #F0F3E9 is 1.19:1 on the page; this step is 1.23:1 (also the revised H's Malam card)" },
      { name: "Muted deep", hex: "#555B54", of: "today's muted #60675F", why: "muted text, header meta, demo strip and placeholder: #60675F is 4.35:1 on the page; this step is 5.2:1 or more on every light ground" },
      { name: "Card edge", hex: "#C9C6BA", of: "today's line #E2E3D8", why: "the meal card's edge: the white card is 1.06:1 on the cream header and 1.08:1 on the pale sage one; the edge is 1.61:1 and 1.57:1" },
      { name: "Lines (decorative)", hex: "#D3CEC1 / #3A3A37", of: "today's line", why: "row separators re-stepped for the page tone; decorative, not in the pair list" },
      { name: "Dark card", hex: "#292927", of: "today's dark surface #232321", why: "dark cards, tab bar, meal card and the selected segment fill: #232321 is 1.16:1 on the dark page; this step is 1.25:1" },
      { name: "Dark warm header", hex: "#2E2B25", of: "today's dark sage #2A2D27, warmed toward cream", why: "the faint Gelap Siang tint, the dark twin of the cream header (Gelap Malam keeps today's dark sage #2A2D27)" },
      { name: "Dark card edge", hex: "#4E4C47", of: "today's dark line #34332F", why: "the dark meal card's edge: the card is 1.03:1 on either dark header; the edge is 1.65:1 and 1.63:1" },
      { name: "Forest light", hex: "#9CCBAE", of: "Forest #163D2E", why: "the dark primary button, today ring, active tab label and selected segment ring: forest itself is 1.21:1 on the dark card" },
      { name: "Overlay ink", hex: "#1B1B1A", of: "Charcoal #2E2E2E", why: "a neutral photo overlay and failed-photo ground, so the photo text block carries no brand hue" },
    ],
  };
  const order = ["today", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "g1", "h1"];
  const all7 = { ...DIRS, ...round1, g: G2, h: H2, i: I, j: J, k: K, g1: G1, h1: H };
  for (const k of Object.keys(DIRS)) delete DIRS[k];
  for (const k of order) DIRS[k] = all7[k];
}

/* ---------- rules (as palette-directions.cjs, plus four standalone pairs) ---------- */
const SURFACE = 1.2, EDGE_TOKEN = 1.5, NONTEXT = 3, TEXT = 4.5;
function surfacePair(rows, ctx, id, pair, a, b, edge, edgeName) {
  const r = ratio(a, b);
  let pass = r >= SURFACE, carriedBy = null, edgeRatio = null;
  if (!pass && edge) { edgeRatio = ratio(edge, b); if (edgeRatio >= EDGE_TOKEN) { pass = true; carriedBy = `${edgeName} ${edge} (${edgeRatio}:1 on ${b})`; } }
  rows.push({ ...ctx, id, pair, kind: "surface", a, b, ratio: r, min: SURFACE, edge: edge || null, edgeRatio, carriedBy, pass });
}
function minPair(rows, ctx, id, pair, a, b, min, kind) {
  const r = ratio(a, b);
  rows.push({ ...ctx, id, pair, kind, a, b, ratio: r, min, pass: r >= min });
}
function resolve(dirKey, look) {
  const d = DIRS[dirKey], th = themeOf(look);
  const theme = { ...TODAY_THEME[th], ...d.theme[th] };
  const m = d.mood[look];
  const p = d.parts(look, m);
  return { theme, m, p };
}
function check(dirKey, look) {
  const { theme: t, m, p } = resolve(dirKey, look);
  const rows = [];
  const ctx = { dir: dirKey, look };
  surfacePair(rows, ctx, "9-06/9-17/9-18a", "mood header vs canvas", m.header, t.canvas, null);
  surfacePair(rows, ctx, "9-01/9-02/9-08/9-09/9-16", "hero (and Dapur count card) vs mood header", m.hero, m.header, p.heroEdge, "heroEdge");
  surfacePair(rows, ctx, "9-03/9-04/9-18b", "hero vs canvas", m.hero, t.canvas, p.heroEdge, "heroEdge");
  surfacePair(rows, ctx, "9-05/9-11", "card vs canvas", t.surface, t.canvas, p.cardEdge, "cardEdge");
  surfacePair(rows, ctx, "9-10", "tab bar vs canvas", t.tabBar, t.canvas, p.tabEdge, "tabEdge");
  surfacePair(rows, ctx, "9-07", "demo strip vs mood header", p.demo.fill, m.header, p.demo.edge, "demoEdge");
  const fieldBoundary = p.field.edge || p.field.fill;
  minPair(rows, ctx, "9-12/9-13/9-14/9-15", "search field boundary vs mood header", fieldBoundary, m.header, NONTEXT, "non-text");
  minPair(rows, ctx, "9-12/9-13/9-14/9-15", "Siang/Malam track boundary vs mood header", p.trackEdge || m.toggleTrack, m.header, NONTEXT, "non-text");
  minPair(rows, ctx, "rule", "markerIdle vs header", m.markerIdle, m.header, NONTEXT, "non-text");
  minPair(rows, ctx, "rule", "todayRing vs header", m.todayRing, m.header, NONTEXT, "non-text");
  minPair(rows, ctx, "rule", "headerText (selected outline) vs header", m.headerText, m.header, NONTEXT, "non-text");
  minPair(rows, ctx, "rule", "markerActive disc vs header", m.markerActive, m.header, NONTEXT, "non-text");
  minPair(rows, ctx, "rule", "toggleActive pill vs toggleTrack", m.toggleActive, m.toggleTrack, NONTEXT, "non-text");
  const ctaBoundary = p.cta.edge || p.cta.fill;
  minPair(rows, ctx, "9-19/9-20/9-21", "Sunrise CTA boundary vs hero", ctaBoundary, m.hero, NONTEXT, "non-text");
  minPair(rows, ctx, "9-19/9-20/9-21", "Sunrise CTA label on fill", p.cta.label, p.cta.fill, TEXT, "text");
  minPair(rows, ctx, "rule", "Belum outline (heroText) vs hero", m.heroText, m.hero, NONTEXT, "non-text");
  if (p.heroWarn) minPair(rows, ctx, "FB10", "Gagal diantar stop (heroWarn) vs hero", p.heroWarn, m.hero, NONTEXT, "non-text");
  minPair(rows, ctx, "rule", "headerText on header", m.headerText, m.header, TEXT, "text");
  minPair(rows, ctx, "rule", "headerMeta on header", m.headerMeta, m.header, TEXT, "text");
  minPair(rows, ctx, "rule", "heroText on hero", m.heroText, m.hero, TEXT, "text");
  minPair(rows, ctx, "rule", "heroMeta on hero", m.heroMeta, m.hero, TEXT, "text");
  minPair(rows, ctx, "rule", "onToggleActive on toggleActive", m.onToggleActive, m.toggleActive, TEXT, "text");
  minPair(rows, ctx, "rule", "headerText on toggleTrack (idle tab label)", m.headerText, m.toggleTrack, TEXT, "text");
  minPair(rows, ctx, "rule", "search placeholder on field fill", p.field.text, p.field.fill, TEXT, "text");
  minPair(rows, ctx, "rule", "demo strip text on strip", p.demo.text, p.demo.fill, TEXT, "text");
  minPair(rows, ctx, "rule", "charcoal on card surface", t.charcoal, t.surface, TEXT, "text");
  minPair(rows, ctx, "rule", "muted on card surface", t.muted, t.surface, TEXT, "text");
  minPair(rows, ctx, "rule", "muted on canvas", t.muted, t.canvas, TEXT, "text");
  minPair(rows, ctx, "rule", "muted on tab bar", t.muted, t.tabBar, TEXT, "text");
  minPair(rows, ctx, "rule", "forest label on tab bar", t.forest, t.tabBar, TEXT, "text");
  // v2 additions: the same colours away from the hero (StickyAction and lists on the page).
  minPair(rows, ctx, "v2", "charcoal on canvas", t.charcoal, t.canvas, TEXT, "text");
  minPair(rows, ctx, "v2", "forest (selected and headings) on canvas", t.forest, t.canvas, TEXT, "text");
  if (dirKey !== "today") {
    // J's light looks are C's, so its page button is C's forest one there; in dark it is J's brown button.
    const cRule = ["a", "b", "c"].includes(dirKey) || (dirKey === "j" && themeOf(look) === "light");
    const pageCta = cRule ? { fill: t.forest, label: themeOf(look) === "dark" ? "#163D2E" : "#FFF7E9" } : dirKey === "f" ? { fill: t.forest, label: themeOf(look) === "dark" ? "#0B2B28" : "#FFFFFF" } : p.cta;
    // The boundary is the edge where a button has one (J's dark brown Malam button); no other page button sets an edge.
    minPair(rows, ctx, "v2", "page CTA fill vs canvas (StickyAction)", pageCta.edge || pageCta.fill, t.canvas, NONTEXT, "non-text");
    minPair(rows, ctx, "v2", "page CTA label on fill (StickyAction)", pageCta.label, pageCta.fill, TEXT, "text");
  }
  const ph = p.photo;
  const ink = ph.overlayInk;
  const ground = over(ink, ph.overlayAlpha, over(ink, ph.scrimAlpha, WHITE_PHOTO));
  minPair(rows, ctx, "9-22", "cream text on the overlay, white photo", OVERLAY_TEXT, ground, TEXT, "text");
  minPair(rows, ctx, "9-23", "cream ⋮ on its 0.66 disc, white photo", OVERLAY_TEXT, over(ink, 0.66, WHITE_PHOTO), NONTEXT, "non-text");
  const overFallback = over(ink, ph.overlayAlpha, over(ink, ph.scrimAlpha, ph.fallback));
  minPair(rows, ctx, "9-24/9-25", "cream text on the overlay, failed photo", OVERLAY_TEXT, overFallback, TEXT, "text");
  const band = ph.ramp ? over(ink, ph.scrimTopAlpha, ph.fallback) : ph.fallback;
  rows.push({ ...ctx, id: "9-24/9-25", pair: "failed-photo top band vs the overlay below it (lower is calmer)", kind: "edge", a: band, b: overFallback, ratio: ratio(band, overFallback), min: null, max: 2.0, pass: !!ph.ramp && ratio(band, overFallback) <= 2.0, note: ph.ramp ? "Fallback is the dark photo ground under a ramp: no pale band." : "Unscrimmed fallback above a flat overlay: a band with a hard edge." });
  rows.push({ ...ctx, id: "9-26", pair: "scrim edge across a loaded photo", kind: "edge", a: ph.ramp ? "ramp from 0" : `step at ${Math.round(ph.scrimStartsAt * 100)}%`, b: null, ratio: null, min: null, pass: !!ph.ramp, note: ph.ramp ? "Scrim ramps from transparent at the photo's top to its full alpha above the text; no straight edge." : "Flat scrim starts 25% down: a straight edge crosses the dish." });
  return rows;
}

/* ---------- run ---------- */
const all = [];
for (const k of Object.keys(DIRS)) for (const look of LOOKS) all.push(...check(k, look));

const summary = {};
for (const k of Object.keys(DIRS)) {
  const rows = all.filter((r) => r.dir === k);
  const fails = rows.filter((r) => !r.pass);
  const ratioed = rows.filter((r) => r.ratio !== null && r.min !== null);
  const worst = ratioed.reduce((w, r) => { const s = r.carriedBy ? r.edgeRatio / EDGE_TOKEN : r.ratio / r.min; return !w || s < w.s ? { s, r } : w; }, null);
  summary[k] = { name: DIRS[k].name, fails: fails.length, total: rows.length, worst: worst && { pair: worst.r.pair, look: worst.r.look, ratio: worst.r.carriedBy ? worst.r.edgeRatio : worst.r.ratio, min: worst.r.carriedBy ? EDGE_TOKEN : worst.r.min, via: worst.r.carriedBy ? "edge token" : null } };
}

const values = {};
for (const k of Object.keys(DIRS)) {
  values[k] = { label: DIRS[k].label, name: DIRS[k].name, line: DIRS[k].line || "", idea: DIRS[k].idea || "", refs: DIRS[k].refs || [], palette: DIRS[k].palette || null, derived: DIRS[k].derived || null, noMood: !!DIRS[k].noMood, header: DIRS[k].header || null, moment: DIRS[k].moment || null, themeChanges: DIRS[k].theme, looks: {} };
  for (const look of LOOKS) { const { theme, m, p } = resolve(k, look); values[k].looks[look] = { theme, mood: m, parts: p }; }
}

fs.mkdirSync(OUT, { recursive: true });
const json = { generated: new Date().toISOString().slice(0, 10), round: 2, method: "WCAG 2.x relative luminance, computed from the hex values below", rules: { surface: SURFACE, edgeToken: EDGE_TOKEN, nonText: NONTEXT, text: TEXT, fallbackBandMax: 2.0 }, summary, values, rows: all };
fs.writeFileSync(path.join(OUT, "directions-v2.json"), JSON.stringify(json, null, 1));

/* ---------- markdown ---------- */
const auditRows = [
  ["9-01", "dark-malam", "hero (and Dapur count card) vs mood header"], ["9-02", "dark-malam", "hero (and Dapur count card) vs mood header"],
  ["9-03", "light-siang", "hero vs canvas"], ["9-04", "light-siang", "hero vs canvas"], ["9-05", "light-siang", "card vs canvas"],
  ["9-06", "light-siang", "mood header vs canvas"], ["9-07", "light-siang", "demo strip vs mood header"], ["9-08", "dark-siang", "hero (and Dapur count card) vs mood header"],
  ["9-09", "light-siang", "hero (and Dapur count card) vs mood header"], ["9-10", "light-siang", "tab bar vs canvas"], ["9-11", "dark-siang", "card vs canvas"],
  ["9-12", "dark-siang", "search field boundary"], ["9-13", "light-malam", "search field boundary"], ["9-14", "dark-malam", "search field boundary"], ["9-15", "light-siang", "search field boundary"],
  ["9-16", "light-malam", "hero (and Dapur count card) vs mood header"], ["9-17", "dark-siang", "mood header vs canvas"], ["9-18", "dark-malam", "mood header vs canvas"],
  ["9-19", "light-siang", "Sunrise CTA"], ["9-20", "light-malam", "Sunrise CTA"], ["9-21", "dark-siang", "Sunrise CTA"],
  ["9-24", "light-siang", "failed-photo top band"], ["9-25", "dark-siang", "failed-photo top band"], ["9-26", "light-malam", "scrim edge"],
];
const KS = Object.keys(DIRS);
const cell = (r) => !r ? "n/a" : r.ratio === null ? (r.pass ? "pass" : "FAIL") : `${r.ratio}${r.carriedBy ? " + edge" : ""} ${r.pass ? "pass" : "FAIL"}`;
const find = (k, look, startsWith) => all.find((r) => r.dir === k && r.look === look && r.pair.startsWith(startsWith));
let md = `# FB2 palette directions, round 2: computed checks\n\nGenerated by \`output/native-review/phase-g/scripts/palette-directions-v2.cjs\` on ${json.generated}. On October 13, 2026 the owner turned down A, B and C and reopened the hues, then brought A to C back as options next to D to G. A to C are read unchanged from \`directions.json\` (round 1, checked there against 140 pairs) and checked here against the full 156-pair list. Research behind D to F: \`mobbin-brand-research.md\`. G is built from the owner's reference palette (Linen Cream, Warm Beige, Mushroom Taupe, Olive Sage, Forest Green) plus Pale Copper and the derived steps listed under it; it was revised per the owner on October 13 (linen, olive and forest lead, a copper accent), and the first version is kept below as G (v1). K keeps today's hues and spends them by the seven rules in \`mobbin-colour-restraint.md\` (owner, October 13). WCAG 2.x ratios from the hex values in \`directions-v2.json\`; the canvas reads the same numbers.\n\n`;
md += `Rules (unchanged from round 1): text at least ${TEXT}:1 (no large-text exception: DESIGN.md asks 4.5:1 for all native text); a control boundary that is the only cue, the hero button's edge and the Gagal diantar stop at least ${NONTEXT}:1; adjacent surfaces at least ${SURFACE}:1, or a named edge token at least ${EDGE_TOKEN}:1 against the outer ground; a failed photo shows no band and the scrim has no straight edge. Round 2 adds four pairs per look: charcoal on canvas, the selected/heading colour on canvas, and the page button (StickyAction) fill against the canvas and its label on the fill. The pair called "Sunrise CTA" is the hero's primary button, whatever its colour in a direction.\n\n`;
md += `## Summary\n\n| Direction | Idea | Failing pairs | Pairs checked | Tightest pair (ratio against its minimum) |\n| --- | --- | --- | --- | --- |\n`;
for (const k of KS) { const s = summary[k]; md += `| ${s.name} | ${DIRS[k].idea || "shipped"} | ${s.fails} | ${s.total} | ${s.worst ? `${s.worst.pair}, ${s.worst.look}: ${s.worst.ratio}:1 (min ${s.worst.min}${s.worst.via ? ", edge token" : ""})` : "n/a"} |\n`; }
md += `\n## Audit-009 rows, today and per direction\n\n"+ edge" means the ratio itself is under 1.2 and a named edge token carries the boundary.\n\n| Row | Look | Pair | ${KS.map((k) => DIRS[k].label).join(" | ")} |\n| --- | --- | --- | ${KS.map(() => "---").join(" | ")} |\n`;
for (const [id, look, starts] of auditRows) {
  const pick = (k) => {
    if (starts === "Sunrise CTA") { const e = all.find((r) => r.dir === k && r.look === look && r.pair.startsWith("Sunrise CTA") && r.kind === "non-text"); const l = find(k, look, "Sunrise CTA label"); return `edge ${cell(e)}; label ${l.ratio}`; }
    return cell(find(k, look, starts));
  };
  md += `| ${id} | ${look} | ${starts} | ${KS.map(pick).join(" | ")} |\n`;
}
md += `\n## Values per direction\n\nFull theme set per theme, every nativeMood key per look, and the parts. New keys against today: \`heroWarn\` (the Gagal diantar stop), the hero button's fill and label, the search field and track edges, \`cardEdge\`, \`tabEdge\`, \`heroEdge\`, the demo strip, the failed-photo ground and the overlay ink.\n`;
for (const k of KS.filter((x) => x !== "today")) {
  const d = DIRS[k];
  const from = d.refs.map((r) => (r.url ? `[${r.app}](${r.url}) (${r.note})` : `${r.app} (${r.note})`)).join("; ");
  const base = d.palette ? `\n\nBase colours: ${d.palette.map(([n, h]) => `${n} ${h}`).join(", ")}.` : "";
  const derived = d.derived ? `\n\nDerived tonal steps, each added only because a pair failed with the base hexes:\n\n${d.derived.map((x) => `- **${x.name} ${x.hex}** (from ${x.of}): ${x.why}.`).join("\n")}` : "";
  const P0 = LOOKS.map((l) => [l, resolve(k, l)]);
  const stop = P0[0][1].p.activeStop ? `\n\nActive tracker stop (a colour only this direction sets; checked here, outside the 156-pair count, at 3:1 against the meal card): ${P0.map(([l, r]) => `${l} ${r.p.activeStop} on ${r.m.hero} ${ratio(r.p.activeStop, r.m.hero)}:1`).join(", ")}.` : "";
  const acc = P0[0][1].p.accent ? `

Accent on prices (sunrise ink in H and I, copper in G, bold ink in K; text on the plain card; outside the count, at 4.5:1): ${P0.map(([l, r]) => `${l} ${r.p.accent} on ${r.theme.surface} ${ratio(r.p.accent, r.theme.surface)}:1`).join(", ")}.` : "";
  md += `\n### ${d.name}\n\n${d.line}\n\nWhere it comes from: ${from}.${base}${derived}${stop}${acc}${d.header ? `\n\nHeader: ${d.header}` : ""}${d.moment ? `\n\nBranded moment: ${d.moment}` : ""}${d.noMood ? "\n\nNo moods: the script is keyed on four looks, so the Siang and Malam columns below carry the same values. Light and dark are the only real looks; the 156-pair count therefore checks each pair twice per theme. The toggle keys (toggleTrack, toggleActive) stay for the meal-time segmented control, not a mood." : ""}${d.removal ? `\n\n#### What removing the moods touches (G-b scope note; no code changed)\n\n${d.removal.map((x) => `- ${x}`).join("\n")}` : ""}\n\n| Theme key | light | dark |\n| --- | --- | --- |\n`;
  for (const key of Object.keys(d.theme.light)) md += `| ${key} | ${d.theme.light[key]} | ${d.theme.dark[key]} |\n`;
  md += `\n| Mood key | ${LOOKS.join(" | ")} |\n| --- | --- | --- | --- | --- |\n`;
  for (const key of Object.keys(d.mood["light-siang"])) md += `| ${key} | ${LOOKS.map((l) => d.mood[l][key] ?? "none").join(" | ")} |\n`;
  const P = LOOKS.map((l) => resolve(k, l).p);
  const fmt = (x) => (x === null || x === undefined ? "none" : x);
  const prow = (name, f) => (md += `| ${name} | ${P.map((p) => fmt(f(p))).join(" | ")} |\n`);
  prow("heroWarn", (p) => p.heroWarn);
  prow("hero button fill / label / edge", (p) => `${p.cta.fill} / ${p.cta.label} / ${fmt(p.cta.edge)}`);
  prow("search field fill / edge / placeholder", (p) => `${p.field.fill} / ${fmt(p.field.edge)} / ${p.field.text}`);
  prow("track edge (idle meal tab)", (p) => p.trackEdge);
  prow("cardEdge / tabEdge / heroEdge", (p) => `${fmt(p.cardEdge)} / ${fmt(p.tabEdge)} / ${fmt(p.heroEdge)}`);
  prow("demo strip fill / text", (p) => `${p.demo.fill} / ${p.demo.text}`);
  prow("failed-photo ground / overlay ink", (p) => `${p.photo.fallback} / ${p.photo.overlayInk}`);
  prow("scrim", (p) => `ramp from 0 at the top to ${p.photo.scrimAlpha}; text block ramps 0 to ${p.photo.overlayAlpha} over 26dp`);
}
md += `\n## Every pair, per direction and look\n`;
for (const k of KS) {
  md += `\n### ${DIRS[k].name}\n\n| Look | Row | Pair | Colours | Ratio | Min | Result |\n| --- | --- | --- | --- | --- | --- | --- |\n`;
  for (const r of all.filter((x) => x.dir === k)) md += `| ${r.look} | ${r.id} | ${r.pair} | ${r.a}${r.b ? " / " + r.b : ""} | ${r.ratio ?? "-"} | ${r.min ?? (r.max ? "max " + r.max : "-")} | ${r.pass ? "pass" : "FAIL"}${r.carriedBy ? ", edge " + r.carriedBy : ""} |\n`;
}
fs.writeFileSync(path.join(OUT, "directions-v2.md"), md);

/* ---------- console ---------- */
for (const k of KS) {
  const s = summary[k];
  console.log(`${s.name}: ${s.fails}/${s.total} failing; tightest ${s.worst ? s.worst.pair + " " + s.worst.look + " " + s.worst.ratio + "/" + s.worst.min : "-"}`);
  if (k !== "today") for (const r of all.filter((x) => x.dir === k && !x.pass)) console.log(`   FAIL ${r.look} ${r.pair} ${r.a}/${r.b} ${r.ratio}`);
}

/* ---------- embed ---------- */
if (process.argv.includes("--embed")) {
  const html = fs.readFileSync(CANVAS, "utf8");
  const v1 = JSON.parse(fs.readFileSync(path.join(OUT, "directions.json"), "utf8"));
  const rejected = {}; // none since the owner brought A, B and C back
  for (const k of []) if (v1.values[k]) rejected[k] = { label: v1.values[k].label, name: v1.values[k].name, line: v1.values[k].line, summary: v1.summary[k], looks: Object.fromEntries(LOOKS.map((l) => [l, { mood: { header: v1.values[k].looks[l].mood.header, hero: v1.values[k].looks[l].mood.hero }, theme: { canvas: v1.values[k].looks[l].theme.canvas }, parts: { cta: { fill: v1.values[k].looks[l].parts.cta.fill } } }])) };
  // G (v1) and H (v1) stay in the json and md for the record; the canvas shows only the live directions.
  const RECORD = ["g1", "h1"];
  const live = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !RECORD.includes(k)));
  const slim = { generated: json.generated, round: 2, rules: json.rules, summary: live(summary), values: live(values), rejected, rows: all.filter((r) => !RECORD.includes(r.dir)).map(({ dir, look, id, pair, kind, a, b, ratio: r, min, max, pass, carriedBy }) => ({ dir, look, id, pair, kind, a, b, r, min: min ?? null, max: max ?? null, pass, by: carriedBy || null })) };
  const re = /(<script type="application\/json" id="fb2-data">)[\s\S]*?(<\/script>)/;
  if (!re.test(html)) { console.error("No fb2-data island in the canvas"); process.exit(1); }
  const payload = JSON.stringify(slim).replace(/</g, "\\u003c");
  fs.writeFileSync(CANVAS, html.replace(re, (_, a, b) => a + payload + b));
  console.log("Embedded the data island in canvas/index.html");
}
