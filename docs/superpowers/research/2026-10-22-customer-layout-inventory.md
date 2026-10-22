# Customer app layout inventory (2026-10-22)

Read-only map of how `apps/customer` lays things out, for a designer rethinking layout, sizing and spacing. Branch `v2`. Colour is out of scope. All paths are repo-relative. "Est." marks my own arithmetic, not a measurement.

Assumptions for every "above the fold" estimate: 412x915dp Android phone, font scale 1.0, status-bar inset about 40dp, NativeTabs bar 80dp (`packages/mobile-ui/src/toastAnchor.ts:31`), so visible content ends near y=810 from the top of the screen. y values are measured from the top edge of the screen.

## 1. Tokens and primitives

### 1.1 What is defined versus what the native app reads

`packages/design-tokens/src/index.ts` defines `spacing` (:22-30), `radii` (:31), `typography` (:32-38). Native code imports none of them. A grep of `apps/customer` and `packages/mobile-ui/src` finds imports of only `nativeMotion`, `nativeThemes`, `nativeMood`, `nativeArt`, `nativePhoto` and `NativePalette` from `@catera/design-tokens`. `spacing`/`radii`/`typography` feed the web CSS variables only (:70-76). So the native layout has no shared spacing, radius or size scale; every number is hard-coded in a style.

| Token set | Defined at | Values | Used natively |
|---|---|---|---|
| spacing | design-tokens/src/index.ts:22 | xs4 sm8 md12 lg16 xl24 xxl32 section48 | no |
| radii | index.ts:31 | control10 surface16 dialog20 | no |
| typography | index.ts:32 | body16 small14 title24 heading32 | no |
| nativePhoto | index.ts:254 | scrim 0.3, text block 0.72 over 26dp, corner button 0.66 | yes (Plate) |

### 1.2 The real native type scale

`packages/mobile-ui/src/components.tsx:35-45`, `Text variant`:

| Variant | size / line / weight / tracking | Colour key |
|---|---|---|
| display | 34 / 40 / 800 / -1 | charcoal (Jelajah headline only) |
| title | 30 / 39 / 700 / -0.8 | charcoal (header titles) |
| outcome | 26 / 32 / 700 / -0.6 | charcoal (success beat) |
| heading | 21 / 28 / 700 / -0.4 | charcoal |
| body (default) | 14 / 23 / 400 | charcoal |
| label | 12 / 23 / 700 | charcoal |
| caption | 11 / 18 / 400 | muted |
| number | 40 / n/a / 800 | charcoal (unused in customer src) |

Variant usage in `apps/customer/src`: caption 62, heading 33, label 31, title 14, display 2 (grep of `variant="…"`).

Raw sizes outside the variants (RNText or style overrides) across `apps/customer/src` + `packages/mobile-ui/src` (value x count): fontSize 14x18, 13x16, 15x14, 12x14, 16x5, 22x4, 17x4, 26x3, 18x2, 34x2, and one each of 40, 32, 30, 28. lineHeight 20x15, 18x13, 16x11, 22x9, 28x5, 24x4, 32x3, 26x2, 23x2, 17x2. So the 12/13/14/15 band is crowded: four sizes one point apart.

Other fixed type: Button label 15/700 (components.tsx:602); Chip and Segmented label 13/700 (:606); Field label 13/700 (:617) and input 15 (:626); field caption 12 (:629); Stepper body 15 (:630); native Android content title 24/32 bold (:645); Android header 22 bold, iOS large title 34, iOS inline title 17 (`packages/mobile-ui/src/nativeHeader.ts:42-49`); tab labels 12 Android / 10 iOS (`tabBar.ts:124`); sheet title 17/22 iOS or 22/28 Android (`SheetHeader.tsx:619,636`); settings row label 16/22, supporting 14/20 (`settings/SettingsRows.tsx:102-113`).

Fonts: Plus Jakarta Sans, one registered family per weight (`type.ts:7-13`).

### 1.3 Spacing in practice

No scale is enforced. Counts of literal values across the two source trees:

- `gap`: 8x54, 12x50, 16x43, 10x27, 4x26, 2x21, 6x19, 14x9. Dominant: 8/12/16 with a very common 10 in between.
- `paddingHorizontal`: 14x11, 8x7, 12x7, 20x6, 24x5, 16x2. 14 is the most common horizontal inset inside a card, and it is not on the 4/8 grid the token file implies.
- `paddingVertical`: 8x6, 4x5, 12x4, 10x3. One-offs 9, 6, 2, 1.
- `padding`: 14x5, 12x5, 16x4, 10x4, 24x2; one-offs 18, 8, 4, 2.
- `borderRadius`: 16x14, 12x14, 10x11, 9x4, 4x4, 24x4, 20x4, 999x3, 8x3, 6x3, 14x3, 22x2, 18x2; plus 5, 28 (`HERO_RADIUS`, `Plate.tsx:165`), 32 (MoodHeader overlap, `MoodHeader.tsx:177`) and 28 (MoodHeader default).
- `minHeight`: 48x19, 56x8, 52x5, 60x4, 88x3 (multiline fields), 64x2, 50x2, then 76, 72, 44, 32, 28.

### 1.4 Named layout constants

| What | Value | Where |
|---|---|---|
| Screen side padding | 20 | `components.tsx:642` (`screenBody`), also `MoodHeader.tsx:199`, `nativeTitle` `components.tsx:644`, `settings/SettingsRows.tsx:20` (`BODY_INSET`) |
| Screen top padding | 16 (4 under a content title) | `components.tsx:642,644` |
| Screen bottom (scroll) | 32 | `components.tsx:490` |
| Section gap (body) | 16 | `components.tsx:642`, repeated as `FadeSwap style={{ gap: 16 }}` in every screen |
| Max content width | 760, centred | `components.tsx:642,647`, `MoodHeader.tsx:199` |
| Footer | padding 16, bottom 20, 1px top border, gap 8 | `components.tsx:646-656` |
| Card (shared) | radius 16, padding 16, gap 10, 1px border | `components.tsx:616` |
| Button | minHeight 48, radius 10, paddingHorizontal 18 | `components.tsx:590-596` |
| Text button | minHeight 48, paddingHorizontal 4 | `components.tsx:599` |
| Chip | minHeight 48, radius 9, paddingHorizontal 14 | `components.tsx:603` |
| Segmented | track padding 4, radius 10; segment minHeight 48, radius 8 | `components.tsx:607-614` |
| Input | minHeight 48, radius 9, paddingHorizontal 14, label to input gap 6 | `components.tsx:276,618-628` |
| Stepper | minHeight 52, buttons 48x48 | `components.tsx:631-638` |
| Round button | 48x48, radius 24 | `components.tsx:580-589` |
| MoodHeader | paddingTop = inset + 12, paddingBottom 16 (+58 with hero overlap), radius 28 (32 with overlap), content gap 12, top row minHeight 48 | `MoodHeader.tsx:24,177,186-201` |
| Mood toggle | tabs min width 84, 48 tall, label 13/700, 3dp track | `MoodHeader.tsx:29-30,64-119` |
| Mood arc block | about 104 tall | `brand/MoodArc.tsx:31` |
| Hero | outer padding 10, radius 28, photo radius 20, body padding 8/12/8, overlap -74 | `today/Plate.tsx:165-170,216-218,327,354` |
| Hero pager | card width = pager width - 64 (next card peeks), gap 12, shadow room 32 | `mobile-ui/src/HeroPager.tsx:17-23` |
| Month grid | cell 52 tall (min width 44), gap 2, bleed -8 (days sit 12 from edge), 6 week rows always | `schedule/MonthGrid.tsx:24-32,144` |
| Sheet side padding | 20 iOS, 24 Android; body top 12; bottom +16; Form detents [0.6, 1]; Android corner 28 | `SheetHeader.tsx:333,443-447`, `nativeHeader.ts:68-98` |
| Sheet handle | 32x4 in a 36 tall slot | `SheetHeader.tsx:66-70` |
| Settings row | minHeight iOS 52 / Android 56 (72 with two lines); inset 16 iOS / 20 Android | `settings/SettingsRows.tsx:195,159` |
| Ring photo sizes | 34 (plans stack), 40, 54, 60, 66 | PlansRow, UpcomingDays, OtherMealRow, TomorrowRow/PlanDetail, Jelajah |

### 1.5 Row heights in use (all hand-set)

Account `Row` 52 (`account/Row.tsx:66`); Notifications row 52 (`Notifications.tsx:85`); ChooseMenu date row 52 (`ChooseMenu.tsx:512`); Upcoming day row 60 (`UpcomingDays.tsx:178`); OtherMealRow 60 (`Beranda.tsx:488`); Waiting row 64 (`WaitingList.tsx:258`); PlansRow 64 (`PlansRow.tsx:69`); Jadwal MealRow 72 (`Jadwal.tsx:275`); Plan upcoming row 76 (`PlanDetail.tsx:311`); CheckRow 56 (`CheckRow.tsx:76`); Settings 52/56/72; reaction button 56 (`Plate.tsx:560`); Breakdown length option 56 (`buy/Breakdown.tsx:130`); Jelajah meal button 60 (`Jelajah.tsx:77`).

### 1.6 Image sizes and ratios

Only `aspectRatio: 1.65` in the customer app is `buy/PaidOutcome.tsx:174` (plus a theme swatch). Everything else is a fixed height, so the same photo crops differently per screen:

| Where | Size | File:line |
|---|---|---|
| Hero plate photo | minHeight 168, radius 20 | `Plate.tsx:327` |
| Dead card-variant plate photo | height 268, radius 22 | `Plate.tsx:328,520` (`variant="card"` is never passed; only `Beranda.tsx:438,452` render `Plate`, both `hero`) |
| Plan detail hero photo | height 168 | `PlanDetail.tsx:220` |
| Paid outcome hero photo | aspect 1.65 (about 213 tall at 352 wide) | `PaidOutcome.tsx:174` |
| Package row (Jelajah) | 112x112 | `PackageCard.tsx:114` |
| Package card (tall) | height 196 | `PackageCard.tsx:123` |
| Home offer card | height 150 | `EmptyHome.tsx:128` |
| Package detail photo | height 250 plus status inset | `PackageDetail.tsx:67,362` |
| Day screen photo | height 180, radius 16 | `DayScreen.tsx:140` |
| ChooseMenu photo | height 120, radius 12 | `ChooseMenu.tsx:516` |
| Jadwal meal thumb | 56x56 radius 10 | `Jadwal.tsx:277` |
| Recap photo | 72 tall radius 12 | `RecapCard.tsx:130` |
| Proof photo | 96x96 radius 12 | `Plate.tsx:519` |
| Action sheet context | 56x56 radius 12 | `ActionSheet.tsx:48` |
| QRIS | 232 frame, 200 code | `QrisCode.tsx:34,48` |
| Mascot / state art | 120 (96 at 360dp and font scale 1.3) | `brand/StateArt.tsx`, `stateArtSize` |

## 2. Shared layout components

All in `packages/mobile-ui/src` unless noted.

- `Screen` (`components.tsx:351-513`). Props: `scroll` (default true), `footer`, `header` (full-bleed MoodHeader), `nativeTitle`, `title`, `bleed`, `onScroll`, `refreshControl`. Always: SafeAreaView, KeyboardAvoidingView, ScrollView with bottom padding 32, then a `screen-body` View (padding 20 sides, 16 top, gap 16, max 760). With `header`, the header scrolls with the page above the capped body, and `StatusBand` paints the inset. With `nativeTitle` on Android it prints a 24/32 heading as the first content line and moves it into the bar on scroll (:451-463); on iOS it is the large title.
- `ScreenFooter` (:523): the `footer` slot. Surface fill, 1px top border, 16 padding, 20 bottom, gap 8, adds bottom safe area on iOS.
- `StickyAction` (`StickyAction.tsx:13`): optional caption (11/18) over a full-width primary `Button`, gap 8. Adds no chrome.
- `MoodHeader` (`MoodHeader.tsx:149`). Props: `meta`, `title` (string uses `title` 30/39, `titleVariant="display"` 34/40), `trailing`, `toggle`, `arc`, `children`, `overlap` (0 or 58), `testID`. Holds a fixed 48dp top row, then title, then `arc` or `children`, gap 12. Radius 28/32 bottom corners only.
- `MoodToggle` (`MoodHeader.tsx:37`): pill tablist, 48dp tabs on a 3dp track. Not drawn when `arc` is set.
- `MoodArc` (`brand/MoodArc.tsx:75`): the day-arc switch under Beranda's headline, about 104 tall.
- `StatusBand` (`StatusBand.tsx:166`): absolute strip of inset height in the header fill.
- `Button` (`components.tsx:109`). Props: `label`, `onPress`, `variant` primary/secondary/text, `disabled`, `busy`, `ink`, `edge`, `style`. 48 tall, 15/700 label; text variant has paddingHorizontal 4.
- `Chip` (:191) and `Segmented` (:217): 48 tall, 13/700. `FilterChip` (`discover/FilterChip.tsx:30`) is a copy of `Chip`.
- `Card` (:250). Props: `tone` surface/attention/sage, `style`. Padding 16, gap 10, radius 16.
- `Field` (:265), `Stepper` (:297), `RoundButton` (:543), `HeaderIconButton` (`HeaderIconButton.tsx`).
- `PressableRow` (`PressableRow.tsx:43`): bare Pressable with 0.7 opacity on press; carries no padding, so each caller sets its own.
- `PhotoRing` (`PhotoRing.tsx`): round photo, 3dp ring, `size` prop, optional label under it.
- `HeroPager` (`HeroPager.tsx`): snap pager with peek, dots (8dp, active 20 wide) and "{i} dari {n}".
- `Skeleton` / `SkeletonGroup` (`Skeleton.tsx:95,126`): block with `width`, `height`, `radius` (default 8). Per-screen skeletons live in `apps/customer/src/skeletons.tsx` and hand-copy each screen's sizes (e.g. 112 thumb :109, hero 168 :45, month cell 52 :303).
- `ReadError` (`ReadError.tsx:191`): message plus text button, optional mascot (`art`).
- `FadeSwap` (`motion/`): the block wrapper every screen puts its content in, with its own `style={{ gap: 16 }}`.
- Sheets: `sheetOptions` (`nativeHeader.ts:82`), `SheetBody`, `SheetFooter`, `SheetFitBody`, `SheetHeader` (`SheetHeader.tsx:344,496,516,564`), `ConfirmSheet` (buttons minHeight 50/48, radius 10), `ActionSheet` (rows 52 iOS / 56 Android). `CalendarSheet`, `CheckRow` (56).
- Settings: `SettingsSection`, `SettingsRow`, `SettingsSwitchRow`, `ChoiceList` (`settings/SettingsRows.tsx:22,133,233,315`). iOS draws inset grouped cards (radius 16, row divider 1px inset 16); Android draws edge-to-edge rows with `marginHorizontal: -20` (:73).
- Customer-local: `account/Row.tsx` (52 tall row, label 14/700, caption 11, chevron 18), `SectionLabel` (`Row.tsx:57`, label variant, marginTop 4), `today/WaitingList.tsx:39` `SectionTitle` (18/24 bold), `today/PlansRow.tsx`, `today/UpcomingDays.tsx`, `discover/PackageCard.tsx`, `today/Plate.tsx`.

## 3. Screens

Header kinds: "mood" = `MoodHeader` full-bleed, scrolls with the page (tab roots). "native" = stack header, with `nativeTitle` (iOS large title, Android 24/32 content line that moves into the bar). Estimated header heights (inset 40 included): Beranda loaded 380, Beranda empty 167, Jadwal 563, Jelajah 340, Akun 202.

Routes: tab roots are `app/(tabs)/(index|jadwal|jelajah|akun)` and everything else is a shared route inside each tab (`app/(tabs)/(index,jadwal,jelajah,akun)/*.tsx`). Buy, Bayar, login, register, recover and claim are modal or full-screen-modal stack routes (`app/_layout.tsx:86-103`), forms are form sheets (:113-127).

### Beranda (`today/Beranda.tsx`)
- Header: mood, `HomeHeader` (:172). Meta row (date) 48, headline 30/39 two lines ("Siang ini,\n{dish}."), `MoodArc` 104, overlap 58 when a hero exists.
- Body: one `FadeSwap` (gap 16) lifted by `HERO_OVERLAP` -74 when a hero exists (:408-411).
- Order: (1) `StateArt` tidur only if nothing today, next or planned (:417); (2) `HeroPager` (several plates of the chosen meal) or one `Plate` hero; (3) `ConnectionBanner` (offline only); (4) `ReadError` (read failed with data); (5) `StaleCopy`; (6) `OtherMealRow` 60 tall with a 54 ring; (7) `RecapCard`; (8) `WaitingList` ("Perlu kamu urus", rows 64); (9) `TomorrowEntry` (label, 60 rings); (10) `UpcomingDays` ("Berikutnya", rows 60); (11) `PlansRow` (64).
- Hero (`Plate.tsx`): frame padding 10 radius 28; photo 168+ with scrim, overlay padding 18, meal line 13/700, sentence 28/33/800, second line 17/600; body padding 8/12/8, dishes `heading` 21/28; then the Rantang tracker or action buttons (two answers, three reaction buttons 56 tall, chat/report buttons).
- Above the fold (est.): header 0-380, hero 322-about 660, other-meal row about 676-736, "Perlu kamu urus" title about 752, first waiting row clipped near 810. WaitingList, Tomorrow, Upcoming and PlansRow are below the fold.
- Sticky: none. Tab bar.
- States: loading (`HomeHeader` + `BerandaSkeleton`), failed with no cache (`MoodHeader` titled "Beranda" + `ReadError art`), signed out (`EmptyHome`), empty (`EmptyHomeBody`: mascot 120, title 30/39 centred, body, three `OfferCard`s 150-photo, "Jelajah paket" button, caption, optional "Masuk"), kept copy offline (actions hidden), refreshing ("· Memperbarui…" in meta row), pager vs single hero, mood Siang/Malam.

### Jadwal (`schedule/Jadwal.tsx`, `MonthGrid.tsx`, `DayScreen.tsx`)
- Header: mood. Meta row holds only month chevrons (48x48), title is the month (30/39), then the month grid (weekday row, six 52 rows, gap 2, bleed -8), then the legend (18dp swatches).
- Order: grid and legend inside the header; body: optional `ReadError` / `StateArt` tidur when the month is empty, day label (`label` 12/23), then a `Card` with padding 4 holding `MealRow`s (72 tall, 56 photo, caption line, chevron) or a muted "no delivery" line.
- Above the fold (est.): header 0-563, day label about 579-602, first MealRow about 618-690, second about 690-762, third clipped.
- Sticky: none. Pull to refresh.
- States: loading (grid of skeleton cells, same height), failed month (puzzled mascot inside the grid frame), month empty, day empty, refresh error.
- `DayScreen` (native stack, bar title = date, no content title): photo 180 radius 16, caption (11/18, name · caterer), one `Card` per meal with `DayMore` in the corner, delivery address block (label + body + caption), optional secondary "Lihat atau pilih menu", `ChatKatering`, optional text "Ada masalah". Sticky footer: primary "Ubah hari" unless closed.

### Jelajah (`discover/Jelajah.tsx`, `PackageCard.tsx`, `PackageDetail.tsx`)
- Header: mood. Meta slot is the area picker (48 tall, 15pt label), trailing is a 48 round heart button, title `display` 34/40 two lines ("Makan siang / minggu depan?"), two 60 tall meal buttons (radius 18, gap 10), a 48 tall search field (radius 14).
- Body order: category rings (`PhotoRing` 66, horizontal, gap 8), two filter chips (48, horizontal), optional save error, then list of `PackageCard layout="row"` (112 square photo, body padding 12, name `heading`, who/when caption 13, price `heading` plus unit, optional kcal and trial label; heart absolute at 4,4). Empty and filtered-empty states use `StateArt` mencari + `heading` + secondary button.
- Above the fold (est.): header 0-340, rings about 356-456, chips about 472-520, card 1 about 536-650, card 2 about 666-780, card 3 clipped.
- Sticky: none.
- `PackageDetail`: `Screen bleed`. Photo 250 + inset under a transparent bar, heart bottom-right; title block (`title` overridden to 26/32, caption 13/18, nutrition line 14/20 label); description body; "Isi paket" `heading` + per-meal bordered boxes (padding 14, radius 14); `NutritionCard`; facts rows (label column 32%, min 100); "Ulasan" + up to 3 boxes. Sticky footer: price (caption + title 20/26) beside "Coba 1 hari" (secondary) and "Pilih jadwal" (primary), wrapping if tight.

### Akun (`account/Akun.tsx`, `Row.tsx`)
- Header: mood, meta row 48 holds only the settings gear, title is the user's name (30/39), then a 23dp contact line.
- Order: "Paket aktif" `SectionLabel` (label, marginTop 4), `PlanList` rows (`Row` 52: label 14/700, caption 11), then a second block of 7 `Row`s (Data akun, Alamat, Disimpan, Riwayat pembayaran, Bantuan dan laporan, Notifikasi, Pengaturan). Blocks are separated only by the body's 16 gap. Row dividers are 1px top borders, no card.
- Above the fold (est.): everything fits with up to two plans: header 0-202, label about 222, plans about 249-361, rows about 377-741.
- States: loading (`ListSkeleton rows=4`), signed out (`SignInFirst`: MoodHeader + sentence + primary "Masuk" + Pengaturan row), no plans ("Belum ada paket aktif." body muted), plan read error.

### Pengaturan (`settings/Pengaturan.tsx` customer wrapper, `packages/mobile-ui/src/settings/Pengaturan.tsx`)
- Native stack header, `nativeTitle` "Pengaturan". Order: Notifikasi section (account only, switch row 72 with supporting line), Aplikasi (Bahasa, Tampilan), Tentang (version, Syarat dan privasi), extra rows (Data akun), Keluar (danger).
- iOS: muted 13/18 section label over a card (radius 16, rows 52, inset 16). Android: bold 14/20 section label, edge-to-edge rows 56 (72 two-line) with inset 20 and 1px dividers. Language and theme open form sheets (`ChoiceList`, rows 56/72 Android, 52/72 iOS).

### PlanList and PlanDetail (`plan/PlanList.tsx`, `plan/PlanDetail.tsx`)
- `PaketSaya`: native title "Paket aktif", then the same `PlanRows` as Akun (52 rows).
- `PlanDetail`: native title = package name; order: caterer line (body muted, marginTop -8), `Hero` (frame 10/28, photo 168 radius 20, `title` headline "n hari tersisa", dates body, optional renewed tag), `ConnectionBanner`, `StaleCopy`, "Berikutnya" label + rows (76 tall, 60 ring, day label 12/18, dishes body, chevron, `DayMore`). Sticky `StickyAction` ("Lanjutkan paket" or trial) unless offline or cancelled. Header-right chat button when a number exists. States: loading skeleton (caterer line 23 high, hero 168), not found, cancelled (no list), offline.

### BuyScreen, PaymentScreen, PaidOutcome (`buy/`)
- `BuyScreen` (full-screen modal, native title = package name): `PendingPayment` (attention Card) if a checkout is open, `StartLine` (caption + text + text button), "Lama paket" label with `LengthOptions` (56 tall, radius 12) or plain text, a bordered box with `Stepper` (52) and the address caption + text button, `Breakdown` (gap 10 rows), quote error or "still running" block, `PayWith` (label + Card with 1.5 forest border), `Terms` (12/17). Sticky footer: "Total" caption + 22/28 amount left, primary "Bayar" `flex: 1` right.
- `PaymentScreen` (full-screen modal): stage switch via `FadeSwap`. Pay stage: sandbox caption, centred Total (caption + 32), QRIS 232 frame + secondary save button, or VA `Card` (centred, 26 number), instruction steps in a `sage` `Card` (26 circles), footer primary "Saya sudah bayar, cek status". Checking and failed stages use `PaymentOutcome` (title 30/39, caption, buttons). Paid stage: `PaidBeat` (`SuccessBeat`, `outcome` 26/32 title) then `PaidOutcome`: hero (10/28 frame, photo aspect 1.65, name `heading`, caterer body, bold first-delivery line), body line, wrapping date tags (radius 8, padding 10x2). Sticky `PaidActions`: primary "Lihat jadwal" (StickyAction), optional secondary, text "Ke Beranda".

### Masuk (`account/Masuk.tsx`, route `app/login.tsx`)
- Modal with a native header titled "Masuk" and Close at the leading edge. Body: mascot 120 (`StateArt melambai`), a muted centred sentence (paddingTop 8, gap 12), a form `View` with `gap: 14` (Field phone, optional field, primary button, text buttons), alternate method (email) the same shape, text button, and in demo mode a "Demo" caption + secondary button. No sticky footer; nothing is pinned, so the keyboard simply pushes the scroll view.

## 4. Inconsistencies

Numbered roughly by impact for layout work.

1. No native scale: `spacing`/`radii`/`typography` exist in `packages/design-tokens/src/index.ts:22-38` but native never imports them; every screen hard-codes gaps 2/4/6/8/10/12/14/16 and radii 4-32.
2. Section heading style varies by screen: Beranda `SectionTitle` 18/24 bold (`WaitingList.tsx:247`) is not a `Text` variant; Akun `SectionLabel` is `label` 12/23 with marginTop 4 (`account/Row.tsx:57-62`); Plan detail "Berikutnya" is `label` + marginBottom 4 (`PlanDetail.tsx:263`); Package detail uses `heading` 21/28 (`PackageDetail.tsx:297,332`); Jadwal day label is `label` (`Jadwal.tsx:203`); Settings uses 14/20 bold on Android and 13/18 muted on iOS (`SettingsRows.tsx:40-41`).
3. Heading-to-content gap differs per section: 10 (`WaitingList.tsx:208`, `UpcomingDays.tsx:116`, `PackageDetail.tsx:296`), 6 (`SettingsRows.tsx:50`), 4 (`Row.tsx:59`, `PlanDetail.tsx:263`), none beyond body gap 16 (Jadwal :203).
4. Same-looking surfaces are built five ways, all radius 16 with a 1px `line` border but different padding: shared `Card` (padding 16, gap 10, border = fill colour, `components.tsx:616,573`), `WaitingList` card (rows 14/12, `WaitingList.tsx:249-263`), `PlansRow` (14/12, :68), `PackageCard` row and tall card (two near-identical styles in one file, `PackageCard.tsx:105-124`), `EmptyHome` offer card (`EmptyHome.tsx:121-128`), `BuyScreen` box (`BuyScreen.tsx:367`), package-detail boxes at radius 14 padding 14 (`PackageDetail.tsx:378`). Other radii for similar cards: 20 (`RecapCard.tsx:121-125`), 22 (`Plate.tsx:520`, dead code), 28 (hero).
5. Three copies of the hero frame (padding 10, radius 28, body 8/12/8): `Plate.tsx:216-220,354`, `PlanDetail.tsx:216-223`, `PaidOutcome.tsx:172-177,77`. Their photos disagree: min 168 (`Plate.tsx:327`), fixed 168 (`PlanDetail.tsx:220`), aspect 1.65 (`PaidOutcome.tsx:174`). `Plate`'s `variant="card"` branch (268 photo, radius 22, :328,520) is unreachable (callers `Beranda.tsx:438,452` pass `hero`).
6. Package photo is a different size on every surface: 112 square row (`PackageCard.tsx:114`), 196 card (:123), 150 home offer (`EmptyHome.tsx:128`), 250 detail (`PackageDetail.tsx:362`), 180 day (`DayScreen.tsx:140`), 120 choose menu (`ChooseMenu.tsx:516`), 168 plan hero, 56 meal thumb (`Jadwal.tsx:277`). The tall card (196) is only used by the Saved list; the Home offer card is a third version with its own padding (14) and no heart.
7. Interactive control geometry differs by one or two points: Button radius 10 / 48 tall (`components.tsx:591`), Chip and input radius 9 (:603,622), Segmented 10/8 (:611,614), `FilterChip` copy (`FilterChip.tsx:30`), Jelajah `MealButton` 60 tall radius 18 (`Jelajah.tsx:77,84`), search field radius 14 (:230), `LengthOptions` 56 tall radius 12 (`Breakdown.tsx:130`), reaction buttons 56 tall radius 10 (`Plate.tsx:560-561`), ConfirmSheet buttons 50 tall (`ConfirmSheet.tsx:63`). Two selection patterns on Jelajah's header (mood toggle in other tabs versus two big 60 buttons here).
8. Title sizes are overridden ad hoc: `title` is 30/39 but Package detail overrides to 26/32 (`PackageDetail.tsx:280`), footer prices 20/26 (:204), 22/28 (`BuyScreen.tsx:262`), 32 (`PaymentScreen.tsx:298`), `outcome` 26/32; Jelajah alone uses `display` 34/40 (`Jelajah.tsx:47`); the Android content title is a separate 24/32 (`components.tsx:645`) and the iOS large title 34 (`nativeHeader.ts:42`).
9. Small text has no stable ladder: the `body` variant is 14/23 but Button, Field input, Stepper and many rows use raw 15 (`components.tsx:602,626,630`; `WaitingList.tsx:259`, `PlansRow.tsx:92`); `caption` is 11/18 but cards override it to 12/16 (`PlansRow.tsx:93`, `UpcomingDays.tsx:177,183`, `WaitingList.tsx:259`) and 13 (`PackageCard.tsx:49,82`, `PackageDetail.tsx:284`). Row titles read 14, 15, 16 depending on which list the row belongs to.
10. List rows are unlike each other: heights 52/56/60/64/72/76, row padding 8/10/12 vertical, dividers as per-row top borders (Akun, Upcoming, Waiting, Plan) vs a separate 1px View (Settings) vs none (Jelajah); ring sizes 34/40/54/60/66; photo shapes ring vs rounded square vs full-bleed. Rows inside cards pad 14 horizontally, rows on the page pad 0, settings rows pad 16/20.
11. Header heights and top rows are inconsistent in use: all `MoodHeader`s reserve a 48dp top row (`MoodHeader.tsx:24`), so Akun and Jadwal pay 48dp for a lone gear or chevrons while their title sits below. Heights range about 167 to 563. Jelajah's header holds four stacked modules (area, headline, meal switch, search) and uses a different Siang/Malam control than the toggle.
12. Header model is mixed: tab roots use a mood header with no native bar; pushed screens use a native bar with either a content title (`nativeTitle`) or a bar-only title (`title`, e.g. DayScreen); modals add Close. Package detail is a third kind (bleed photo under a transparent bar). The same page (Akun's PlanList) renders under both header kinds (`Akun.tsx:105`, `PlanList.tsx:88`).
13. Side padding is 20 everywhere except: Settings rows (16 iOS, 20 Android, with negative margins to run edge to edge, `SettingsRows.tsx:73,159`), sheets (20 iOS, 24 Android, `SheetHeader.tsx:333`), Jadwal grid (12 from the edge via BLEED -8, `MonthGrid.tsx:30`), hero pager cards (peek by INSET 64, `HeroPager.tsx:19`), package detail photo (full-bleed via -20 margins, :234,363).
14. Section gap is 16 everywhere because the body gap and each screen's `FadeSwap` gap are both 16 (nested, not stacked), but intra-section gaps range 2-12, so grouping is signalled only by weak cues (heading style) and not by space. Akun's two blocks are separated by 16 and look like one list.
15. Skeletons restate each screen's sizes by hand (`skeletons.tsx:26-300`) so any layout change must be made twice; they already drift (Jelajah skeleton chip widths 150/140 vs real chips sized by label; skeleton ring 66 vs real label under the ring).
16. Nested surfaces: `Card` inside a `Card`-like context on Day screen (meal Cards with `DayMore` using negative margins `marginTop: -10, marginEnd: -10`, `DayScreen.tsx:103`), Buy box containing a stepper and an address row (`BuyScreen.tsx:320-335`), hero frame inside the page which sits on the canvas with a second hero-like fill inside (MoodFill) plus a 20-radius photo inside a 28 frame.
17. Hand-set fold-critical overlaps: Beranda relies on the magic numbers 58, 16 and -74 (`MoodHeader.tsx:167`, `Plate.tsx:170`, `skeletons.tsx:43`) kept in sync by hand across header, body and skeleton.
