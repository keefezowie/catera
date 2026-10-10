# Native Phase F research (Mobbin), 2026-10-10

Scope: input for Phase F of both native apps (customer and Catera Dapur): loading and skeleton states, the launch sequence and splash, success feedback after important actions, a dedicated settings page, bottom sheets and action hierarchy, save/favourite micro-interactions, list insertion, photo previews in forms, and package nutrition (macros).

Method: Mobbin MCP (`search_screens`, `search_flows`), iOS catalogue, 17 queries, about 130 screens viewed as images. Every link below goes to the Mobbin screen or flow that was viewed.

Coverage limits, stated plainly:
- **Mobbin is iOS only.** Android references are Material 3 itself (`material-3` skill), not Mobbin.
- **Screenshots are stills.** Motion (durations, springs, what moves) is inferred from the frames of a flow, never seen. Where a claim is about motion, it says so.
- **The owner's four direct screen links** ([45a4381f](https://mobbin.com/screens/45a4381f-46bf-4338-a90f-e06bc429f49c) animated splash, [be637714](https://mobbin.com/screens/be637714-faf3-4b75-8aba-ab1283bfe5cc) bookmark, [94cdf6cd](https://mobbin.com/screens/94cdf6cd-939e-4a80-80b0-c708b098130d) element insertion) could not be opened: the MCP has no lookup by screen id, and the in-app browser gets Mobbin's 403 without a session. They are cited as the owner gave them and are **not viewed**. The owner's app-level references (Family, Luma, Orb Social) were searched by app name and are covered below.

This document is input for design. It does not change PRODUCT.md or DESIGN.md.

---

## 1. Loading: skeletons for content, mascot for waits, never a bare centred spinner

### References

| App | Screen | What it does | Why it works |
|---|---|---|---|
| Bolt Food | [Home loading](https://mobbin.com/screens/42dd3ffa-f23c-4dfb-91ac-c4e20d6ed7e7) | Search bar and filter chips are live; the restaurant list below is grey blocks in the exact layout of a loaded row. The only spinner is a small ring inside the search field. | Chrome never waits for data. The skeleton promises the shape that will arrive, so nothing jumps. |
| Keeta | [List loading](https://mobbin.com/screens/ae4f6ed1-bed0-415a-a2c5-fcd6c5a16527) | Header, promo strip and chips render; rows are thumbnail plus two text bars, with a soft diagonal sheen. | Skeleton rows match row height one to one. |
| Careem | [Grocery home](https://mobbin.com/screens/cb8a09dc-20a3-49f2-8376-87aef45fb2bf), [cold home](https://mobbin.com/screens/9efed28e-6a50-40b8-a8a6-e504c351c151) | The whole page is a skeleton of its real sections (search, chips, hero, two-column grid). In the warm case the header (ETA, address) is already live. | One skeleton for the whole screen, not one spinner per section. |
| Grab | [Skeleton](https://mobbin.com/screens/7c2679a0-c95a-453d-8a53-f3cdd9ea649f) | Card, circles and labels as light shapes, back button live. | Circles where the real content has circles. |
| foodpanda | [Feed](https://mobbin.com/screens/409b432e-cba2-4c1f-8b09-0d808a2f40a1), [search results](https://mobbin.com/screens/77e6b9fe-fcb3-42b1-b52a-e9049a874635) | Large photo-card skeletons under live chips; search tabs live above a skeleton grid. | Photo-led content gets photo-sized placeholders. |
| Duolingo / Duolingo ABC | [Signing you in](https://mobbin.com/screens/64022801-da79-408d-8ece-b304ea866aa7), [Loading](https://mobbin.com/screens/73fa94d6-0854-492b-b08f-aa50147ef677) | The mascot, animated, centred on the plain canvas, with one short caption ("SIGNING YOU IN…"). | Used only where nothing can be shown yet (sign-in, first boot). The caption says what is happening. |
| Mimo, Speak, Jomo, Finch | [Mimo](https://mobbin.com/screens/96ca0f90-5f58-4b0b-adcd-0f7836b063af), [Speak](https://mobbin.com/screens/9366c893-4599-44a9-95eb-bf352bd740f3), [Jomo](https://mobbin.com/screens/3ee61966-20b9-4fa6-94bb-2a59105f3e2d), [Finch](https://mobbin.com/screens/8e0728a9-f287-4b74-a742-46ff1b05df16) | Mascot plus a task-specific line: "Calculating your progress…", "Generating your curriculum…", "Just a moment, Alex · We are preparing Jomo for you." Finch adds a real progress bar. | The mascot covers a wait the user started (generate, calculate, prepare), and the copy names that wait. |
| Trust Wallet | [Processing sheet](https://mobbin.com/flows/3d09793e-60c8-4cdb-b70a-4bfe883f6b74) | After "Confirm send", a sheet over the wallet shows an illustration, "Processing…" and what is happening. | A long wait the user triggered gets a sheet, not a full-screen block. |
| Tinder, Bumble | [Tinder media](https://mobbin.com/screens/44e28fc0-84f2-41ed-9222-28d32089d063), [Bumble upload](https://mobbin.com/screens/24f3346d-24c7-4993-93fa-513aa79ffeef) | Upload progress lives on the thing uploading: a small spinner over each photo tile, a top banner "Uploading photo 2/2" with a bar. | Inline progress on the object, not a page spinner. |

### What Catera should take

A three-tier loading vocabulary, one per situation:

1. **Skeleton** for any screen or section whose shape is known (Beranda hero and sections, Jelajah rows, Jadwal grid, plan detail, Dapur Hari ini, Pelanggan, Menu week). Chrome (native header, tab bar, mood header, toggles) renders at once; only the data area is a skeleton of the loaded layout, same heights. A slow opacity pulse, transform/opacity only, still under reduced motion.
2. **Mascot** for waits with nothing to show yet and that the user should understand: the cold-start gate if data truly blocks, sign-in, the Dapur import assistant reading files, a payment being confirmed. Always with a task line ("Membaca daftar pelanggan…", "Memeriksa pembayaran…"). The mascot already exists (`MascotLoading`, docs/MASCOT-MOTION.md) with the 300ms delay and no minimum display time; keep both rules.
3. **Inline** progress on the control or object: a button's own busy state, a spinner over a photo tile while it uploads, the platform's pull-to-refresh.

Never: a bare centred `ActivityIndicator` for a whole screen, or two loaders in sequence for one screen.

### Anti-patterns
- A centred spinner followed by a second spinner for the same screen (the owner's cold-start report, item 4).
- Skeletons that do not match the loaded layout, so the page jumps anyway.
- A mascot on every small wait. Duolingo keeps it for sign-in and boot; feed content uses placeholders.

---

## 2. Launch: the splash is the app's own canvas with a small mark

### References

| App | Screen / flow | What it does | Why it works |
|---|---|---|---|
| Linktree, Tesla Robotaxi, Blinkist, Mercury | [Linktree](https://mobbin.com/screens/a2c43381-d250-4de1-827b-c8085ccef586), [Tesla](https://mobbin.com/screens/fe03e9db-8a04-4fc6-bdf3-b2da06b9be7d), [Blinkist](https://mobbin.com/screens/577fe9aa-dee8-43d2-a1b2-80b22da85ad7), [Mercury](https://mobbin.com/screens/9f92f9a9-1022-4c1b-b590-f01e1697aeb2) | A small mark (about 15 to 20% of the width) centred on the same background the app's first screen uses. No box, no tile, no matte around it. | The splash and the first screen share a background, so the hand-off is invisible. |
| Lyft, Oportun, Superpower | [Lyft](https://mobbin.com/screens/9c43fef1-c1f0-4f29-b79e-850542e070d8), [Oportun](https://mobbin.com/screens/ecbf0805-14a3-4e78-94a8-a6937748cbea), [Superpower](https://mobbin.com/screens/5630d197-2df4-4d1e-9f03-94eadb03b25b) | The wordmark alone, centred on white. | A wordmark works as the mark when it has a real transparent background. |
| pliability, Obsidian, Comet | [pliability](https://mobbin.com/screens/94f879dd-ca25-44d4-be33-9a131f797658), [Obsidian](https://mobbin.com/screens/938bc898-8224-44e5-a1ef-cd7491401500), [Comet](https://mobbin.com/screens/ef1aba25-dda8-4a02-a895-ac1af7abbc5b) | A dark splash for a dark app, mark in light ink. | Dark apps keep a dark launch; the splash follows the app, not a fixed colour. |
| Pinterest | [Splash (logged in) flow](https://mobbin.com/flows/90bba5c8-df1c-4d15-9edb-78911c7df563) | Logo centred on white; small coloured shapes burst around it (frame 1), then the home feed. | An in-app animated beat after the static native splash: short, around the same mark, then out of the way. |
| Shopee | [Onboarding flow](https://mobbin.com/flows/aea8c626-252a-4834-8897-7c9c5dde2626) | Bag logo plus wordmark on white, then the home. | The Indonesian reference: a clean white launch, not a full orange slab. |
| Arc Search, Tubi | [Arc flow](https://mobbin.com/flows/b301625d-6a9f-4edc-9658-384217f1f8e7), [Tubi flow](https://mobbin.com/flows/dcfaec99-5aea-4091-894b-6656a8ab9f66) | Full brand-colour splash (Arc's logo slides in from the edge). | Works only because the logo artwork is transparent and designed for that colour. |
| The Atlantic | [Onboarding flow](https://mobbin.com/flows/50d73ca1-76ea-4342-877a-5bdb10c06fed) | The logo sits on a visibly lighter rectangle on the white splash. | The anti-pattern: an opaque artwork tile on a different background reads as a box. |

### What Catera should take
- The launch frame is the **theme canvas** (light `canvas`, dark `canvas`), not a brand-colour slab, with a **small mark** in the centre. A solid-colour square tile around the mark is what reads as "a box".
- This needs a mark with **real alpha**. The brand manifest records all sixteen generated PNGs as opaque. The mascot motion layers are real alpha (docs/MASCOT-MOTION.md). A code-drawn vector mark (the rantang, already drawn in `packages/mobile-ui/src/brand/`) exported as a transparent PNG is another honest source. Which source is a decision for the owner (see audit 007).
- **Optional animated beat** (Pinterest): after the native splash hides, the same mark on the same canvas plays one short move (the rantang lid lifts, or the mascot's existing loop once) and hands over to the first screen. It must never delay data or navigation, and it is instant under reduced motion.
- **Expo Go limit:** Expo Go shows its own launch screen; `expo-splash-screen` config only applies to development and store builds. A splash change can be checked only in a development build, which this machine cannot produce (no JDK or Android SDK, docs/PREDICTIVE-BACK.md).

---

## 3. Success feedback after important actions

### References

| App | Screen / flow | What it does | Why it works |
|---|---|---|---|
| GoPay | [Payment success](https://mobbin.com/screens/fbf2e063-0b29-40af-874c-2b39e93c2800), [Budget created](https://mobbin.com/screens/73f52869-3b1a-4400-a042-4e520d2b749b), [Split bill created](https://mobbin.com/screens/ed2e5b96-1e77-4355-87b0-12c62997be41) | Full-bleed brand fill; a large green check inside a segmented ring, short rays around it (frames show the ring growing out to the screen edge); the title names the outcome ("Budget created"); the next fact below ("We've sent the money request…"). | The Indonesian benchmark the owner named. The animation is one beat around one symbol, and the words say what changed. |
| GoPay | [Claiming a voucher flow](https://mobbin.com/flows/235cd905-f61b-4ece-a48d-3d093f32ac7e) | Confetti falls over the list and a top pill reads "Yay, vouchers are claimed!"; the list stays usable. | For a smaller win, a light overlay plus a toast, not a new screen. |
| GoPay | [Payment failed](https://mobbin.com/flows/b7a94a45-06c6-48bc-9717-bc3221c03391) | Same layout as success with a red cross; a bottom sheet says "Don't worry, your GoPay is not deducted" with Go back and Help. | Failure gets the same weight and a reassurance about money. |
| Gojek | [Purchase confirmed](https://mobbin.com/screens/bd93b6a5-772d-4295-8e6a-7cb9b6961332), [Thank you](https://mobbin.com/screens/7e686f36-aeb8-416e-987f-322f78b762d2), [Delivered](https://mobbin.com/screens/915c004b-1c16-46da-af8b-e2da8d2b5c39) | An illustration fills the top half; a sheet below says "Purchase confirmed · The store will prepare your groceries shortly" and then the order details. | Success is the first state of the order page, not a dead-end screen. |
| Grab | [Reward](https://mobbin.com/screens/9174df43-a3fd-4587-9f11-348d9e3609f9) | Gift illustration with ribbons of confetti. | Confetti is kept for gifts and rewards. |
| Keeta | [Payment successful sheet](https://mobbin.com/screens/b342f6ce-0a2c-43a3-ad08-a5b569e62c3d) | A sheet over the checkout: check in a brand circle, "Payment successful", amount, card, "Got it". | Success over the context it finished, one dismiss. |
| Shopee | [ShopeePay success](https://mobbin.com/screens/852d7e42-02a0-4c2e-8b33-e2f7420df2dd) | Mascot artwork across the top, a green check overlapping it, amount and time, then reference details. | Mascot plus check: brand warmth without hiding the facts. |
| Ladder | [Payment success](https://mobbin.com/screens/6d6e7bea-123b-458e-bf58-df53394f15a3) | Confetti over a glowing check, "IT'S OFFICIAL". | The loud end of the range; fine for a one-time milestone. |
| PayPal, Zopa, Tabby, Vivid, Jobber | [PayPal](https://mobbin.com/screens/31c6d5c7-1325-4e44-b246-8c917eb5bb81), [Zopa](https://mobbin.com/screens/d3511e0e-88ea-46d9-9cf8e9ba2435), [Tabby](https://mobbin.com/screens/3bff7a0f-e682-470f-ad03-cf879a14e549), [Vivid](https://mobbin.com/screens/1ffa3288-945d-434a-b57b-5f58bedb312d), [Jobber](https://mobbin.com/screens/ffc24d22-55cf-4e32-afa6-39c76c713375) | Check in a circle, the outcome in plain words, what happens next, one primary action. | The quiet end of the range. |
| Fuse | [Sending a coin flow](https://mobbin.com/flows/e72d4f05-97cd-476a-9c85-6a1800f93f94) | After "Send", the app returns home and a small "✓ Sent" pill sits at the top. | For routine actions, confirmation in place. |
| Orb Social | [Reaction burst](https://mobbin.com/screens/af96b3b4-5884-4a2d-b4ef-b9f3465edc94) | Tapping a reaction sprays small emoji from the button. | A playful micro-beat on a small action (owner reference). |

### What Catera should take

Feedback is sized to the action. Three tiers:

1. **Beat (full screen or hero):** payment received, a plan bought or renewed, Dapur's first customers imported, a package published for the first time. The existing "Pembayaran diterima" screen becomes the beat: one short drawn sequence (a check inside a ring that grows, or the rantang closing its lid; or the mascot) over about 600 to 900ms, the `success` haptic, then the facts that are already there. It plays once, only when the stage changes while the screen is open (ruling D8 stays), and is static under reduced motion.
2. **Toast (in place):** saved, address saved, menu saved, review sent, report sent, day moved, staff invited. A small pill at the top or bottom ("Menu Selasa tersimpan") that leaves on its own, with an undo where the action can be undone. Today most of these close silently (survey).
3. **Micro (on the control):** the heart fill, a checklist tick, a stepper. Already partly built (`PressableScale`, the Phase C tick).

Confetti only for a real milestone (the first purchase, the first published package), never for a routine save.

### Anti-patterns
- A dead-end success page with only "Done". Gojek's success is the top of the order page.
- Celebrating while the money is unconfirmed. The beat waits for the paid stage.
- Promo cards inside the success state (Tabby shows deals under "You're all paid up").

---

## 4. A dedicated settings page

### References

| App | Screen | What it does | Why it works |
|---|---|---|---|
| ChatGPT | [Settings](https://mobbin.com/screens/296ac65c-067a-4f7c-87c5-baf37c447495) | Inset grouped list. "App" group: App language (value + chevron), Appearance ("System" with a ⌃⌄ pop-up), Accent colour, Haptic feedback (switch). | Each row shows its current value; small choices use a pop-up menu in place, not a new page. |
| Craft | [Appearance & Sound](https://mobbin.com/screens/bd288cc8-cd50-4ad1-8bb5-b7e2ebacb0f2) | System / Light / Dark as three phone thumbnails; below, accent colours and switches. | When appearance has its own page, the choice is visual. |
| Tinder | [Settings sheet](https://mobbin.com/screens/c70032de-c9d6-4297-96f0-387767283cd6) | Grouped sections: Notifications (Email, Push, SMS rows), App icons, Dark mode (Use System Setting ✓, Light, Dark). | Theme as a checked list inside settings. |
| Base, Binance | [Base Display](https://mobbin.com/screens/3f573b95-4bbb-4978-957e-56178543e8e7), [Binance](https://mobbin.com/screens/d85a1bc2-5128-4f4c-bcea-d7e0c217cfdf) | Section headers (Appearance, Language; Allgemein, Darstellung) with value-and-chevron rows ("Auto", "English - US"). | Language and appearance live together under one heading. |
| Hypelist, Character AI, TextNow | [Hypelist](https://mobbin.com/screens/68e9f801-61a6-4d77-92e1-623b1c4dcaa6), [Character AI](https://mobbin.com/screens/0a65f4fd-71b8-4fdd-9572-b088b0568e5e), [TextNow](https://mobbin.com/screens/ad5aa6e3-c55c-441c-ac9e-691473e07f92) | Notifications as a switch or a row to a sub-page; Appearance and Language rows with values; Legal, Support, Account at the end. | A stable order: preferences first, help next, account last. |
| Google Photos, Luma | [Google Photos notifications](https://mobbin.com/screens/22a248fd-e7e2-4396-bae3-51e8c952b2b6), [Luma notifications](https://mobbin.com/screens/3ef7d2d1-40cf-45e0-a90f-83749684d3c5) | A notifications sub-page with one switch per kind and a one-line description. | Notifications get their own page once there is more than one kind. |
| PayPal, Babbel, Jira, YouTube Studio, Partiful | [PayPal](https://mobbin.com/screens/13bb06f5-5338-430d-9c92-ddbaa6a026b1), [Babbel](https://mobbin.com/screens/b877ba12-853e-43ea-a73e-243d76840c2d), [Jira](https://mobbin.com/screens/109896b3-3b1f-4479-91f9-6301d9f38a50), [YouTube Studio](https://mobbin.com/screens/f5057a6d-d7a5-4023-9095-7b7c5c3cde73), [Partiful](https://mobbin.com/screens/08692fe1-c70a-4df1-b95b-23f939043609) | The account screen is identity plus a few task rows, with one "Settings" entry (a gear button or a row). Log out sits at the very end of settings. | The account page stays about the person; device preferences move one level down. |

### What Catera should take
- A **Pengaturan** screen in each app, pushed in the account tab (customer Akun, Dapur Usaha), entered from a trailing gear in the tab root's header (iOS) or a "Pengaturan" row (both; Android has no header on tab roots).
- Content, as a native-feeling inset grouped list: **Notifikasi** (row with its value; a sub-page or a switch), **Bahasa** (value "Indonesia"; a sheet or a native pop-up with two options), **Tampilan** (value "Sistem"; same), then Tentang aplikasi (version) and **Keluar** last. Signed-out customers still reach Pengaturan for language and theme.
- Akun keeps the person and their things (plans, addresses, saved, payments, help).

---

## 5. Bottom sheets and action hierarchy

### References

| App | Screen / flow | What it does | Why it works |
|---|---|---|---|
| Luma | [Events sheet](https://mobbin.com/screens/d98f6edc-7efd-4130-9a2d-3fdcaf6fee63), [over the map](https://mobbin.com/screens/52ce8173-ab47-4234-b4d0-6d08299e324f), [context menu](https://mobbin.com/screens/0237b28f-cc30-4d8a-9e30-c5613c10536d), [Leave event](https://mobbin.com/screens/db78c794-320c-4882-b6e4-e07c9492773f), [Cancel event](https://mobbin.com/screens/802758d0-1ab0-40fd-a7f2-d0e2b40499f5), [busy](https://mobbin.com/screens/3befd574-deef-4fdc-92d6-fbfbfbe5bbb3) | A list sheet over the map; a context menu for secondary actions (Add to Calendar, Open in Browser, Report in red); a compact confirm sheet with icon, title, one-line consequence and "Slide to Confirm"; the slider becomes a spinner while it runs. | The owner's reference: three weights of action in three containers (menu, sheet, page). Destructive confirmations are small sheets that stay over context. |
| HelloFresh, Blue Apron (from the 2026-10-07 research) | [Manage delivery](https://mobbin.com/flows/53e8f448-cfb5-47f5-ad98-c52597b52652), [Blue Apron menu weeks](https://mobbin.com/screens/cdf68f36-89aa-4bdd-a207-601691ff5b7b) | All per-delivery actions in one sheet scoped to the date; a week picker as a sheet. | Meal-subscription precedent for "tap a day, get its actions". |
| Shop, Shopify | [Shop "Your order"](https://mobbin.com/screens/4675eca5-f911-46f2-b911-a09d5b653fd5), [Shopify actions](https://mobbin.com/screens/af400eec-3fa1-4873-bf09-8595c1f74669) | An item's "…" opens a sheet of icon rows (Contact merchant, Copy order number, Report an issue), destructive last in red. | One entry point for every secondary action on an item. |
| Grab, foodpanda | [Grab restaurant actions](https://mobbin.com/screens/dff56b65-a704-43e1-b08f-a045eb9c3b9c), [foodpanda cart](https://mobbin.com/screens/34b4e1dc-4766-42c0-9d80-d1194c7304c9) | Two-row sheets: Add to favourites, Hide this restaurant (30 days); Add more items, Delete cart. | Sheets stay as short as their content. |
| Grab, Shopee, Deliveroo, Best Buy, Starbucks | [Grab day and time](https://mobbin.com/screens/1a5ab71d-12ea-47db-8bfa-81e9a711cdcf), [Shopee order type](https://mobbin.com/screens/55bc4122-44e6-4b34-a53f-0b8e9bd6a14a), [Deliveroo](https://mobbin.com/screens/e307e811-3b75-48a5-8480-f817beb3472f), [Best Buy](https://mobbin.com/screens/f9c896d6-01b9-4d51-b117-8c16391418cb), [Starbucks](https://mobbin.com/screens/8932dd7b-d4bb-48fa-88f8-c40d4e5e6257) | Date and time picks as sheets: a day strip on top, slots below, one Confirm/Save button. | Picking a date is a sheet task everywhere in Indonesian delivery apps. |
| pliability, MacroFactor | [pliability](https://mobbin.com/screens/0b73d511-0754-47af-a66b-760284734e8d), [MacroFactor](https://mobbin.com/screens/f8d0e547-22cd-4c2d-8710-1b8a9b2f0eb5) | A month calendar as a half sheet with one action. | A calendar does not need a page. |
| GoPay | [Remove method](https://mobbin.com/flows/df1559ed-eca1-47ca-93b0-deeb36ca90f8) | Over the detail page, a short sheet: "Remove this method?", consequence, Cancel and red Remove side by side. | Indonesian precedent for a confirmation sheet instead of a system alert. |
| Fuse, Thrive Market | [Fuse Send sheet](https://mobbin.com/flows/e72d4f05-97cd-476a-9c85-6a1800f93f94), [Thrive "Add this item to"](https://mobbin.com/flows/14175952-456f-4388-8690-8569e6ecdf1d) | A choice sheet (To bank / To wallet) that leads into a taller sheet; a save-to-list sheet whose "Create a new list" grows into a form sheet, then a toast "Added to list". | Sheets can step: short choice, taller form, then back to context with a toast. |
| Feeld | [Photo source sheet](https://mobbin.com/screens/31c0253e-edec-40d5-a0b6-1e58049cd8dc) | "Take a new photo / Select from your camera roll / Cancel". | The source choice is a sheet, not a page. |

### What Catera should take

A written action hierarchy, applied to every screen:

| Weight | Container | Catera examples |
|---|---|---|
| Primary task with its own context or a cold link | Pushed page | Plan detail, package detail, Hari, Pilih menu (multi-day), Dapur Menu day editor |
| Short task with 1 to 5 controls, done in place | **Native form sheet with detents** (`presentation: "formSheet"`, `sheetAllowedDetents`) | Report a problem, Ubah hari, address pick or quick edit, notification and language choices, Dapur report reply, Tim invite, import row edit, filters |
| Several secondary actions on one item | **Action sheet** (a short sheet of icon rows, destructive last) or the platform's context menu | A day or delivery "…" (Ubah hari, Lapor masalah, Lihat menu), a Dapur stop "…", a package "…" in Usaha |
| Destructive or irreversible confirmation | **Compact confirm sheet** (icon, title, consequence, two buttons) | Mulai masak, Berangkat antar, discard menu changes, sign out |
| Routine outcome | Toast | See section 3 |

Native chrome rule (owner, 2026-10-10): sheets are the platform's own (`formSheet` with detents and a grabber on iOS; the Material bottom sheet behaviour on Android via react-native-screens), not the custom RN `Modal` `Sheet`, where the platform allows it in Expo Go.

---

## 6. Save and favourite micro-interactions

### References

| App | Screen / flow | What it does | Why it works |
|---|---|---|---|
| Etsy | [Saved for later](https://mobbin.com/screens/b53410bc-c9a5-4706-9c26-5b41e600a2f2) | A top banner "Ok, you've saved this for later" with a check; the item shows "Favorited" with a filled heart. | The heart changes at once and a message confirms where it went. |
| Thrive Market | [Add to list flow](https://mobbin.com/flows/14175952-456f-4388-8690-8569e6ecdf1d) | Heart opens "Add this item to" (Favorites or a new list); afterwards the heart is filled and a bar says "Added to list: Sauce" with a link. | The toast carries a link to the saved place. |
| Mindvalley, Instagram, My BMW | [Mindvalley](https://mobbin.com/screens/a2c9cde0-8bd7-4a2e-b122-ee7cf2ac13d1), [Instagram](https://mobbin.com/screens/8284105b-3d95-4cde-b8d6-a80ca938170f), [My BMW](https://mobbin.com/screens/7ab2720a-b373-420b-a6a5-354e76153343) | Removing shows "Removed from favorites · Undo". | Unsave is reversible for a few seconds, so there is no confirm dialog. |
| Mindtrip, Shop | [Mindtrip](https://mobbin.com/screens/8382410d-94b6-4834-874d-ee4e9c6b660f), [Shop Favs](https://mobbin.com/screens/829e2b44-47e7-4629-9257-645b88bb1bda) | Filled heart on the photo corner; toast "Created 'Wishlist' and saved California". | The state glyph sits on the photo. |
| Google Photos | [Added to favorites](https://mobbin.com/screens/0ae43c3f-6ee7-4e0e-8abe-ff8aee6efda1) | A modal dialog "Added to favorites!" with Done and View favorites. | Anti-pattern for a frequent action: a dialog interrupts. |
| Orb Social | [Reaction burst](https://mobbin.com/screens/af96b3b4-5884-4a2d-b4ef-b9f3465edc94) | Small shapes burst from the tapped control. | The playful part is on the control itself and brief. |

### What Catera should take
- Heart: fill plus a short scale pop (about 1 → 1.2 → 1 with a spring, transform only) and a few small burst marks around it in sunrise ink (decorative, under 400ms), `select` haptic on save and none on unsave; static fill under reduced motion.
- Toast: "Disimpan · Lihat" (opens Disimpan) on save, "Dihapus dari simpanan · Urungkan" on unsave. No dialog.
- Optimistic update and rollback stay as built (`useSaved`).

---

## 7. List insertion and content entering

### References

| App | Flow | What it does (motion inferred from frames) | Why it works |
|---|---|---|---|
| Instacart | [Adding to shopping list](https://mobbin.com/flows/83805663-d3c2-47f5-8e05-0e767f3e1a1f) | The new item appears at the top of the list and the rows below move down; the total updates. | The new row lands where the user is looking; the rest of the list moves rather than jumping. |
| monday.com | [Adding an item](https://mobbin.com/flows/7d2ee54b-c106-4162-9fa3-571f81d46141) | The typed row takes its place in the group above "+ New item". | Inline add with the row appearing in place. |
| Craft | [Adding a row](https://mobbin.com/flows/96c62a31-6360-4fe7-a272-adeac4804a86) | An action sheet (Insert Row …) and the table gains an empty row under the selection. | The inserted element appears next to its origin. |
| Phantom | [Sending a token](https://mobbin.com/flows/3316db6f-f0a1-4c33-b8a3-c6e3facb6ca5) | After sending, Recent Activity shows a new "Pending · Sending 1 USDC" group at the top. | A new record appears where history begins. |

### What Catera should take
- **Insertions and removals animate; first loads do not stagger.** A row that the user's action adds or removes (an imported customer, an address, a saved package, a Dapur menu dish, a checklist row moving) enters with a short fade and rise (`content` 220ms) and its neighbours slide with a layout transition (Reanimated `LinearTransition`). Removal fades out and the gap closes.
- **First appearance of loaded content**: skeleton to content is a single cross-fade of the section (`FadeSwap`), not a per-row stagger. This keeps DESIGN.md's "never stagger a catalog" intact for data loads while answering the owner's "not just abrupt blink all there". Whether a short stagger is allowed on a screen's first content is an owner decision (audit 007).

---

## 8. Photo previews in forms (Dapur import)

### References

| App | Screen | What it does | Why it works |
|---|---|---|---|
| happn, Coffee Meets Bagel | [happn](https://mobbin.com/screens/ac58d682-9bb9-4c5f-a30c-51c5e855bd13), [CMB](https://mobbin.com/screens/da5b1ec3-e28d-4807-80c9-e04b626feb89) | Square thumbnails of the picked photos with an ✕ at the corner; empty tiles invite more. | The user sees what they picked and removes it from the thumbnail. |
| eBay, Vestiaire | [eBay](https://mobbin.com/screens/4ca5cc79-799f-4318-bec2-8cf99898eb79), [Vestiaire](https://mobbin.com/screens/edcd5a8f-2de3-44ba-9ab8-b00800268271) | "3/24" count; an "Add photos" tile first in the grid; each tile has a "…" or ✕. | Count plus add tile make the limit visible. |
| Tinder, BFF | [Tinder](https://mobbin.com/screens/44e28fc0-84f2-41ed-9222-28d32089d063), [BFF](https://mobbin.com/screens/34318498-2bfe-495d-b1dd-9f5dffae5e81) | A spinner on each photo while it uploads; numbered tiles. | Progress sits on the photo. |

### What Catera should take
Import photos show as a row of 72dp thumbnails (radius 12, `sage` ground while decoding) with a 48dp ✕ target and "Foto 2 dari 6" for screen readers; PDF and spreadsheet files keep an icon plus file name. An "+ Foto" tile closes the row while under the limit of 6. Tapping a thumbnail opens it full size.

---

## 9. Package nutrition (macros)

### References

| App | Screen | What it does | Why it works |
|---|---|---|---|
| Cherrypick (UK meal kit) | [Recipe nutrition](https://mobbin.com/screens/a33caaa1-69de-4b86-adff-ca67b13e57a8) | Per serving / Per 100g toggle; tiles kcal 594, carbs 50g, fat 20g, protein 64g (and salt, sugar, fibre); a note that the numbers are based on the original ingredients. | Meal-kit precedent: plain tiles plus an honest source note. |
| Withings Health Mate | [Meal](https://mobbin.com/screens/22c5973d-837a-46e0-b697-31fb4fc84a5c) | One card: PROTEIN 14g, FAT 9g, CARBS 48g. | The minimum useful form. |
| Chick-fil-A | [Item sheet](https://mobbin.com/screens/d4be3f52-b1c1-4b23-ac3a-20faefb0ed02) | "$7.45 · 650 cal · 31g protein" in the item header. | Calories and protein inline next to the price for quick scanning. |
| Garmin, BitePal, Cal AI, Fitbit | [Garmin](https://mobbin.com/screens/6b8d0b8a-f5e4-4e59-903a-d80d94b9c344), [BitePal](https://mobbin.com/screens/7ca1bb91-f8d4-4ae6-8b6f-6ba455fee606), [Cal AI](https://mobbin.com/screens/aabee4ec-e158-48b1-9f46-cfc920d76915), [Fitbit](https://mobbin.com/screens/312762de-bb6a-45c3-a184-6d8d26841910) | Calories large, then protein, fat and carbs as a 2×2 grid, a split bar, or three tiles. | Tracking apps lead with calories and use one colour per macro. |
| MacroFactor, Lifesum, Ultrahuman | [MacroFactor](https://mobbin.com/screens/e90fa537-9360-4fe2-8fb8-b0e21d0b69bd), [Lifesum](https://mobbin.com/screens/2978a113-5407-42aa-9c1d-3303f5036312), [Ultrahuman](https://mobbin.com/screens/cb6f4dbd-b77c-4012-86a0-84d2c825159b) | Rings and percentages against personal targets. | Out of scope: Catera has no personal targets, and rings would invent a goal (R-17). |

### What Catera should take
- Package detail and the Jelajah row: "± 520 kkal · 32 g protein" inline when the caterer has filled them; a "Gizi per porsi" card of four tiles (Kalori, Protein, Karbohidrat, Lemak) with "Perkiraan dari katering" as the source note. Hidden entirely when the caterer has not filled them; never zeros, never estimates by Catera.
- Dapur package editor: four optional number fields under "Gizi per porsi (opsional)".
- What exists in the schema today decides the size of this work (survey, audit 007 finding on item 5).
