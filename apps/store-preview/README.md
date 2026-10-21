# Store preview

The customer app's App Store and Google Play preview video, built with Remotion 4.0.533 from [the storyboard](../../docs/STORE-PREVIEW-STORYBOARD.md). It is marketing tooling, not part of the product: nothing here ships in an app.

Four compositions share one timeline (`src/StorePreview.tsx`, seven shots, 840 frames at 30 fps = 28 s) and one caption table (`src/captions.ts`):

| Composition | Size | Use |
| --- | --- | --- |
| `AppStoreID`, `AppStoreEN` | 886 × 1920 | App Store app preview, portrait |
| `GooglePlayID`, `GooglePlayEN` | 1920 × 1080 | Google Play, uploaded to YouTube |

## Use

Put the raw recordings in `public/takes` (names in [its README](public/takes/README.md)). A missing take shows a "Rekaman belum ada" placeholder, so the timing can be reviewed before recording.

```sh
npm run studio -w @catera/store-preview
npm run render -w @catera/store-preview -- AppStoreID out/app-store-id.mp4
```

Each script first copies Plus Jakarta Sans and its OFL licence from `packages/brand` into `public/fonts` (ignored by Git). Takes and renders also stay out of Git.

Remotion has its own licence: it is free for individuals and companies with up to three people, and larger companies need a company licence (see remotion.dev/license).
