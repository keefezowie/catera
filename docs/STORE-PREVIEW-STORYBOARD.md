# Store preview storyboard (draft)

Draft, October 21, 2026. One 28-second app preview for the customer app on the App Store and Google Play, Indonesian first with an English cut. Not approved; no store release exists yet (see [PRODUCT.md](../PRODUCT.md#implementation-and-release-truth)).

## What it has to show

One purchase, start to finish, in the order a new customer meets it: find food, understand the package, buy fixed portions for a delivery schedule, pay, then see the meals arrive on the calendar and on Beranda. Every frame is a real screen of the customer app. Captions state facts; no slogans (DESIGN.md, task names and factual product explanations).

## Shots

Times are for the 28-second cut. Captions are the on-screen text overlay, at most about 30 characters, set in the app's typeface on a plain band above or below the phone frame so they never cover interface text.

| # | Time | Screen | Action on screen | Caption (ID / EN) |
| --- | --- | --- | --- | --- |
| 1 | 0.0–3.5 | Jelajah (swipe feed) | Area already set. One deliberate vertical swipe to the next photo-led package card. | Katering harian di dekat Anda / Daily catering near you |
| 2 | 3.5–6.5 | Jelajah → Paket | Tap the heart (Saved), then tap the card; Paket opens with its package facts and menu days. | Lihat menu dan jadwalnya / See the menu and schedule |
| 3 | 6.5–11.5 | Beli | Increase portions per day once; the start date and delivery address are already filled; the breakdown shows delivery included and the service fee itemized. | Pilih porsi dan tanggal mulai / Choose portions and start date |
| 4 | 11.5–15.5 | Bayar (QRIS) | The QRIS code appears, then the paid state: "Jadwal antar Anda sudah tersimpan." | Bayar dengan QRIS atau VA / Pay with QRIS or VA |
| 5 | 15.5–20.0 | Jadwal | Month grid with the new delivery days marked; tap one day to show its lunch and dinner rows. | Semua jadwal antar di satu kalender / Every delivery on one calendar |
| 6 | 20.0–24.5 | Beranda | Today's plate in the hero; the day arc switches Siang to Malam. | Lihat makanan hari ini / See today's meal |
| 7 | 24.5–28.0 | Menu besok story | The story opens (fade and scale, 320 ms) with the sticker "Makan siang · 11.00–13.00"; hold to the end. | Menu besok sudah siap / Tomorrow's menu is ready |

No logo end card: Apple wants preview footage captured from the app, and shot 7 already ends on a branded screen. Play can take a 2-second end card with the app icon if wanted.

Shot 7 depends on there being a "menu besok" for the demo customer; if the fixture can't show it reliably, end on shot 6 and stretch shots 3 and 5 instead.

## Capture rules

- **No demo chrome.** Bayar shows "Bayar (demo)" and Masuk shows "Masuk sebagai pelanggan demo" in demo and development builds. Record a release build against the hosted sandbox with demo mode off, and pay shot 4 with DOKU sandbox QRIS.
- **Synthetic data only.** Use the seeded caterers and customer (for example Dapur Senja in `packages/backend/src/seed.ts`); no real names, phone numbers or addresses. The address on Beli must be a made-up one.
- **Photos.** The sample catalog uses Wikimedia Commons photographs under CC BY and CC BY-SA ([credits](CLEAN-CATALOG-IMAGE-CREDITS.md)); those licences need visible attribution and are not suitable for store marketing. Before capture, swap the packages that appear in shots 1–3 to Catera's own regenerated food artwork, or to caterer photos used with written permission.
- **Clean status bar.** Android: `adb shell settings put global sysui_demo_allowed 1`, then the demo-mode broadcasts for a fixed 09.41 time, full battery and signal. iOS Simulator: `xcrun simctl status_bar booted override`.
- **Settings.** Light theme, Indonesian, default text size, reduced motion off, so the arc, the story opening and the photo fades play as specified in DESIGN.md.
- **Touches.** Show touches on Android (developer options) for the raw take, and replace them with a soft dot in the edit so taps read without the system's crosshair.

## Formats

Check these against the current App Store Connect and Play Console help before export.

- **App Store:** 15–30 seconds, portrait, 30 fps, up to three previews per locale. Export at the size App Store Connect asks for the largest iPhone (886 × 1920 for 6.9"). The first frame doubles as the poster frame, so shot 1 opens on a full, sharp photo card.
- **Google Play:** a YouTube link, played in the listing's landscape slot. Make a 16:9 version with the portrait phone centred on the cream (`cream` token) ground and the captions to the side; keep YouTube ads off for the video.
- **Audio:** optional. Previews autoplay muted, so the captions carry the meaning. If music is added, it must be licensed for app marketing.

## How to make it

The Remotion project is set up in [apps/store-preview](../apps/store-preview/README.md) with all seven shots, the captions and both formats; it shows placeholders until the takes are recorded.

1. Record each shot as its own raw take on the emulator and simulator (screen recordings, 60 fps, so the edit can drop to 30 cleanly).
2. Assemble in Remotion: the takes as `<OffthreadVideo>` clips, the phone frame and caption bands in React using `@catera/design-tokens` colours and the app typeface, and cuts timed with the `nativeMotion` content duration (220 ms) so the edit feels like the app. One composition per locale and per aspect ratio, with captions from one table so the Indonesian and English cuts stay in step.
3. Render, then check each export against the store's limits before uploading.

## Open decisions

- Which packages and caterer appear in shots 1–3, and whose photos.
- Whether to add a second preview later for Catera Dapur (its own store listing) or keep the caterer walkthrough in help material only.
- Whether the English cut is needed at launch or Indonesian only.
