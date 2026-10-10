# Catera native apps, Phase F: loading, launch, settings, sheets, feedback, macros and import photos

**Date:** 2026-10-10, revised 2026-10-11 (artwork delivered) · **Branch:** `v2` (main tree `D:\Project\Catera\catera`, starting at `6fcbaa66`) · **Status:** canvas approved; awaiting written-spec review
**Scope:** `apps/customer`, `apps/caterer` (Catera Dapur), `packages/mobile-ui`, `packages/mobile-core`, `packages/design-tokens`, `packages/domain` (read only unless named), `packages/brand` (manifest records only), one database command. Web is out of scope.
**Inputs:** [research](../research/2026-10-10-native-phase-f-mobbin.md), [antislop audit 008](../../../anti-slop/audit-008-2026-10-10.md) (findings 1 to 17, proposals A to H, owner decisions), design canvas [Catera Phase F directions](https://claude.ai/artifact/H6rGFNL1QBBhtvRa8Q8k2R). The canvas is a reference, not a pixel contract; this spec wins where they differ.

## 1. Why

The owner's Phase F request (2026-10-10) names eight problems: generic loading, no settings page, a splash with a solid block, an unpolished cold start with spinners in sequence, missing package macros, file names instead of photo previews in the Dapur import, little playful but polished motion, and no clear action hierarchy (every action pushes a page). The code survey behind audit 008 confirmed all eight and found two more: the native mascot loader was deleted on 2026-10-07 (`d33069f0`), and Dapur's notification button forgets that it is on.

### What the owner decided (binding, 2026-10-10)
1. Fix all seventeen audit 008 findings.
2. **Motion rule (Decision A):** rows that the user's own action inserts or removes animate in and out, and their neighbours slide to make room. Loaded content appears as one block, cross-fading from its skeleton. "Never stagger a catalog, any list or any sequence" stays.
3. **Splash artwork (Decision B):** the fifteen transparent derivatives in `packages/brand/assets/` count as the transparent artwork the October 9 ruling waited for. The splash moves to the theme canvas with light and dark variants. The derivatives are described as segmented from the opaque generated masters, never as newly generated transparent masters.
4. **Dapur dial:** MOTION 2 (was 1). ENERGY 1 and RHYTHM 1 stay. The customer dials stay ENERGY 2 / RHYTHM 2 / MOTION 2.
5. **Artwork:** both routes. Motion pieces are drawn in code (`react-native-svg`, animated with Reanimated). Illustrated pieces get written briefs; the owner generates them elsewhere and the build swaps them in. Existing art stands in until then.
6. The canvas boards are approved as the direction ("the others you can proceed").
7. **Artwork delivered (2026-10-11):** `packages/brand/assets/phase-f/` holds 13 finished stills, 10 aligned rig layers with `rig.json`, a vector `confetti.json`, the untouched generator originals and full provenance (`generation-records.json`, `processing-records.json`, `manifest.json`). The root PNGs are processed transparent derivatives of the originals (dust removal, centring, margins, resampling, no upscaling), approved by the owner on 2026-10-11; they are never described as untouched masters. Mascot animations arrive as the brief's layered-rig alternative, not as Lottie.
8. **Skills (2026-10-11):** every plan, implementer, reviewer and design pass also invokes `design-taste-frontend` and `impeccable`, on top of `building-native-ui`, `antislop` (core, ui, layoutmobile), `apple-design` and `material-3`. `design-taste-frontend` declares native mobile out of its scope (its section 13), so its general rules apply (skeletons over spinners, motivated motion, contrast, copy self-audit, no em dashes) and its web-stack rules do not.

### Default taken in this spec (owner may override at review)
- **Decision C, splash verification:** the splash is configured and covered by config tests, but not seen on a device in this phase. Expo Go shows its own launch screen, and this machine cannot build a development client (no JDK or Android SDK). It is listed as unverified, like Phase E's predictive back. An EAS development build, if the owner supplies the mobile credentials, would close it.

### What stays fixed
Platform-native chrome (NativeTabs, native stack headers, native sheets; brand in the content), Plus Jakarta Sans everywhere the app draws text, the palette and mood tokens, Indonesian-first copy (customer "Anda", Dapur "kamu"), 48dp controls, the Three States, Truthful State, Price Unit and Demo Label rules, no invented numbers (R-17), opaque or derived artwork described truthfully, `nativeMotion` timings (control 120, selection 180, content 220, feature 320 ms, ease `(.16, 1, .3, 1)`), transform and opacity only, every motion instant or static under reduced motion.

## 2. Loading system (items 1 and 4; findings 1, 2, 16)

### 2.1 Three tiers
| Tier | When | Component |
| --- | --- | --- |
| Skeleton | The screen's shape is known | `Skeleton` blocks composed into one skeleton per screen |
| Mascot | Nothing can be shown yet, and the user should know what is happening | `MascotLoading` |
| Inline | The wait belongs to one control or object | the existing busy button (`StickyAction`, `Button`), a spinner over a photo tile, platform pull-to-refresh |

Rules (DESIGN.md "Loading"):
- No bare full-screen `ActivityIndicator` anywhere. No two loaders in sequence for one screen.
- Chrome renders at once: native header, tab bar, `MoodHeader` with its toggle or arc. Only the data area waits.
- Skeleton to content is one `FadeSwap` of the data area (`content` 220ms), never per row.
- Every loading state still has words for screen readers: the skeleton container is `accessibilityRole="progressbar"` with the label "Memuat {what}" ("Memuat paket", "Memuat jadwal"), so the Three States text promise holds for assistive technology.

### 2.2 `Skeleton` (packages/mobile-ui)
- `Skeleton({ width, height, radius })`: a block in the theme `sage` fill (light `#F0F3E9`, dark `#2A2D27`); on mood surfaces `SkeletonOnMood` uses `toggleTrack`.
- One shared opacity pulse, 1 to 0.55 to 1 over 1400ms, driven by a single shared value for the whole screen so blocks pulse together. Static at 0.75 under reduced motion. The pulse runs only while the skeleton is mounted (a wait, not decoration).
- Per-screen skeletons match the loaded layout's heights at 360dp and font scale 1.0: Beranda (hero card 10 + photo + three lines, other-meal row, two `Berikutnya` rows), Jelajah (three package rows), Jadwal (already holds its height; its "Memuat…" spinner inside the grid frame becomes skeleton cells), plan detail (hero and five rows), Paket saya, Akun lists, Alamat, Riwayat pembayaran, Bantuan, Hari, Pilih menu; Dapur Hari ini (count card numbers and checklist rows), Pelanggan (rows), Pelanggan detail, Menu week (day strip and dish rows), Usaha packages, Uang, Laporan.

### 2.3 `MascotLoading` (packages/mobile-ui)
- Restored from `apps/customer/src/mascot-loading.tsx` at `d33069f0^` and moved into `packages/mobile-ui` so both apps share it. Layers from `packages/brand/assets/mascot-motion/` (body, closed and half eye patches, sparkles; real alpha, 480px) and timings from `packages/brand/motion.ts` (2400ms loop, 4dp rise, 1.5° tilt, blink at 46 to 54%).
- Props: `label` (required), `size` (default 140), `startup` (system font before fonts load).
- Rules kept from docs/MASCOT-MOTION.md: the visible group appears after 300ms (accessible status at once); no minimum display time; reduced motion shows the static `neutral` pose with the label; paused when the app is backgrounded or the screen loses focus; unmount cancels everything. Navigation and data never wait for a loop.
- Uses: the launch gate (2.5), sign-in and OTP verification in progress, the Dapur import assistant reading files ("Membaca daftar pelanggan…"), Bayar while checking a payment ("Memeriksa pembayaran…"), the claim link while opening ("Membuka tautan…").

### 2.4 Pull to refresh
Platform `RefreshControl` (tint `forest`) on Beranda, Jadwal, Paket saya, Dapur Hari ini and Pelanggan. A refresh never replaces content with a skeleton.

## 3. Launch sequence (items 3 and 4; findings 3 to 6)

### 3.1 Order of events, both apps
1. Native splash shows (3.3). `SplashScreen.preventAutoHideAsync()` is called at module load of the root layout.
2. In parallel, local reads only: fonts, the stored theme (`runtime.storageKey("theme")`), the stored locale, the stored session, the cached first-screen read (customer `home:customer`, Dapur the Hari ini read). These are reads from the phone and must finish before the splash hides; a 1500ms ceiling hides the splash anyway so a slow disk never traps the user.
3. Splash hides (`SplashScreen.hideAsync()`, its default fade) onto a first frame that already has the right theme, fonts and, when cached, content.
4. Network refresh runs in the background (`me()`, then the first-screen read). The cached content shows a quiet caption "Memperbarui…" under the header; fresh data swaps in through `FadeSwap`. If the fresh read fails, the existing "Terakhir diperbarui HH.MM · tidak ada koneksi" line stays.
5. Without a cache (first launch, or after sign-out): the first screen renders its chrome with its skeleton. Only when there is no stored session at all does the launch gate wait on `me()`, showing `MascotLoading` "Menyiapkan Catera untuk Anda…" (which itself appears only after 300ms, so a fast answer shows nothing). The existing "Belum bisa terhubung" error with "Coba lagi" stays the failure state.
- The double `me()` at launch (an AppState "active" event and the English-locale refresh, `provider.tsx:159-168`) is collapsed into one request.
- Truth: cached content is the last confirmed read and is labelled as such until refreshed; nothing is shown that the cache does not hold.

### 3.2 Hand-off beat
On a cold start only (not on resume), after the splash hides, a `LaunchCover` with the same canvas and the same splash mark PNG at the same size and position sits above the first screen for one beat: the mark scales 1 to 1.04 and fades out over `feature` 320ms while three code-drawn sparkles (section 7.1) drift outward and fade, revealing the first screen underneath, which is already mounted. The delivery has no lid or eye parts registered to the splash mark, so the cover does not open the lid or wink; that stays out of scope rather than mixing two drawings. It never delays data or input (input passes through as soon as it starts fading). Skipped under reduced motion and when the cover's art is not decoded.

### 3.3 Splash configuration
- Both apps, `expo-splash-screen` plugin (the delivered marks replace the logo lockups chosen on the canvas; they are mark-only and drawn inside the Android 12+ circular safe zone, which the lockups were not):
  - Light: `backgroundColor` `#FDFAF3` (theme `canvas`), `image` `packages/brand/assets/phase-f/splash-mark-light.png`.
  - Dark: `dark.backgroundColor` `#151514`, `dark.image` `packages/brand/assets/phase-f/splash-mark-dark.png`.
  - `imageWidth` 200 on both platforms (the marks carry their own safe padding, so the visible mascot is about 120 wide); the first device check may tune it.
- Android adaptive icon: `foregroundImage` `phase-f/adaptive-foreground.png` on `backgroundColor` `#163D2E`, `monochromeImage` `phase-f/icon-monochrome.png`.
- iOS icon: `icon` stays `app-icon.png` for light; the iOS 18 dark and tinted appearances use `phase-f/icon-ios-dark.png` and `phase-f/icon-ios-tinted.png` through the app config's per-appearance iOS icon setting (config test only; unverified on a device).
- `packages/brand/manifest.brand.json` and DESIGN.md record which derivatives are used where, as derivatives.
- Verification: a config test asserts both app configs; a device check is a release item (Decision C default).

## 4. Pengaturan (item 2; findings 7, 8)

### 4.1 Routes and entry
- Customer: `apps/customer/app/(tabs)/(index,jadwal,jelajah,akun)/pengaturan.tsx`, pushed inside the Akun tab. Dapur: `apps/caterer/app/(tabs)/(index,pelanggan,menu,usaha)/pengaturan.tsx`, inside the Usaha tab.
- Entry: a trailing gear `HeaderIconButton` ("Pengaturan") in the tab root's header area on both platforms, and a "Pengaturan" row at the end of Akun and Usaha. Signed-out customers reach it from the signed-out Akun.
- Native title "Pengaturan" (`Screen nativeTitle`).

### 4.2 Content
Grouped rows (iOS: inset grouped sections on `surface` with 1dp `line`, radius 16; Android: Material list rows with section labels and dividers), each showing its current value:
1. **Notifikasi** section: one row "Notifikasi di ponsel ini" with a native `Switch` and the supporting line "Makanan berangkat, menu besok, pembayaran" (customer) or "Pesanan baru, laporan, pembayaran" (Dapur). Hidden while signed out.
2. **Aplikasi** section: "Bahasa" (value "Indonesia" or "English") and "Tampilan" (value "Sistem", "Terang" or "Gelap"; Android wording "Ikuti sistem"). Each opens a choice sheet (5.2): Bahasa with two options, Tampilan with the three preview thumbnails from the canvas. A choice applies at once and closes the sheet.
3. **Tentang** section: "Versi aplikasi" (the app config's version through `expo-constants`, selectable text; never a typed-in number) and "Syarat dan privasi" (opens the existing web terms page in the in-app browser).
4. **Keluar** last (danger ink). Hidden while signed out.

Akun and Usaha lose their inline Bahasa, Tampilan and notification controls.

### 4.3 Notification truth
- The switch reflects reality, read on focus: the phone's permission (`expo-notifications` `getPermissionsAsync`) and whether this device's token is registered (the SecureStore flag `push.<actorId>`, now used by both apps).
- On: request permission if needed, register (`device.register`, unchanged), set the flag. Permission denied by the system: the switch stays off and the row explains "Izinkan notifikasi di Pengaturan ponsel" with a button that opens the system settings (`Linking.openSettings`).
- Off: unregister this device's token (new `device.unregister`, 4.4), clear the flag.
- A failure leaves the switch at the true previous value and shows the error toast "Belum berhasil. Coba lagi."
- Dapur's `NotifyButton` and the customer Notifikasi screen's enable card are removed; the customer Notifikasi screen keeps its updates list.

### 4.4 Backend: `device.unregister`
A user command that deletes the calling user's own row for one token (`delete from v1.devices where token = $token and user_id = auth.uid()`), inside the command's transaction, idempotent (deleting nothing returns `{removed: 0}`), `UNAUTHORIZED` when signed out. Another user's token is never removed. The demo backend implements the same rule. Tests: unit, Postgres (own token removed, another user's token untouched, repeat is a no-op) and the existing concurrency suite.

## 5. Action hierarchy and native sheets (item 8; finding 11)

### 5.1 The ladder (DESIGN.md "Action hierarchy")
| Weight | Container |
| --- | --- |
| A task with its own context, or a target of a cold link | Pushed page |
| A short task with one to five controls, done in place | Native form sheet |
| Several secondary actions on one item | Action sheet (a short native sheet of icon rows, destructive last) |
| A confirmation before an irreversible or customer-visible action | Confirm sheet |
| A routine outcome | Toast (section 6) |

### 5.2 Native sheets
- Sheets are routes with `presentation: "formSheet"` from react-native-screens 4.26 (UISheetPresentationController on iOS; the Material bottom sheet behaviour on Android, both present in Expo Go). Options from one helper, `sheetOptions({ detents, palette })` in `packages/mobile-ui/src/nativeHeader.ts`: `sheetGrabberVisible: true`, `sheetAllowedDetents` (`"fitToContents"` for choice, action and confirm sheets; `[0.6, 1]` for forms that can grow), `sheetCornerRadius` 28 on Android (iOS uses its own), `contentStyle` `surface`, `headerShown: false` (the sheet draws its own title row with a leading 44pt Close on iOS; Android uses the drag handle and back).
- Layout inside a sheet: title (iOS 17 bold centred; Android 22 bold start-aligned, the M3 sheet title), optional context line, content, actions. Keyboard: the sheet's scroll view uses `automaticallyAdjustKeyboardInsets` on iOS; on Android the sheet expands to its top detent when a field focuses.
- Back closes a sheet on Android; swipe down closes on both. A sheet with unsent input asks first through a confirm sheet ("Buang laporan?") only when there is typed text.
- Cold links: a sheet route that a link can reach (Ada masalah `/masalah/{id}`) opens on a cold start over its parent page (Hari for that delivery), never alone.

### 5.3 What moves
| Today | Becomes | App |
| --- | --- | --- |
| `masalah/[id]` pushed page | Form sheet "Ada masalah" (canvas `FormSheet`) | customer |
| Alamat add and edit inline card | Form sheet "Alamat baru" / "Ubah alamat"; the Alamat list stays a page | customer |
| Bantuan "Minta bantuan" and "Minta Catera meninjau" inline forms | Form sheets | customer |
| Ubah hari (`ChangeDaySheet`, custom `Sheet`) | Form sheet | customer |
| Review form (`WaitingList`, custom `Sheet`) | Form sheet | customer |
| Beli address and start-date pickers (custom `Sheet`) | Form sheets inside the Beli modal's stack | customer |
| Jelajah area picker (custom `Sheet`) | Choice sheet | customer |
| ChooseMenu discard and clear `Alert.alert` | Confirm sheets | customer |
| No item actions | Action sheet from a "…" on each Hari row, the Beranda hero and the plan detail's upcoming rows: Pindah tanggal, Ganti alamat hari ini, Chat {katerer}, Laporkan masalah (canvas `ActionSheet`); each item shows only when allowed (cutoff, fixed plan, phone known) | customer |
| Tim page (one button that opens Share) | Form sheet with the invite code and "Bagikan undangan" | Dapur |
| Laporan reply page | Form sheet over the report list; the full report stays reachable as a page from notifications | Dapur |
| Stop exceptions (`ExceptionSheet`, custom `Sheet`) | Form sheet | Dapur |
| Import row editor (custom `Sheet`) | Form sheet inside the Impor modal's stack | Dapur |
| Mulai masak and Berangkat antar `Alert.alert` | Confirm sheets with the same copy (canvas `ConfirmSheet`) | Dapur |
| Package row in Usaha | Action sheet: Lihat paket, Salin jadi paket baru | Dapur |
| Bahasa, Tampilan | Choice sheets (4.2) | both |

Stays a page: plan detail, Hari, Pilih menu, package detail, Paket saya, Alamat list, Bantuan list, Dapur Menu day editor, Pelanggan detail, Uang, Aktifkan (bank form with a provider check), Impor (modal).

The custom `Sheet` component is deleted once its last caller moves.

## 6. Feedback (item 7; findings 12 to 15)

### 6.1 Toast
- `ToastProvider` at each app root and `useToast().show({ message, action?: { label, onPress }, tone?: "success" | "error" })` in `packages/mobile-ui`.
- iOS: a pill under the navigation bar (or under the mood header on tab roots), charcoal fill `#2E2E2E` with cream text in light theme and `#F5F1E8` fill with charcoal text in dark, radius 22, up to 44pt tall. Android: a Material snackbar above the navigation bar, radius 4, same colours, action in `tabIndicator` green on charcoal (light) or forest on light fill (dark). Contrast pairs join `tests/native-contrast.test.ts`.
- Enters with a 12dp slide and fade (`content` 220ms; iOS from above, Android from below), leaves with a fade (control 120). One at a time; a new toast replaces the old one. Auto-dismiss after 3s, or 5s when it has an action. Announced to screen readers (`AccessibilityInfo.announceForAccessibility`). Instant under reduced motion.
- Messages (exact copy): "Disimpan" + "Lihat" (save package), "Dihapus dari simpanan" + "Urungkan", "Alamat disimpan", "Alamat dihapus" (no undo: deleting an address already asks first), "Ulasan terkirim", "Laporan terkirim" + "Lihat", "Permintaan bantuan terkirim", "Hari dipindah ke {Senin 12 Okt}", "Menu {Selasa} tersimpan" (customer and Dapur), "Paket diterbitkan" (Dapur), "Undangan dibagikan" (Dapur), "Tampilan: {Gelap}", "Bahasa: {Indonesia}". Errors use the app's existing error text with tone `error`.

### 6.2 Success beat
- `SuccessBeat({ title, children })` plays the delivered success rig (`rig.json` `successRig`, layers stacked at one origin and never trimmed) over a code-drawn `#FFEFD9` disc (`SuccessRing`, 7.1) that grows from 0.35 to 1 over 420ms:
  - 0 to 120ms: the body squashes to 96% height about `bodyPivot`.
  - 120 to 420ms: the body hops about 6% of its height; the lid rotates open about `lidHinge`; the arms rise with the body.
  - 300 to 620ms: the badge pops about `badgePivot` (scale 0.6 to 1.07 to 1); its check is already drawn in the layer.
  - 420 to 700ms: the body lands (98%, then 100%).
  - 450 to 1050ms: `rig-sparkles.png` scales from 0.8 to 1 and fades out; five code-drawn sparkles burst outward.
  - From about 620ms the facts below fade up as one block (`content` 220ms).
  - One `success` haptic on the first frame. The beat ends on the rig's own resting frame (it does not swap to `mascot-merayakan.png`, which is a separately generated drawing, so nothing jumps).
  - Reduced motion: the static `mascot-merayakan.png` and the facts, no movement, the haptic kept.
- It plays once on the transition into success while the screen is open (ruling D8 kept: reopening an already paid checkout shows the final frame with no beat and no haptic).
- Uses: "Pembayaran diterima" (Bayar), a renewal paid (same screen), Dapur "Paket diterbitkan" (the first time a package is published: full beat; later saves: toast), Dapur import saved ("{n} pelanggan tersimpan", replacing the inline sage card).
- Confetti: the delivered vector `phase-f/confetti.json` (60fps, 1.2s, 24 pieces in palette colours, ends fully transparent) through `lottie-react-native` (installed with `npx expo install`; included in Expo Go), only on a customer's first-ever paid plan and a caterer's first published package. Not shown under reduced motion. The "first" fact comes from the read (a customer with no earlier paid plan; a caterer with no earlier published package), never from the device alone.

### 6.3 Heart
`SaveHeart` replaces the heart `RoundButton`: on save, the filled heart (sunrise ink) scales 1 to 1.22 to 1 on a spring and five small dots (sunrise ink and sunrise) burst out and fade within 380ms, `select` haptic, toast "Disimpan · Lihat". On unsave: the outline returns at once, no haptic, toast "Dihapus dari simpanan · Urungkan". The optimistic update and rollback of `useSaved` stay. Static swap under reduced motion.

### 6.4 Insert and remove motion
- Reanimated layout animations built from tokens in `packages/mobile-ui/src/motion/layout.ts`: `enterRow` (fade in plus 8dp rise, `content` 220ms, the Catera ease), `exitRow` (fade out, `control` 120ms), `moveRows` (`LinearTransition` with `content` 220ms). All return `undefined` under reduced motion.
- Applied only where the user's own action changes a list: Alamat add and delete, Disimpan remove, the import assistant's rows (a saved row leaves), Dapur Menu dish slots (add, remove), Beranda "Menunggu Anda" (a row leaves after its action), Dapur Pelanggan after an import (new customers enter when the list refreshes while the screen is open, as an insertion the user caused).
- Never on a first load, a refresh, a search or filter change, a tab return or a mood switch (Decision A).

## 7. Artwork (owner decision 5)

### 7.1 Code-drawn (built in this phase, `packages/mobile-ui/src/brand/`)
| Piece | Use | Notes |
| --- | --- | --- |
| `SuccessRing` | Success beat | A `#FFEFD9` disc with a 3dp sunrise-ink ring behind the success rig; grows by transform only (the check lives in the delivered badge layer) |
| `Sparkle` (four-point star and dot) | Beat burst, launch hand-off, heart burst | Sunrise ink, sunrise, forest only |

These are interface objects, recorded in DESIGN.md as code-drawn like the day arc and rantang, not as generated artwork.

### 7.2 Delivered artwork (2026-10-11) and where it goes
Briefs: [docs/brand/phase-f-artwork-briefs.md](../../brand/phase-f-artwork-briefs.md). Delivery and provenance: `packages/brand/assets/phase-f/README.md`.

| File | Used for |
| --- | --- |
| `splash-mark-light.png`, `splash-mark-dark.png` | Native splash and `LaunchCover` (3.2, 3.3) |
| `adaptive-foreground.png`, `icon-monochrome.png`, `icon-ios-dark.png`, `icon-ios-tinted.png` | App icons (3.3) |
| Success rig (`rig-body`, `rig-lid`, `rig-badge`, `rig-arms-up`, `rig-eyes-open`, `rig-eyes-closed`, `rig-sparkles`) | `SuccessBeat` (6.2) |
| `mascot-merayakan.png` | `SuccessBeat` under reduced motion; Dapur "Semua beres hari ini" |
| Reading rig (`rig-reading-body`, `rig-reading-eyes`, `rig-reading-magnifier`) and `mascot-membaca.png` (reduced motion) | `MascotReading` in the import assistant (9): magnifier rotates ±4° about its grip, eyes follow, a code-drawn sunrise highlight on the paper line, a blink per eye about its own centre, per `rig.json` `readingRig` |
| `mascot-tidur.png` | Empty states with nothing scheduled: Beranda with no delivery today and nothing next, Jadwal month with no meals, Dapur Hari ini with no session, Notifikasi with no updates |
| `mascot-bingung.png` | Offline and failed reads: "Belum bisa terhubung", "Belum bisa memuat" states with "Coba lagi" |
| `mascot-melambai.png` | Sign-in, the claim link preview, `EmptyHome` ("Mau makan apa minggu ini?") |
| `mascot-mencari.png` | Jelajah with no results for a filter or search, an empty Disimpan |
| `mascot-memasak.png` | Dapur after "Mulai masak" while the session is cooking (the count card's side illustration) |
| `confetti.json` | First-milestone confetti (6.2) |

Rules for every use:
- **One optical size.** The stills carry different amounts of empty space (the P1 poses sit smaller in their canvas than the P2 poses). `packages/brand/phaseF.ts` records each still's visible box (measured from alpha by a script, never typed by hand), and a shared `MascotArt({ pose, size })` in `packages/mobile-ui` crops the transparent padding so every pose renders at the same visible height for a given `size`. Rig layers are never trimmed (they must stay registered).
- **Runtime copies.** The 1254px files are too heavy to bundle (about 12 MB in total). A script in `packages/brand` (`build-phase-f-runtime.mjs`) writes runtime copies into `packages/brand/assets/phase-f/runtime/` (splash and icon files untouched), with hashes in `processing-records.json`; downscaling only, never upscaling, recorded as derivatives. Each copy holds enough pixels for its largest spec size on a 3x screen (amended 2026-10-11, controller ruling on the Task 3 review, replacing "stills 600px, rig layers 600px", which upscaled `merayakan` at 180pt by 1.86x): (a) stills are trimmed to their visible box plus a 3% transparent margin and downscaled so the visible height is min(source visible height, 540px) (540 = 180pt × 3), never enlarged; the records carry `trimmed: true` and the crop rect, and `phaseF.ts` records each still's box in its trimmed file beside the source-measured `visibleBox`, so `MascotArt` keeps its frame contract (visible height = `size`, width follows); (b) success rig layers stay full canvas, untrimmed and registered, downscaled to 800px; (c) reading rig layers stay full canvas at 600px, and their crisp ceiling at 3x (about 144pt) is recorded in `phaseF.ts` `crispMaxSize`. The apps import only `runtime/`.
- **Size and placement.** Empty and error states: 120pt `MascotArt` above the title, centred, never beside a photo of food. Success: 180pt. Nothing else in the app uses mascot art (DESIGN.md: food photography leads; the mascot is occasional warmth).
- **Dark theme.** Every still was reviewed on `#151514` and `#163D2E` by the delivery's QA; the app shows the same files in both themes.
- Mascot art is decorative for screen readers (`accessible={false}`); the state's text carries the meaning.

## 8. Macros (item 5; finding 9)

Nothing was deleted from the data: `v1.packages.offer->'nutrition'` (`caloriesKcal`, `proteinG`, `carbsG`, `fatG`, each a number or a `{min, max}` range) is in the schema, the API and `packages/domain` (`packageNutrition`, `nutritionSummary`, `nutritionMetrics`, `nutritionSchema`). The native apps stopped showing and writing it.

- **Customer package detail:** a "Gizi per porsi" section after the package contents: the filled metrics as tiles (iOS two by two; Android four in a row, wrapping at large text), values tabular, ranges as "580–640", the units "kkal" and "g", and the caption "Perkiraan dari katering. Bisa berbeda tiap menu." A metric the caterer left empty is not shown; zero is a value and is shown as "0 g" (PRODUCT.md, Package contents); with none filled, no section. Under the package name, "{kalori} kkal · {protein} g protein per porsi" when both exist (canvas `Gizi`).
- **Jelajah rows:** "± {kalori} kkal" after the price line when present.
- **Dapur package editor:** an optional "Gizi per porsi (opsional)" section with a "Pakai rentang" switch, Kalori (kkal) as one field or two ("sampai"), Protein, Karbo and Lemak (g) (canvas `GiziEditor`); numeric keyboards; validated by `nutritionSchema` (whole numbers, min not above max); "Isi kalau kamu tahu. Pelanggan melihatnya sebagai perkiraan per porsi; kolom kosong tidak ditampilkan." `quickOffer` sends the values; "Salin jadi paket baru" carries them; the Dapur package view shows them.
- **Data:** the demo seed already fills all six demo packages. The hosted catalogue was cleaned with `nutrition: null` on 2026-09-16; Catera never estimates macros, so hosted packages show none until a caterer enters them (web or Dapur). A read-only check of the hosted data is a release note, not a task.

## 9. Import photo previews (item 6; finding 10)

- Keep the picked `uri` (`Attachment` gains `uri`; `shrinkPhoto` returns it).
- "Lampiran · {n} dari 6" label, then a wrapping row of 76dp thumbnails (`expo-image`, radius 12, `sage` ground while decoding, cover fit) with a 28dp remove badge on a 48dp touch target ("Hapus foto {i}"), each labelled "Foto {i} dari {n}" for screen readers; tapping a thumbnail opens it full screen (a `fullScreenModal` route with pinch-free fit, Close). An "+ Foto" dashed tile ends the row while under six.
- PDF and spreadsheets: a row with a document icon, the file name and remove (canvas `ImportPhotos`).
- While the assistant reads: `MascotReading` (7.2) with "Membaca daftar pelanggan…" and "{n} foto dan {m} file" under it, in place of the button.
- A new thumbnail enters with `enterRow`; a removed one leaves with `exitRow`.

## 10. Dials and motion rules (DESIGN.md changes)
- Dapur MOTION 2 (owner decision 4).
- Loops are allowed only while waiting: the mascot loop and the skeleton pulse. Nothing else loops.
- "No entrance animation and no stagger for the calendar, lists or catalogues" is restated as: loaded content enters as one block from its skeleton; rows the user inserts or removes animate (Decision A).
- The success beat, toast, heart and launch hand-off join "Native motion" with their timings.

## 11. Build preconditions (finding 17)
Before any motion task: align `react-native-worklets` with what `react-native-reanimated` and Expo SDK 57 expect (`npx expo install --check` in both apps), and make `@catera/caterer` resolve the same Reanimated as the customer app (workspace link or a declared version matching Expo Go). Both app Jest suites and an Expo Go launch on the emulator prove it.

## 12. Verification
- Every task: `npm run typecheck`, `npm test`, `npm run build`, both app Jest suites; the backend task adds `npm run test:postgres`.
- New tests by area: config (splash and adaptive icon in both app configs), launch (splash held until local reads, cached first paint, one `me()`), skeleton per screen (no `ActivityIndicator` full screen: a guard test scanning app sources for full-screen `ActivityIndicator`), mascot (reveal delay, reduced motion poster), Pengaturan (switch reflects permission and flag; off unregisters; denied path), sheets (routes declare `formSheet` and detents; cold link opens over its parent), toast (one at a time, announce, durations, reduced motion), beat (once on transition, not on reopen), heart (haptic on save only), layout animations (undefined under reduced motion), macros (tiles hidden when empty, ranges, editor validation, copy carries values), import thumbnails (uri kept, labels).
- `tests/native-contrast.test.ts` gains the toast pairs and any new mood-surface pair.
- Android emulator gate (Expo Go, demo backend), incremental per task where it shows, and a final pass: cold start (before and after recordings), Beranda, Jelajah, Pengaturan, every new sheet, the success beat, heart and toast, list motion, gizi, import; light and dark; Siang and Malam where relevant; 360dp at font scale 1.3; reduced motion (`animator_duration_scale 0` and "Remove animations"); TalkBack on the switch, sheets, toast and thumbnails.
- Not verified on a device: anything on iOS (no Mac), the native splash on either platform (Decision C default), and the Android 12 splash mask.

## 13. Out of scope
Web; new raster artwork made in this phase (the delivered set is the artwork); lid or wink motion on the launch cover; predictive back; a sliding Android tab bar; personal nutrition targets, rings or percentages; editing an existing published package in Dapur (Dapur still only creates and copies); push content changes.

## 14. Risks
- **Form sheets in Expo Go on Android.** react-native-screens 4.26 ships the Android form sheet, but keyboard handling and `fitToContents` with dynamic content are newer than the stack. Mitigation: the first sheet task (Ada masalah) is the spike; if a check fails on the emulator, the task stops and reports before the rest move.
- **Cache-first truth.** A stale cached Beranda could show a meal that has since moved. Mitigation: the "Memperbarui…" caption until the refresh lands, and the existing offline line when it fails.
- **Splash unseen.** Configured blind (Decision C). Mitigation: config tests now, a device check before release.
- **Reanimated drift.** Layout animations depend on finding 17 being fixed first.
- **Scope.** Twelve tasks across two apps. Mitigation: dependency-ordered tasks, three at a time, each merged when its own review is clean.

## 15. Tasks (for the plan)
| Task | Covers | Depends on | Builder |
| --- | --- | --- | --- |
| F0 Install drift | 11 | none | sonnet |
| F1 Primitives: `Skeleton`, `MascotLoading`, `ToastProvider`, layout motion tokens, `sheetOptions` | 2.2, 2.3, 5.2, 6.1, 6.4 | F0 | opus |
| F2 Launch sequence and splash config, both apps | 3 | F1 | opus |
| F3 Customer loading pass | 2 | F1 | opus |
| F4 Dapur loading pass | 2 | F1 | opus |
| F5 `device.unregister` (database, demo backend, tests) | 4.4 | none | sonnet |
| F6 Pengaturan, both apps | 4 | F1, F5 | opus |
| F7 Customer sheets and action sheets | 5 (customer rows) | F1 | opus |
| F8 Dapur sheets and confirm sheets | 5 (Dapur rows) | F7 (helpers proven) | opus |
| F9 Feedback: `SuccessRing`, `Sparkle`, `SuccessBeat` on the success rig, confetti, `SaveHeart`, toasts wired, insert/remove motion | 6, 7.1 | F1, F12 | opus |
| F10 Macros: customer display, Dapur editor | 8 | none | opus |
| F11 Import previews and `MascotReading` | 9 | F1, F12 | opus |
| F12 Artwork integration: commit the delivery, runtime copies, `phaseF.ts` visible boxes, `MascotArt`, `MascotReading`, the success rig, empty and error states with their poses | 7.2 | F1 | opus (script: sonnet) |
| F13 Gate: emulator, DESIGN.md (one opus dispatch), MASCOT-MOTION.md, audit 008 follow-up, next-phase kickoff | all | all | opus |
