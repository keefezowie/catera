# SDD ledger — plan: docs/superpowers/plans/2026-10-07-v2-customer-app.md

Spec: docs/superpowers/specs/2026-10-07-customer-app-design.md (406308f). Plan commit 8086346. Branch v2.

Setup: Ruling: work in the shared C:\Catera tree on v2, not a worktree — AGENTS.md says work directly on v2 and the user runs a parallel caterer session there; a separate branch would need a merge later — cost if wrong: an implementer's test run can see the other session's half-edited apps/caterer files (mitigation: stage exact paths only; caterer test failures not caused by this plan are reported, not fixed).

## Pre-flight scan

| Tasks | Produces → consumes | Finding |
|---|---|---|
| T1 → T2, T3, T6, T7 | fulfillments columns, delivery_reactions, DeliveryMeal type | consistent |
| T2 → T3 | v1.window_bounds, confirm day-derivation; postgres-delivery-confirm.mjs | consistent (T3 extends the module) |
| T2 → T4 | confirm deletes outbox dedupe 'arrive:'; T4 creates those rows | consistent (deleting zero rows before T4 is harmless) |
| T3 → T4 | T3 notifies with dedupe 'depart:…'; the dedupe-capable v1.notify is introduced in T4 | CONFLICT → Ruling 1 |
| T3, T4, T5 | all modify apps/web/src/app/api/v1/[...path]/route.ts | sequential, no conflict |
| T5 → T10 | ClaimPreview / api.claimPreview | consistent |
| T6 → T7, T8, T12 | todayPlates, upcomingRows, canChangeDay, renewalDefaults, renewalDue, dayLabel | consistent |
| T7 → T9 | Belum pushes /masalah/<id>?meal&jenis=belum; route created in T9 | consistent (route exists before release) |
| T7 → T10 → T11/T12 | nativeReturnPath extended in T10; T11/T12 use /login?next= | consistent |
| T10 → T12 | renew route moved into T12 (plan fix before commit) | consistent |
| T7, T8, T11, T12, T13 | each deletes the old files it replaces; T13 deletes the remainder | consistent |

| Task | Self-consistency |
|---|---|
| T1 | ok |
| T2 | "before the window" test needs a deterministic clock → Ruling 2 |
| T3 | ok (needs Ruling 1) |
| T4 | ok (remindDue takes `now` explicitly) |
| T5 | spec says 6 fields earlier, plan lists 7 named fields → plan is authoritative on names (7); Review Focus corrected to 7 |
| T6 | ok (pure functions take `now`) |
| T7–T13 | ok |

Ruling 1: T3 introduces the overload `v1.notify(u uuid,k text,b text,h text,dedupe text)` (old 4-arg form unchanged); T4 reuses it rather than introducing it — T3's depart push needs the dedupe — cost if wrong: one function moves between migrations.
Ruling 2: T2's "refuses before the window" test sets the offer's lunch window to "23.59–23.59" on a delivery dated Jakarta today with no departure; the "due" case uses "00.00–00.01". No test-only clock is added to production SQL — a GUC-controlled clock would be a security-relevant backdoor — cost if wrong: that one test can misfire if run during the minute 23.59 WIB.
Task 1: implementer DONE_WITH_CONCERNS (6e0dfd1). Ruling 3: customer migrations use the 202610081x0000 series (T1 20261008100000_customer_arrival, T2 20261008101000, T3 20261008102000, T4 20261008103000, T5 20261008104000) — the caterer session already took 20261008090000 — cost if wrong: a rename.
Ruling 4: Task 2 adds Task 1's migration (and its own) to the PostgreSQL harness apply list (tests/postgres-concurrency.mjs), since the harness applies migrations explicitly — cost if wrong: one extra line in T2.
Note: tests/import-assistant.test.ts failing belongs to the caterer session's in-progress work; not this plan's.
Task 1: review Approved with 1 Important (arrival keys leak into v1.beta_production_signature → false production_changed). Ruling 5: fix in a new migration 20261008100500_production_signature_arrival.sql (not by editing the committed migration, which may already be applied on a shared DB) — cost if wrong: one extra migration file.
Task 1: minor (deferred): test covers only the happy path (reaction non-null, resolved issue → null, newest of two issues, staff customer key) — fold reaction/issue cases into Task 2/3 tests.
Task 1: minor (deferred): meals is null for a day with no fulfillments while the type says DeliveryMeal[] — domain functions (Task 6) must treat null as [].
Task 1: minor (deferred): issue lookup not scoped by user_id (harmless: one owner per subscription).
Task 1: fix round 1/5 (1 addressed, 0 open; commits 6e0dfd1..5fc9ae5)
Task 1: complete (commits 6e0dfd1, 5fc9ae5 — interleaved with caterer commits; review clean)
Task 1: minor (deferred): migration 20261008100500 re-applies the schema-wide function revoke (consistent with existing migrations).
Task 2: implementer DONE_WITH_CONCERNS (7a3f83a). Carry to Task 3: tighten verifyDeliveryConfirm to confirmed_by ∈ {customer, auto} once auto_deliver stamps 'auto'; verifyDeliveryConfirm(pool, cmd, evidence) applies T1+T2 migrations itself; the vitest file uses all 15 synthetic days (new tests need another package/day).
Ruling 6: react's 48h window counts from confirmed_at, else from the end of the Jakarta service day (no update-time column exists) — cost if wrong: reactions accepted up to a day longer for auto-confirmed meals. Unknown delivery id → NOT_FOUND accepted.
Task 2: complete (commit 7a3f83a, review clean)
Task 2: minor (deferred): earning trigger runs without the pilot:<caterer> advisory lock (same as auto_deliver; additive entries).
Task 2: minor (deferred): clock-dependent tests (23:59 WIB, Jakarta midnight) — accepted under Ruling 2.
Task 2: minor (deferred): double-confirm race test does not assert a single reaction row / equal confirmedAt.
Task 2: minor (deferred): "refuses another customer" uses the caterer owner as the other user (no second customer in seed).
Task 2: minor (deferred): caterer is not sent a refresh event when a customer confirms (only the customer's delivery.changed) — check in the caterer track.
Ruling 7: Task 3 fixes the subscription-completion race (Task 2 minor 1) because it redefines auto_deliver anyway: a shared helper v1.complete_subscription_if_done(p_subscription uuid) locks the subscription row FOR UPDATE before checking for open days; auto_deliver and delivery.confirm both call it — cost if wrong: one helper + redefining confirm's completion line.
Task 3: implementer DONE_WITH_CONCERNS (c0376f3).
Ruling 8: a report filed after the morning auto-confirm leaves that day's earning unheld until escalation (v1.settlement_held holds only escalations/support cases/unreconciled refunds), exactly as late reports behave today; the hold applies to reports filed before the run — the spec §6.6 race expectation "held per settlement_held" is replaced by "never delivered while a committed or in-flight report exists; delivered ⇒ one earning; held ⇒ none" — cost if wrong: a late "Belum sampai" pays the caterer until support refunds it.
Task 3: review Needs fixes — Important: delivery.depart accepts any date (future taps push misleading notices and lock days out of changes). ⚠️ confirmed real: pushes are per fulfillment, spec §6.1 says one per affected customer; spec §10 depart-vs-confirm race test missing. All three enter fix round 1.
Ruling 9: depart only accepts the caterer's Jakarta today (INVALID_DATE otherwise) — a route leaves on its delivery day; yesterday is not useful for "on the way" — cost if wrong: a late-night yesterday route cannot be marked departed.
Ruling 10: depart push dedupe becomes per customer+caterer+date+meal ('depart:'||user_id||':'||caterer_id||':'||date||':'||meal) so one customer gets one push however many packages — cost if wrong: none material.
Task 3: minor (deferred): notify overload lacks the 4-arg form's `if u is null then return` guard.
Task 3: minor (deferred): complete_subscription_if_done takes the subscription lock on every delivered day (held for the job's duration); rare deadlock vs customer.deliveryChange surfaces as 40P01 for confirm.
Task 3: minor (deferred): meal-lock check in auto_deliver has no direct test; one delivery.changed event per moved meal.
Ruling 11: committed migrations stay immutable; Task 3 fixes go in 20261008102500_depart_today_one_push.sql (corrects my first fix message that said amend in place) — cost if wrong: one extra migration.
Task 3: fix round 1/5 (3 addressed, 0 open; commits c0376f3..bd44d1f)
Task 3: complete (commits c0376f3, bd44d1f; review clean)
Task 3: minor (deferred): depart tests/race compare localDay() with SQL Jakarta today — can flake across Jakarta midnight.
Task 4: implementer DONE (06593f2). Implementer ruling accepted: outbox.claim excludes kind 'push'; pushes only via outbox.claimPush (5-minute lease); /api/jobs still calls dispatchPushes.
Ruling 12: renewal push duplicates the existing daily maintenance push ('Paket hampir selesai…', dedupe renew-<id>); spec says one push — subscription.remindRenewal must use the same dedupe 'renew-'||id so whichever runs first wins — cost if wrong: copy differs depending on which job ran first.
Ruling 13 (implementer's extra accepted): remindRenewal skips subscriptions not yet started or already renewed (non-cancelled renewed_from) — sensible, matches "explicit renewal" — cost if wrong: none.
Task 4: review Needs fixes — Important: immediate dispatch has no deadline (can hold/kill the command response).
Ruling 14: re-graded by effect to Important and added to fix round 1: (m1) /api/jobs completes stray push jobs unsent if code deploys before the migration; (m2) a dispatchPushes failure aborts the rest of /api/jobs (receipts, health); (m6) arrival reminder still sent after a report — deliveryIssue.create must delete the unsent 'arrive:' row like confirm does. Plus Ruling 12 (renewal dedupe 'renew-'||id). — cost if wrong: a slightly larger fix round.
Ruling 15: migration ordering — the customer series sorts before 20261008110000_import_assistant_quota (caterer session); wrappers intercept disjoint actions so either order works; from Task 5 on, new customer migrations use a timestamp later than the newest file in supabase/migrations at writing time — cost if wrong: `supabase db push --include-all` needed at deploy (noted for the RUNBOOK gate).
Task 4: minor (deferred): no real-PG check for claimPush disjointness / remindDue vs confirm race.
Task 4: minor (deferred): `sent` counts jobs for users without devices; remind_* `queued` overcounts on concurrent runs.
Task 4: minor (deferred): customer.followup may not enqueue a push itself (dispatch there may only drain backlog).
Task 4: fix round 1/5 (5 addressed, 0 open; commits 06593f2..dceb029)
Task 4: complete (commits 06593f2, dceb029; review clean)
Task 4: minor (deferred): pushes queued via the 5-arg notify have dedupe ≠ notification id, so notification.eligible returns true for them (renewal eligibility re-check at send time skipped; filtered at queue time).
Task 4: minor (deferred): a replayed deliveryIssue.create after resolution could delete a re-queued arrival reminder (harmless).
Task 5: implementer DONE (bb9d04e).
Ruling 16: no rate limiter on claim-preview — no anon read has one (the plan's "like catalog" assumed one exists); token entropy (~244 bits), hashed lookup, uniform NOT_FOUND and no-store make probing impractical; a real limiter belongs at the edge/WAF — cost if wrong: enumeration attempts are only bounded by entropy.
Ruling 17: malformed tokens → INVALID_INPUT (reveals only token shape, not state) accepted.
Task 5: complete (commit bb9d04e, review clean)
Task 5: minor (deferred): postgres "anon" check does not `set local role anon`; error responses lack Cache-Control no-store (pre-existing failure()); extra path segments after the token are ignored.
Task 5: minor (deferred): spec consequence — a short address line (≤24 chars) without label is shown in full; a 9-digit local number shows 8 of 9 digits.
Task 6: implementer DONE (3de36c4). Notes: issue open = status ≠ resolved (the read only returns open/responded/escalated anyway); PlateState 'none' unused.
Task 6: review Approved. Ruling 18: re-grade minor 1 to Important by effect — upcomingRows shows "change until 17.00" after the cutoff passed (every evening) → fix round 1: changeUntil only when canChangeDay(d, now).date || .address is still open — cost if wrong: one line.
Task 6: minor (deferred): renewalDefaults with only out-of-range weekdays ends at ends_on+8 (unreachable with validated data); canChangeDay.until returned after close (harmless).
Task 6: fix round 1/5 (1 addressed, 0 open; commits 3de36c4..b928914)
Task 6: complete (commits 3de36c4, b928914; review clean)
Task 6: minor (deferred): changeUntil also shows for fixed packages whose address is still changeable — UI copy must say "bisa diubah" generically, not "pindah tanggal".
Task 7: implementer DONE (f2b98d0, 3b4fdbf). Old NativeProvider kept around the stack (bridged sign-in state, shared Supabase client) until T13; env name EXPO_PUBLIC_API_URL; no tests deleted (mascot.test stays until T13).
Ruling 19: Chat katering needs the caterer's WhatsApp number in the customer read — Task 9 adds `catererPhone` (owner's verified phone, E.164) to each delivery/subscription in the customer read (own customers only) and wires Chat katering on Beranda and Ada masalah — cost if wrong: one more read field in T9.
Ruling 20: mobile-core signInPassword names a brand-new email user "Katerer" — wrong for customers; fix additively (optional `name` parameter, default unchanged for the caterer app) and the customer app passes "Pelanggan" — added to Task 7's fix loop — cost if wrong: one optional parameter on a shared package.
Task 7: minor (deferred): old screens still link to deleted /messages and /compare until T11/T13 replace them; sign-in from Jadwal/Akun returns to / until T10.
Task 7: review Needs fixes — Critical: shared Supabase client → both providers subscribe the same realtime topic → throw/crash for real signed-in customers (3b4fdbf). Important: no test for the two-provider shell. Spec deviations entering the loop: no tabular numerals; plate sentence 29px not 28; Sunrise used on review stars; scrim contrast can drop below 4.5:1 (spec §9). Plus Ruling 20 (signInPassword name).
Task 7: minor (deferred): offline fallback catches every error (also UNAUTHORIZED/5xx) and labels it "tidak ada koneksi" (same pattern in caterer app); stale label shows only HH.MM (no day); cached files stay after logout; reviewCandidate picks first eligible before dismissal filter; jakartaClock duplicated with caterer exceptions.ts; offline.ts untested; old logout replaces to /discover; offline cold start providers disagree (transitional).
Task 7: fix round 1/5 (7 addressed, 0 open; commits 3b4fdbf..c06066a)
Task 7: complete (commits f2b98d0, 3b4fdbf, c06066a; review clean)
Task 7: minor (deferred): Plate contrast comment says ~5.3:1, overlay alone over white is ~4.9:1 (test asserts ≥4.5 correctly); old screens may reload twice on resume; old-screen commands refresh Beranda only via realtime.
Task 8: implementer DONE_WITH_CONCERNS (6e1a7ec). Accepted: a small /hari/<id> day detail screen (photo, meals, address, Ubah hari, menu link, Ada masalah → /masalah). Ruling 21: the sheet's capacity error uses its own copy ("Hari itu sudah penuh. Pilih tanggal lain.") instead of errorLabel's checkout wording — added to Task 8's fix loop — cost if wrong: one string.
Task 8: review Approved. Ruling 22: re-grade by effect into fix round 1: (m1) backend '/calendar' notification hrefs must map to /jadwal in customerLink and nativeLink; (m2) the sheet must send the version captured when it opened (restores optimistic-concurrency protection; a version change while open shows "Detail hari ini berubah. Periksa lagi." and refreshes). Plus Ruling 21 (capacity copy). — cost if wrong: small fix round.
Task 8: minor (deferred): stale chosen date after availability reload (server rejects); dead NOT_AVAILABLE/FULL error branches; no "hari ini" hint for today's cell; selection not reset at midnight; old "Lewati & pilih pengganti" (kind skip) option dropped (no backend handling found).
Task 8: fix round 1/5 (3 addressed, 0 open; commits 6e1a7ec..54f94da)
Task 8: complete (commits 6e1a7ec, 54f94da; review clean)
Task 9: implementer DONE_WITH_CONCERNS (73237ec backend catererPhone, cde4262 app). catererPhone = owner's SMS-verified auth phone (no caterer contact column exists); email-only owners show no Chat katering. No photo (deliveryIssue.create has no image field); empty note sent as "Tanpa catatan tambahan." (SQL needs ≥5 chars).
Ruling 23: Bantuan must keep a way to ask for help/cancellation (PRODUCT.md rule 6: all cancellation/refund requests enter support) — add "Minta bantuan" (support.create with the old daily.tsx payload; topic Pembatalan / Pembayaran / Lainnya + text) to Task 9's fix loop — cost if wrong: one small form.
Task 9: minor (deferred): report-reply notifications (/support?issue=…) open the Bantuan list, not the specific report.
Task 9: review Needs fixes — Important: an unanswered (open) report cannot be escalated (regression vs old UI; breaks the outcome promise).
Ruling 24: open reports become escalatable from 12.00 Jakarta on the day after the report was created (matches the outcome copy "Sampai besok 12.00… Belum beres? Catera meninjau"); before that the row shows "Bisa minta Catera meninjau mulai besok 12.00"; responded/resolved stay escalatable any time — cost if wrong: customers wait until noon next day before Catera sees an ignored report.
Ruling 25: re-graded into fix round 1: (m2) payment help dead end — Bantuan shows the payment card for the checkoutId it was opened with in any unpaid state (awaiting/checking/failed), else for any unpaid checkout; (m1) nativeReturnPath maps /support → /bantuan; (m5) cancelled-only day shows "Pengantaran tidak ditemukan" instead of a dead form; (m3) StatusPill uses charcoal for Terkirim/Ditinjau Catera/Selesai, sunrise-ink only for Dibalas. Plus Ruling 23 (Minta bantuan). — cost if wrong: a larger fix round.
Task 9: minor (deferred): v1.caterer_whatsapp looks up the same caterer once per delivery row (cheap); DayScreen shows Chat katering at all times (accepted).
Note: ⚠️ hosted Supabase — security definer functions run as the migration owner, which can read auth.users; verify at deploy (RUNBOOK).
Task 9: fix round 1/5 (6 addressed, 0 open; commits cde4262..2089449)
Task 9: complete (commits 73237ec, cde4262, 2089449; review clean)
Task 9: minor (deferred): customerLink("/support?…") drops the query; escalate noon gate is client-only and not re-evaluated by a timer.
Task 10: implementer DONE_WITH_CONCERNS (97b06f3). Signed-out web claim uses the web's existing auth/send + auth/verify; /claim no longer redirects to login (preview first, per spec).
Ruling 26: the customer types their own phone number after "Lanjut…" (no token-triggered SMS endpoint) — a token-triggered SMS sender would let anyone holding a link spend SMS credit; customer.claim already verifies the number matches the caterer's record — cost if wrong: one extra field vs the canvas (button copy must not promise sending to the masked number).
Task 10: minor (deferred): app asks for an SMS code even when already signed in; network errors show a retry message (accepted); /renew app links route to Task 12.
Task 10: review Needs fixes — Important: typed number not matching maskedPhone leads to a terminal dead-link with wrong advice (+ orphan account signed-out); app dead/offline states have no exit (cold-start iOS trap). Ruling 27: re-grade minor 1 (success toast shown on status "review") into the fix round — wrong message to the customer — cost if wrong: one string condition.
Task 10: minor (deferred): no format validation of CATERA_ANDROID_SHA256 entries / web host; no e2e for signed-out web path (demo forbids auth/send); silent account switch in the app after OTP.
Task 10: fix round 1/5 (3 addressed, 0 open; commits 97b06f3..93dc15c)
Task 10: complete (commits 97b06f3, 93dc15c; review clean)
Task 11: implementer DONE_WITH_CONCERNS (adacbce). Accepted: no public dated menu → "Isi paket" composition (Ruling 2 of the dispatch); distance omitted (no field); legacy routes package/[id], saved, (tabs)/discover are Redirect stubs until T13.
Ruling 28: mobile-ui Chip is 40px (< 44pt) — the customer app meets 44pt via hitSlop (or a 44px min-height wrapper) on its chips without changing the shared component — added to Task 11's fix loop — cost if wrong: none.
Task 11: minor (deferred): server catalog honours only area/limit, so meal/budget/trial chips filter client-side over the returned page (may miss items beyond the first page); old contents deep-link params no longer handled.
Task 11: review Needs fixes — Important: saved-heart tests false-green (static mocks; no rollback test). Ruling 29: re-grade minor 1 (full-screen spinner flash on every chip tap) into the fix round — fetch by area (+search if the server honours it) only and filter client-side without clearing data — cost if wrong: none. Plus Ruling 28 (44pt chips).
Task 11: minor (deferred): area two-way stale between Jelajah and legacy provider within a session (until T13); useSaved resets pagination on reload; #CFD3C6 hard-coded; redirect stubs untested; legacy saved provider and useSaved hold separate state until T13.
Ruling 30: the brief's test 'catalog query includes maxPrice 30000' is replaced by asserting budget filtering on cards — the server ignores maxPrice, so sending it was meaningless (follows Ruling 29) — cost if wrong: none.
Task 11: fix round 1/5 (3 addressed, 0 open; commits adacbce..9112dbe)
Task 11: complete (commits adacbce, 9112dbe; review clean)
Task 11: minor (deferred): Jelajah sees only the first 100 published packages (server max, no pagination) — needs server-side filtering/pagination when the catalog grows.
Task 12: implementer DONE (9148d5c). Accepted: new-purchase earliest start uses purchaseStartAvailable (deliveryAvailability is per existing day); server quote still checks capacity; old checkout draft dropped; src/renewal.tsx kept for T13 (daily.tsx imports it).
Task 12: minor (deferred): BuyScreen.tsx 322 lines; QR rendering only mocked in Jest — check on an Android device.
Task 12: review Needs fixes — Important: stageOf ignores preventDuplicatePayment (offers a second purchase / renewal loop while the first checkout is pending); renewing an unpublished package spins forever.
Ruling 31: re-grade into fix round 1 (money path — misleading the customer while paying): (m1) pending renewal shows contradictory "not available" message; (m2) blocked choice keeps showing the previous price undimmed; (m3) "Bayar lagi" drops portions/cycles/address; (m4) add AppState foreground refresh on Bayar (customer back from the bank app); (m5) tests for PRICE_CHANGED → requote, create payload with cycles>1 and renewedFrom, swallowed payment.start failure, VA on Bayar. — cost if wrong: a larger fix round.
Task 12: minor (deferred): each poll bumps the global revision (reloads all mounted reads); unused styles; BuyScreen 322 lines; no "Nomor disalin" feedback; countdown runs while blurred; submit navigates twice on double tap (request id reuse prevents double charge).
Task 12: fix round 1/5 (7 addressed, 0 open; commits 9148d5c..cc99af5). New in fix diff (re-graded Important by effect — double payment risk): NoLongerSold branch hides "Lanjutkan pembayaran" for a pending renewal checkout whose package became unpublished → fix round 2.
Task 12: minor (deferred): replacementRequired also true for an unapproved seller — NoLongerSold may list that caterer's other packages; unknown addressId in a crafted link leaves a stale address state (no fallback to default).
Task 12: fix round 2/5 (1 addressed, 0 open; commits cc99af5..b70436c)
Task 12: complete (commits 9148d5c, cc99af5, b70436c; review clean)
Ruling 32: Task 13 ports every old screen still reachable (register, recover, auth/callback, notifications list, subscription menu choice, addresses) onto mobile-core/mobile-ui so context.tsx, ui.tsx and the legacy NativeProvider/bridge can be deleted; redirect stubs stay only for hrefs the server still emits (e.g. /subscriptions/<id>, /checkout/<id>, /payment/<id>, /package/<id>) — cost if wrong: Task 13 is larger.
Task 13: implementer DONE_WITH_CONCERNS (d33069f, f7d181f). Full verification green: typecheck, build, test:postgres (38 checks), root 449, customer 223, caterer 65.
Ruling 33: native-apk.yml's job `if` builds only on v1 → allow v2 (release pipeline is in this task's scope; Task 11 of the caterer plan already added v2 to triggers) — added to Task 13's fix loop — cost if wrong: one CI condition.
Ruling 34: restore a startup retry screen ("Belum bisa terhubung. Coba lagi.") instead of silently opening as guest after a failed startup — added to fix loop — cost if wrong: small.
Ruling 35: remove the now-unused @react-native-community/datetimepicker dependency — added to fix loop.
Task 13: minor (deferred): Riwayat pembayaran shows paid (subscriptions with checkout_id) + unpaid (action feed) only; expired/failed checkouts need a read-only migration later.
Task 13: review Needs fixes — Important: "Belum dibayar" lists payment_exception/checking_payment (paid customers told they haven't paid). Added: m1 raw error codes in Notifications (global no-internal-terms rule); m2 BuyScreen pushes /addresses → /alamat. Plus Rulings 33–35.
Task 13: minor (deferred): customerLink drops query for id-less mappings except /support (comment it); ChooseMenu lost the "draft stays, refresh and reopen" hint.
Task 13: fix round 1/5 (6 addressed, 0 open; commits f7d181f..ba85ae0)
Task 13: complete (commits d33069f, f7d181f, ba85ae0; review clean)
Task 13: minor (deferred): startup gate classifies signed-out by comparing error text with the current locale's labels (harmless race on English cold start; harden with both locales or an additive errorCode in mobile-core); gate unmounts the router while showing retry; started.current written during render; pushError shows whitespace-containing SDK messages verbatim (may be English).
Final review: With fixes — Important: (1) NOT_ALLOWED missing from route codes; (2) renewalDue ignores existing renewals (invites double payment); (3) fulfillment status 'issue' (Gagal diantar) not represented on the plate; (4) push-jobs.yml schedule never runs from v2 (GitHub schedules only on the default branch); (5) RUNBOOK/README release steps missing (push scheduler, env vars, migration order/--include-all, auth.users check).
Final: Ruling 36: the scheduler location for /api/jobs/push is a deploy decision outside this worktree (a push to main or a platform scheduler setting) — the fix pass documents both options in RUNBOOK and leaves the choice to Keefe — cost if wrong: timed pushes stay silent until chosen.
Final: Ruling 37: re-graded into the single fix pass (customer-visible failure modes): auth.users denial must not fail the whole customer read (exception → null); /api/jobs/push stops on a time budget below maxDuration; maintenance renewal insert uses on conflict do nothing; changeUntil includes the day when the cutoff is not today; null meals guarded in ReportProblem/DayScreen/Jadwal. — cost if wrong: a slightly larger fix pass.
Final: deferred (not blocking, flagged to Keefe): app claim always asks for SMS and silently switches an email-signed-in customer to a phone account; every failed load labelled "tidak ada koneksi"; no undo for a "Belum sampai" report; Libur state shows text instead of promoting the next delivery; caterer owner's login phone shown to all their customers (Ruling 19) — give caterers their own WhatsApp field before wider launch.
Final: fix pass (2dca51a backend, 6c30338 domain+app, 49bb4b2 docs) — verification: typecheck, build, root 460, customer 235, caterer 65, test:postgres 40.
Final: re-review — all 10 addressed, no new Critical/Important. Final review clean.
Final: minor (deferred): DayScreen shows "Ada kendala" + Ubah hari for a failed meal; errorLabel lacks NOT_ALLOWED (Plate has its own copy); RUNBOOK §6 says /api/jobs every minute but vercel.json is daily; push run can approach maxDuration in the worst case.
