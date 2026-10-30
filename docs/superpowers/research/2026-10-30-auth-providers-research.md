# Sign-in with Google and Apple: Mobbin research (2026-10-30)

Question: how do food and ops apps lay out sign-up and sign-in when Google and Apple sit next to email (and sometimes phone)?

## Screens looked at (iOS)

Food and delivery:
- [Uber Eats](https://mobbin.com/screens/acc10634-b382-4059-b42b-fdbe210ce716): phone field and Continue first, then "or", then Apple, Google and Email as equal grey buttons.
- [Wolt](https://mobbin.com/screens/723685b7-c16b-45fd-88a5-c60c038e645b): no form, just a stack: Apple (black), Google (blue), Facebook, "Continue with email", guest link.
- [Zomato](https://mobbin.com/screens/1e0f485e-ea9c-4a51-9203-71fe645ec099): phone first; Google, Apple and email as three small icon tiles under "or".
- [Gopuff](https://mobbin.com/screens/86489867-b397-46f6-9da6-f0807f01cedd), [talabat](https://mobbin.com/screens/ecee4b4a-5b2a-485f-97ca-7086d245ff27): a stack of outlined "Continue with ..." buttons, phone being one of them.
- [Grubhub](https://mobbin.com/screens/35cf3caa-a0f2-4230-8e95-287825db6399): providers on top, then the email field.
- [Glovo](https://mobbin.com/screens/03731b67-ef2c-4644-9bef-f057e3a03637): phone with an SMS / WhatsApp choice, then Google and Apple outlined.
- [HelloFresh](https://mobbin.com/screens/9703ffa6-0346-466b-a8a2-728e02d852c6): Apple, Google, Facebook as icon tiles over an email field.

Sign-in with a password:
- [YNAB](https://mobbin.com/screens/d69a7261-af43-4e82-86dd-7d3e6dd5c8ad), [Peerspace](https://mobbin.com/screens/511e751e-8414-49dc-b32e-20d0ff7522ff), [Kitchen Stories](https://mobbin.com/screens/06c29765-7501-435d-9032-1fe678c903d7): providers on top, "or", email and password, Log in.
- [The Infatuation](https://mobbin.com/screens/c96964ae-1e02-46c0-aadc-126bbea5e99d), [Hevy](https://mobbin.com/screens/e11431c6-fd32-43e2-89fc-14d28ab46820), [MyFitnessPal](https://mobbin.com/screens/7336baf0-22a8-4e07-be82-59bd383432a4), [Realtor.com](https://mobbin.com/screens/2684bd8a-f324-4f90-af6e-4e3f100f47e5): email and password first, Log in, forgot password, then "or" and the providers.

Business sign-up (email and password):
- [Airwallex](https://mobbin.com/screens/b89e2cbe-2517-4292-ba5f-324180a292b0): business email, names, password, one screen.
- [Woolworths](https://mobbin.com/screens/8ea4cad8-13ef-4958-a5d4-e3701b051ac6): email with "we use this to verify your account", password with live rules.
- [foodpanda for business](https://mobbin.com/screens/94cced55-da2e-43e1-b756-e166b847f55c): one long form ending in a mobile number field, no verification step shown.

## Patterns

1. **Consumer food apps put the one-tap providers first.** Wolt, Gopuff, talabat and Grubhub show providers before any form. Email is a button that opens its own step, not a field on the first screen.
2. **Sign-in and sign-up are the same screen.** Every food app uses "Continue with ...". A new Google or Apple account is created on the spot, so there's no separate Daftar page for providers.
3. **Full-width buttons, same size, one style.** Apple and Google get equal-width rows with the official logo at the start edge. Wolt is the only one that colours them (Apple black, Google blue). Most use one neutral outlined or filled-grey style for all of them.
4. **Apple goes first on iOS.** Uber Eats, Wolt, YNAB, Peerspace and Realtor.com put Apple above Google, matching Apple's guidance that its button is at least as prominent as the others. On Android, Apple is absent.
5. **Ops and business apps lead with the form.** Where a password matters (YNAB, Hevy, Realtor.com, Airwallex), the email and password are first and providers sit under "or", or aren't offered at all.
6. **Legal line at the bottom.** "By continuing, you agree to ..." sits in small text near the bottom, not as a checkbox, on almost every provider screen.
7. **The phone field never asks for proof in business sign-up.** foodpanda for business takes the mobile number as a plain form field.

## What this means for Catera

- **Customer Masuk:** the mascot heading, then Apple (iOS only), Google, then "Lanjut dengan email" leading to the existing email and password step. Same buttons for sign-in and sign-up; the Daftar link stays for email only.
- **Dapur Daftar:** a single form like Airwallex: business name, email, password, WhatsApp number (format check only, plus a "Cek di WhatsApp" link), kitchen area. Then the existing "Cek emailmu" step.
- **Dapur Masuk:** email and password only, with the method tabs removed.
- **Buttons:** one neutral outlined style for all providers, the official logos, full width, 48dp or more, Apple first on iOS.

## Stepped sign-up (owner request, 2026-10-30)

- [Jobber onboarding](https://mobbin.com/flows/ea4b5dc8-8cbc-4765-b93d-f3bb8e0c2b29): a thin progress bar at the top, one topic per screen (your details, your business), a big title and a short line, Next pinned at the bottom.
- [MyFitnessPal](https://mobbin.com/screens/d90cdceb-a10b-4348-a91e-1d1d0c78bc4f): a segmented bar, and the account (email and password) is the last step: "Almost done! Create your account."
- [Zopa](https://mobbin.com/screens/72cd57c2-e728-4c58-9171-75e223e500ee): segments plus a "7/8" count next to them.
- [Grab Driver registration](https://mobbin.com/flows/daf3d277-0877-4f00-9708-8f06dce968c9): progress bar, one section per screen.
- [Chime](https://mobbin.com/screens/0ce2d86a-ae4a-4dbd-b04f-1197d195502b), [Cleo](https://mobbin.com/screens/c9131902-6f9b-432c-8c95-da01895126c7): named or numbered step circles. These suit long, regulated flows more than a four-step sign-up.

Taken for Catera: a segmented bar with an "n/N" count beside the back button, one topic per step, the account last, Lanjut pinned at the bottom. Dapur Daftar has 4 steps (name, area, WhatsApp, account). Staff Gabung has 2 (code, account). Customers get 2 steps after their first sign-in (name, WhatsApp, which they can skip). Customers already browse without an account, so nothing else is asked before home.
