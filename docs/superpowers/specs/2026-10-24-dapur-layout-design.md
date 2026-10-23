# Catera Dapur layout rethink: design spec, 2026-10-24

Scope: Catera Dapur (`apps/caterer`) only, layout only (sizing, spacing, density, hierarchy, placement, moving modules within and between screens). Palette K, the artwork, the names, the copy glossary, the motion dials, every server rule, the four tabs and their names, `tabsForRole`, and every Phase A-G behaviour rule stay. The customer app must render exactly as it does at `ac1cab5e`.

Inputs: [synthesis](../research/2026-10-24-dapur-layout-synthesis.md) (audit, 12 patterns, rulings R1-R8, directions 3.2, answers section 4), [code inventory](../research/2026-10-24-dapur-layout-inventory.md), the Mobbin studies ([merchant](../research/2026-10-24-dapur-mobbin-merchant.md), [work apps](../research/2026-10-24-dapur-mobbin-workapps.md)), and the canvas `https://claude.ai/artifact/UasscRdNooRxK3cPZtPDEo`, whose "Sesudah" boards are the visual contract where this text is silent. Before captures: `output/native-review/layout-2026-10-24/before/`.

## 1. Decisions

1. Owner, 2026-10-24: Dapur only, layout only; all screens equally important; skills `expo-native-ui` + `design-taste-frontend` app-screen rules (`expo-native-ui` wins on conflict), `humanizer` for copy, superpowers for process; density "let research decide".
2. Owner, 2026-10-24: speed mode until 04:00 WIB, then the default model rules; full autonomy, with the controller deciding on the owner's behalf. Pushing still needs the owner.
3. Controller rulings on the owner's behalf: R1-R8 and the screen directions in synthesis section 3, and Hari ini option A (sections) over B (segmented). Later rulings go in the ledger and the handoff.

## 2. The scale

### 2.1 Opt-in

`apps/caterer/app/_layout.tsx` wraps the app in `LayoutScaleProvider value="v2" target={48}`, at the same level the customer root uses. Dapur then gets every v2 primitive as DESIGN.md "Customer layout scale" describes it (Screen margin 16, Button 50 round, Chip and Segmented 34, Field 50, Card radius 16 / padding 16 / gap 8 / no border, MoodHeader 44 row with `band` and `plain`, ScreenFooter on the canvas with the bottom inset on root-stack screens, Stepper 56 with 44 circles, AuthScreen's v2 branch).

### 2.2 Touch target

`LayoutScaleProvider` gains an optional `target` prop (number, default 44), read through `useLayoutScale()` (or a new `useTouchTarget()`). Under `v2`, `Chip`, each `Segmented` segment and the `Stepper` buttons set `hitSlop` to `(target - visual) / 2` above and below (and left and right for the round Stepper buttons). With the default 44 the customer values are unchanged (chips keep 5). Dapur passes 48: chips and segments 7, stepper buttons 2. Every Dapur row of chips or segments sits in a frame at least 48 tall so no parent clips the extended target. Any other control under 48 in Dapur is a defect.

### 2.3 Tokens

`nativeLayout` (in `packages/design-tokens/src/index.ts`) gains, additively:

| Key | Value | Use |
|---|---|---|
| `row.compact` | 64 | two-line row |
| `row.check` | 56 | Daftar masak check row |
| `dense.sectionGap` | 24 | between Dapur sections |
| `figure.lead` | 32 | the lead figure size (line 40) |
| `thumb.compact` | 48 | dish thumbs in Menu rows |

Existing keys keep their values. Dapur sections are 24 apart, headings 12 above their content, groups 8.

### 2.4 Type

Dapur uses the v2 variants: `heroTitle` (tab-root titles, record names, the Menu week range), `section` (section headers; sibling figures at 800), `rowTitle` (identity in rows: a customer, a stop, a package), `bodyStrong` / `bodyL` (line items, values, labels), `meta` (secondary lines, captions, figure labels). New variant `figure`: 32 / 40, 800, tabular figures, charcoal, not a header. It is the lead number on Hari ini and Uang only. Dapur screens stop using `display` (34) and `number` (40). Hand-rolled `fontFor("800")` row titles become `rowTitle` or `bodyStrong`. Every weight goes through `fontFor()` or a variant (`tests/native-font-weights.test.ts`).

### 2.5 Shared blocks move to `packages/mobile-ui`

Move `SectionHeader`, `ListCard` (and its inset constants), `MediaRow`, `GlyphRow`, `GlyphCircle`, `Thumb`, `DecorativeIcon`, `rowLabel`, `metrics` from `apps/customer/src/layout/` and `HeroPhotoFrame` from `apps/customer/src/today/HeroPhoto.tsx` to `packages/mobile-ui/src/layout/`, exported from `@catera/mobile-ui`. The customer app imports them from the package (its `src/layout/index.tsx` may re-export during the move; no customer render changes, and the customer Jest suite stays green). Additions, each additive with unchanged defaults:

- `MediaRow size="compact"`: 64 tall, 48 thumb, title `bodyStrong` or `rowTitle` (prop), one `meta` line.
- `TwoLineRow`: 64 tall, optional leading node (a 28 order badge or a 40 glyph circle), title `rowTitle`, `meta` line, one optional fixed trailing node (48 wide), `rowLabel` for its label.
- `KeyValueRow`: 40 tall (grows with wrap), label `bodyL` muted left, value `bodyStrong` right with tabular figures; all values in one `ListCard` end on one right edge.
- `FigureStrip`: one container (surface on the mood band, radius 16, padding 12 16), 2-4 equal cells split by 1px hairlines, each cell a `meta` label over a value (`figure` for the first when `lead`, `section` 800 for the rest), an optional `meta` subline under the strip; below effective width 340 (`width / fontScale`) it becomes a 2-column grid with the lead spanning both columns.
- `SectionHeader` keeps its API; Dapur passes counts and actions in the trailing slot ("n menu", "Pilih", "+ Paket baru", "Ubah menu").

### 2.6 Shared rows already in `packages/mobile-ui`

`CheckRow`, `StopRow`, `RantangTrack` and the sheet parts read no scale today (inventory 1.1). They gain the Dapur geometry as follows, behind props or the v2 scale, so any customer use is unchanged:

- `CheckRow` (Daftar masak): 56 tall; leading quantity column 48 wide (`section` 800, tabular, right-aligned, so up to 4 digits fit without moving the name); dish `bodyStrong`, optional 40 r8 photo; the 48 check at the right. Checked rows stay in place.
- `StopRow`: 64 (`TwoLineRow` geometry): 28 order badge, name `rowTitle`, address `meta` one line, and the two existing trailing 48 buttons (map, "…") as one fixed trailing column at the same pitch on every row. Opening navigation to a stop is the run's most frequent job, so it stays one tap on the row. Pilih mode keeps its check and the selection bar.
- `RantangTrack size="compact"`: rail 40 (disc 24, ring 32), the visible state-words line hidden (it stays in the accessibility label), stop labels with counts in the existing two-line slots; about 84 tall. The default size is unchanged.
- Sheet bodies keep `sheetSidePadding` (20 iOS / 24 Android) in both apps, so customer sheets do not move; `TimScreen` and `HapusAkun` read it instead of re-deriving it.

## 3. Screens

Each section lists the order top to bottom. "Keep" means behaviour, data and copy are unchanged; only geometry and placement move. Every screen keeps its loading, error and empty states (Three States Rule), rebuilt from the same constants as the loaded layout.

### 3.1 Hari ini (boards HariIni-Masak, HariIni-Antar, HariIni-Staf)

1. **Header**: `MoodHeader band` on the mood tint. A 36 meta row ("Dapur · Hari ini" / "Besok" / "Sedang diantar" with the Hari ini / Besok toggle at the right), 4, the date as a `heroTitle` button with its chevron (min 48 target), 12, the **figure strip** (`FigureStrip lead`): porsi (lead), paket, alamat, with "Antar 10.30" (when a window exists) as its `meta` subline, 12, the compact rantang track, 16. The count card's mascot slot goes (the mascot stays on DoneCard and the empty states). Target: the header ends within y=300 at 412x916 with no demo strip (y=324 with it). With no session, the header is the meta row and the date only.
2. **Live slot**: the kept-copy caption and the read errors stay as they are, above it. The live slot holds the to-dos: the first item, in the existing order, of MulaiCard, report cards and action cards, as one card (attention tone where it has one today); when more exist, a 48 link row "n hal lainnya" expands the rest in place (no new route). The MulaiCard keeps its steps as 56 rows.
3. **Masak** (before departure): `SectionHeader` "Daftar masak" with "n menu" and the Bagikan / Cetak actions as 48 icon buttons in the trailing slot; a `ListCard` of `CheckRow`s; the kitchen-truth lines ("Menu belum diisi · …") and owners' "Isi menu" links directly under the list, unchanged in wording; then `SectionHeader` "Per paket" and a `ListCard` of `KeyValueRow`s (package name, "n porsi").
4. **Antar**: `SectionHeader` "Urutan antar" with "n alamat" and "Pilih" in the trailing slot; a `ListCard` of `StopRow`s, the first 3, then a 48 link row "Lihat n alamat lainnya" (existing behaviour); then Maps and WhatsApp as two side-by-side 50 secondary buttons; the route caption under them.
5. **After departure** the Masak section collapses to one 48 summary row in its own `ListCard` ("Sudah dimasak · 24 porsi", existing data), so Antar starts within one row of where it was; the figure strip and the track stay.
6. **Footer** (`KitchenAction`): unchanged states and copy. Its caption line reserves its height in every state (an empty line when there is no caption), so the footer is one height from "Mulai masak" to "Berangkat antar". Pilih mode keeps `SelectionBar`; the bar's stacked layout below 340 effective width stays.
7. **Fold target** before departure with a live slot: the figure strip, the live slot and 3 check rows above the footer at 412x916 (demo strip on); without a live slot, 5 check rows.
8. Keep: DoneCard ("Semua beres"), the empty meal card and "nothing to cook" card (as `ListCard`-width cards), Besok (no reports, actions or Pilih), staff (no MulaiCard, no "Isi menu"), offline banner and hidden footer, the Hari ini / Besok cross-fade, the stage animation of the track's marker.

### 3.2 Pelanggan (boards Pelanggan, PelangganDetail)

1. **Header** `plain`: one 44 row with "Pelanggan" in `heroTitle` and a trailing "+ Pelanggan lama" action (glyph and label, 48 target). The empty 48 row goes.
2. Filter chips in a 48 frame that scrolls sideways (no wrapping); counts stay in the labels and stay hidden until the data loads.
3. One `ListCard` of `TwoLineRow`s: name `rowTitle`, `meta` "Paket · sisa n hari · area" (from the fields the card shows today), the trailing 48 chat button; the row opens the detail. Target: 8 rows above the fold.
4. **Detail**: the name as `Screen nativeTitle`; a `meta` status line; a `ListCard` of `KeyValueRow`s (Paket, Mulai, Selesai, Sisa, Porsi, from the subscription card's data); "WhatsApp" and the renew action side by side (50, renew primary when it shows today, else WhatsApp alone at full width), the renew hint and `FormError` under them; the address in a 56 canvas-tone well; then per package `SectionHeader` (package name) and a `ListCard` of 48 schedule rows, the first 5, then "Lihat semua n" expanding in place.
5. Keep: list skeleton (rebuilt as 64 rows and 34 chips), error, empty caption.

### 3.3 Menu (boards Menu, MenuHari)

1. **Header**: `MoodHeader` (44 row with the week label and, for staff, the gear), then one 44 row: chevron (44), the week range in `heroTitle` centred, chevron (44); the Siang / Malam segment under it when the package serves both meals (in a 48 frame).
2. **Day strip**: one row for any package. Tile width `(innerWidth - (n - 1) x 4) / n` for n delivery days, height 56, radius 12: weekday `meta` over the date `bodyStrong`, the existing state mark as a 6 dot, selected filled. A 7-day package at 412dp gives tiles of about 51; at 360dp about 44 (still a 48-tall target).
3. Package chips in a 48 frame (horizontal scroll), then "Salin minggu lalu" and "Bagikan menu" as two side-by-side 50 secondary buttons (staff: "Bagikan menu" alone, full width). Captions as today.
4. **The day**: `SectionHeader` with the date and "Ubah menu" (owner) in the trailing slot; per component group a `meta` label, then a `ListCard` of `MediaRow size="compact"` dish rows: 48 thumb, or a dashed not-set `Thumb` with the camera glyph that is the "Tambah foto" action for the owner (48 target); every dish row is 64 with or without a photo. Staff rows are the same 64 rows, read-only.
5. "Tampilan di aplikasi pelanggan" stays last, its cover 160 wide.
6. **Day editor** (`menu/[date]`): groups as `SectionHeader` + 48 rows; inputs and suggestions at 48; "Simpan menu" in a pinned `ScreenFooter` (owner only). Staff: read-only, no footer.
7. Keep: loading skeleton (strip for the package's day count), errors, the completeness captions and the disabled states of Salin and Bagikan with their reasons.

### 3.4 Usaha, Uang, Tim (boards Usaha, Uang)

1. **Usaha** header `plain`: the kitchen name in `heroTitle` and the 44 gear in one row.
2. The payments attention card first when it applies (unchanged content, `Card` attention tone).
3. "Paket": `SectionHeader` with "+ Paket baru" in the trailing slot; a `ListCard` of 72 `MediaRow`s (56 photo, `meta` "Rp 25.000 / makan" and the existing package facts), each with its trailing 48 "…".
4. "Kelola": one `ListCard` of 48 `GlyphRow`s: Uang, Impor pelanggan, Tim, Pembayaran, Pengaturan (Pengaturan joins this list; its one-row card goes).
5. Target: everything above the fold at 412x916 with the payments card shown and 2 packages.
6. **Uang**: a lead block (`meta` label, the payout in `figure`, `meta` caption), 24, a `ListCard` of `KeyValueRow`s for the money rows, amounts right-aligned on one edge. No row changes height when an amount changes.
7. **Tim** (fit sheet): margin from `sheetSidePadding`; the code box as a `Card` (radius 16); unchanged otherwise.

### 3.5 Sheets (boards SheetAtur, SheetBukti, SheetBalas)

1. **ExceptionSheet** (`atur-antaran/[id]`): header unchanged; the two options ("Gagal diantar", "Pindah tanggal") as `TwoLineRow`s with a 40 glyph circle in one `ListCard` (selection marked as today); the reason field when it applies; the primary pinned in `SheetFooter`. Skeleton: two 64 rows and the footer.
2. **ProofSheet** (`sampai`): one 72 `MediaRow` per stop, the photo tile (64 → 56 thumb r8, camera glyph when empty) as the thumb, stacking below 400 effective width as now; the primary and the reason caption pinned in `SheetFooter`. Skeleton: 72 rows.
3. **ReplySheet** (`balas/[id]`): the report as a `ListCard` (status pill, report text), earlier replies, the reply `Field` (multiline, min 88), then "Balas" pinned with "Tandai selesai" as the outlined second action side by side; WhatsApp stays as a link row in the body.
4. **MoveSheet** keeps its calendar and pinned footer; its skeleton matches the calendar's real height.
5. **Laporan/[id]** (pushed): the same blocks as the ReplySheet in a page.
6. Confirm and action sheets, Bahasa, Tampilan, Hapus akun: unchanged structure; margin and controls from v2.

### 3.6 Paket detail and editor (board PaketDetail)

The photo at 16:10 in `HeroPhotoFrame` (the fixed 168 goes) on both. Detail: name `heroTitle` as the native title, description `bodyL`, facts as `KeyValueRow`s, the copy action as a 50 secondary button. Editor: sections 24 apart with `section` headers ("Foto", "Isi satu porsi", "Gizi", "Harga", "Hari antar", "Kuota"), v2 Fields and Steppers, delivery-day chips in a 48-tall wrapping row (the one chip row that wraps, because all days must show), "Terbitkan paket" pinned as now.

### 3.7 Impor (board ImporTinjau)

The paste field takes `Field` geometry (radius 12, 16 inset, min 160); attachments as now. Review stage: one `ListCard` of `TwoLineRow`s, one per imported customer (name, `meta` phone and area, trailing "Ubah" opening `impor-baris`, a pale state pill for a row with a problem), instead of a card per row. Pinned footer unchanged. `impor-baris` keeps its pinned "Selesai".

### 3.8 Auth, settings, Data akun, Aktifkan

Inherit v2 through the shared shells (AuthScreen's v2 branch, Pengaturan, SettingsRows with margin 16). Data akun keeps one card per concern with `section` headers. Aktifkan keeps its step cards, with `section` step headers and 24 between steps. No structural change.

### 3.9 Staff

Hari ini and Menu as above without the owner controls. No other change.

## 4. Out of scope

Colour, art, copy wording (beyond counts moving into headers and labels that already exist), the customer app's look, server and data changes, new routes, iOS-specific tuning (not verifiable, no Mac), the web app.

## 5. Acceptance

- `npm run typecheck`, `npm test` (root Vitest), `npm test -w @catera/caterer`, `npm test -w @catera/customer` and `npm run build` pass, with no failure beyond the recorded baselines (customer `customer-sheets` "moving a day toasts the new date").
- Tests that pin Dapur's classic geometry (inventory section 6) are updated to the new geometry in the task that changes it, never deleted; `layout-classic.test.tsx` becomes a `layout-dapur` test that pins the Dapur opt-in (v2 values plus the 48 target). Customer geometry tests stay unchanged.
- Emulator gates (Pixel 8 API 36, Expo Go, Dapur Metro on its own port, the demo backend on the `layout-gate` copy): every screen in section 3, owner and staff, light; Hari ini before and after departure; Hari ini, Pelanggan and Menu at 360dp and at font scale 1.3; Hari ini dark. Contact sheets compared with the canvas boards. Touch targets at least 48 by script; no truncated primary label; the fold targets in 3.1, 3.2 and 3.4 measured.
- DESIGN.md gains a "Dapur layout scale (October 2026)" section after the final gate, and the customer section's "Catera Dapur keeps its geometry until its own layout pass" line is updated.
