# Predictive back and Android bar-hiding spike

Date: October 10, 2026. Branch `task-7`. Plan: Phase E, Task 7.

This is a report-first spike. It has two questions.

1. Can the Android apps (customer and kitchen) use the system predictive back gesture without breaking Back?
2. Can the Android tab bar slide away while a list scrolls, the way the iOS bar minimizes?

Nothing was run on a device. This machine has no JDK and no Android SDK platforms or build tools, so a development build is not possible here. Everything below comes from reading the code in `node_modules`, the two upstream issues named in the text, and Material's published API. Each claim that needs a device is marked "To check".

Versions read: react-native 0.86.3, react-native-screens 4.26.2, expo-router 57.0.20, `@expo/config-plugins` 57.0.9, Expo SDK 57, target SDK 36, Material Components 1.13.0 (the version react-native-screens pulls in).

## Recommendation

| Piece | Call | Why |
| --- | --- | --- |
| Predictive back flag plus root-back plugin | No-go to enable today. Go to run the device spike next. | No check has run. The flag alone may stop Back reaching JS on API 33 to 35. The plugin has not been compiled. |
| In-app back peek (the previous screen shows while dragging) | No-go. | react-native-screens 4.26.2 has no back progress code at all. Upstream says it is unlikely in v4. |
| Android tab bar hides on scroll | No-go to ship. Go to run a spike only if the owner still wants it after seeing the cost. | It needs a patch to a library's native source, a new dependency, and a change to every scroll view. Android's bar stays fixed until a spike passes. |

Both drafts are on this branch in a second commit. Neither is wired into `apps/customer/app.config.ts` or `apps/caterer/app.config.ts`. `predictiveBackGestureEnabled` is not set. The apps are unchanged.

## 1. What the code does today

### 1.1 Back reaches JS through one always-on callback

- `react-native/ReactAndroid/src/main/java/com/facebook/react/ReactActivity.java:31-39` creates an `OnBackPressedCallback(true)`. It is enabled when created. When it runs, it switches itself off, calls `onBackPressed()`, then switches itself on again.
- `ReactActivity.java:62-64` adds that callback to the activity's dispatcher only when `AndroidVersion.isAtLeastTargetSdk36(this)` is true. That helper is in `react/util/AndroidVersion.kt`. It needs the device to run API 36 or higher and the app to target 36 or higher. On API 33 to 35 the callback is never added.
- `ReactActivity.java:115-119`: `onBackPressed()` asks the React delegate first. `ReactHostImpl.kt:356-365` answers by emitting `hardwareBackPress` to JS and returning true.
- `react-native/Libraries/Utilities/BackHandler.android.js` runs the JS listeners, last added first. If none returns true it calls `BackHandler.exitApp()`. That calls `invokeDefaultBackPressHandler` (`DeviceEventManagerModule.kt:55-59`) on the UI thread.
- `ReactActivity.java:122-130` (`invokeDefaultOnBackPressed`) switches the callback off, runs the default back (which leaves the activity), then switches the callback on again. The comment says this is so custom back handling works after the app returns from the background.

So today, while the app runs on API 36, an enabled callback always exists. The system sees that the app wants to handle Back itself, so it never plays its back-to-home preview.

### 1.2 The manifest flag is off

- `@expo/config-plugins/build/android/PredictiveBackGesture.js:31` writes `android:enableOnBackInvokedCallback` on the `<application>` element. `:36` gives `"true"` only when `android.predictiveBackGestureEnabled === true`. Anything else, including the field being missing, writes `"false"`.
- Neither app sets the field (`apps/customer/app.config.ts` and `apps/caterer/app.config.ts` have no such line), so both write `"false"`.
- Believed, not checked: Android 16 ignores that opt-out for apps that target 36. If so, the flag only changes behavior on API 33 to 35. This is the first thing the device run should confirm.

### 1.3 expo-router and the app use plain BackHandler listeners

- `expo-router/build/fork/useBackButton.native.js` adds one `hardwareBackPress` listener. It calls `goBack()` when the navigator's `canGoBack()` is true and returns true. Otherwise it returns false.
- The tab router uses `backBehavior = 'initialRoute'` (`expo-router/build/native-tabs/NativeBottomTabsNavigator.js:52`). So Back from the Jadwal, Jelajah or Akun root goes to Beranda inside the app. Only the Beranda root, with nothing pushed, has nowhere to go. That is the only place where the system back-to-home preview could play.
- `apps/customer/src/buy/PaymentScreen.tsx:75-78` adds its own listener once a payment is paid. It sends the user to `/` and returns true. This is the "paid is final" guard. Bayar is a pushed screen, so the root navigator can go back there and the guard keeps running.
- No other file in `apps` or `packages` uses `BackHandler`.

### 1.4 react-native-screens 4.26.2 has no back progress

- A search of `react-native-screens/android` for `handleOnBackProgressed`, `handleOnBackStarted`, `OnBackAnimationCallback`, `OnBackInvokedCallback` and `BackEventCompat` finds nothing.
- The only back callbacks in the library are `FragmentBackPressOverrider.kt` (used only by `CustomSearchView.kt:31`) and `gamma/stack/screen/PreventNativeDismissCallback.kt:13`. Neither reports drag progress.
- The classic stack pops through JS (section 1.1). The newer "gamma" stack under `react-native-screens/experimental` has no progress code either.
- Upstream, `react-native-screens` discussion 2540: a maintainer wrote in July 2025 that predictive back is highly unlikely in v4 because it conflicts with synchronous fragment transactions. He said a later major might try it, "months away". No version is named. So the answer to "which react-native-screens version would add in-app back progress" is: none is known, and it is not 4.26.2.

### 1.5 The tab bar's `hidden` is a plain visibility switch

- `expo-router/build/native-tabs/NativeTabsView.android.js:26` passes `hidden` to the host as `tabBarHidden`.
- `react-native-screens/android/.../gamma/tabs/appearance/TabsAppearanceApplicator.kt:38` does `bottomNavigationView.isVisible = !isTabBarHidden`. The bar goes from visible to gone. There is no animation.
- `TabsContainer.kt:165-172` and `:747-754`: when `tabBarHidden` flips, the bottom inset reported to the content drops from the bar's height to 0. The content lives in a `SafeAreaView` with a bottom edge inset (`NativeTabsView.android.js`, wrapper around `ScreenContent`). So the page is resized in one frame. That is the snap and content move the audit described.
- Layout: `TabsContainer` is a `FrameLayout` (`:53`). Its two children are `contentView`, full size, and the `BottomNavigationView` pinned to the bottom (`:130-157`, `:175-177`). The content gets the bar's height as a bottom inset (`getInterfaceInsets`, `:389`).
- iOS is separate. Both apps already pass `minimizeBehavior="onScrollDown"` (`apps/customer/app/(tabs)/_layout.tsx:45`, `apps/caterer/app/(tabs)/_layout.tsx:51`). That prop is for iOS. Android ignores it.

### 1.6 Expo Go

Expo Go uses its own manifest and native code. Catera's manifest flag, plugins and patches do nothing there. The apps must keep running in Expo Go without any of this. Both drafts are written so that Expo Go sees no change (section 3 and 4).

## 2. The device verification procedure

Do this on a throwaway branch named `task-7-device`, cut from `task-7`. Do not merge that branch.

### 2.1 Tools to install (owner approval needed)

The versions come from `node_modules/react-native/gradle/libs.versions.toml` (compileSdk 36, build tools 36.0.0, NDK 27.1.12297006, AGP 8.12.0).

Local build path. These commands are for the owner to run. The spike did not run any of them.

```
winget install EclipseAdoptium.Temurin.17.JDK
setx JAVA_HOME "C:\Program Files\Eclipse Adoptium\jdk-17.<current>"
winget install Google.AndroidStudio
```

Open Android Studio once and let its setup wizard install the Android SDK. The default place is `%LOCALAPPDATA%\Android\Sdk`. Then go to Settings, Languages and Frameworks, Android SDK, SDK Tools, and tick "Android SDK Command-line Tools (latest)". That gives `sdkmanager` and `avdmanager`.

Without Android Studio: download "Command line tools only" for Windows from developer.android.com/studio. Unzip it so that `sdkmanager.bat` sits in `%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest\bin`.

Either way, point the tools at the SDK and put them on the path. Open a new terminal afterwards.

```
setx ANDROID_HOME "%LOCALAPPDATA%\Android\Sdk"
setx PATH "%PATH%;%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest\bin;%LOCALAPPDATA%\Android\Sdk\platform-tools;%LOCALAPPDATA%\Android\Sdk\emulator"
```

Then install `adb` (in `platform-tools`), the emulator, the build parts and the system images, and create the emulators.

```
sdkmanager "platform-tools" "emulator"
sdkmanager "platforms;android-36" "build-tools;36.0.0" "ndk;27.1.12297006" "cmake;3.22.1"
sdkmanager "system-images;android-34;google_apis_playstore;x86_64" ^
           "system-images;android-35;google_apis_playstore;x86_64" ^
           "system-images;android-36;google_apis_playstore;x86_64"
avdmanager create avd -n catera-34 -k "system-images;android-34;google_apis_playstore;x86_64" -d pixel_8
avdmanager create avd -n catera-35 -k "system-images;android-35;google_apis_playstore;x86_64" -d pixel_8
avdmanager create avd -n catera-36 -k "system-images;android-36;google_apis_playstore;x86_64" -d pixel_8
```

The Play Store images are chosen on purpose. They include TalkBack, which the Step 5 check needs. (To check: the exact `sdkmanager` package names for API 36 images.)

Build once and install on each emulator:

```
cd C:\wt\3\apps\customer
npx expo prebuild --platform android --clean
npx expo run:android --variant debug          # builds, installs on the running emulator
adb -s emulator-5554 install -r android\app\build\outputs\apk\debug\app-debug.apk   # reuse the APK for the other AVDs
npx expo start --dev-client
adb reverse tcp:8081 tcp:8081
```

EAS path (needs `eas login` by the owner, and an EAS build is billed or queued):

1. Add this profile to `apps/customer/eas.json` on the throwaway branch:

```json
"spike-android": {
  "extends": "development",
  "android": { "buildType": "apk" },
  "env": { "CATERA_SPIKE_BACK": "1" }
}
```

2. In `apps/customer/app.config.ts` on the throwaway branch only, add `predictiveBackGestureEnabled: process.env.CATERA_SPIKE_BACK === "1"` under `android`.
3. Run `eas build --profile spike-android --platform android`, download the APK, then `adb install -r` it on each emulator.

Run a second build with the flag off as the baseline. Compare every row of the table below against that baseline.

### 2.2 Emulator setup per API level

- Start each AVD from the Android Studio device manager or `emulator -avd catera-34`.
- Gesture navigation: `adb shell cmd overlay enable com.android.internal.systemui.navbar.gestural`.
- Three-button navigation (for the hardware path): `adb shell cmd overlay enable com.android.internal.systemui.navbar.threebutton`.
- Hardware back: `adb shell input keyevent KEYCODE_BACK`.
- Gesture back: the audit found that a plain `adb shell input swipe` from the edge did not trigger it. Use a long swipe that starts at x=1 (`adb shell input swipe 1 1400 600 1400 3000`). If that still does nothing, drag with the mouse in the emulator window.
- To see the preview, take a screenshot during the held swipe: `adb exec-out screencap -p > preview.png`.
- Predictive back animations: on API 34 and 35 turn on "Predictive back animations" in Developer options. (To check: on API 33 the option may be a `setprop`.)
- Watch JS receive Back: `adb logcat -s ReactNativeJS` with a temporary `console.log` in a throwaway listener, or run the Bayar check, which has its own visible effect.
- Use the explicit demo mode of the customer app. Never use real customer data.

### 2.3 Step 2: what to record with the flag on

Do each row twice, once with hardware (three-button) back and once with gesture back, on API 34, 35 and 36. That is 6 columns. Mark each cell pass or fail.

| # | Check | Pass means |
| --- | --- | --- |
| 1 | Pushed screen. From Beranda open a plan (`/subscriptions/{id}`) and press Back. | Exactly one screen pops. Beranda shows. The tab bar stays visible. |
| 2 | Sheet. Open a sheet (for example Ganti hari) and press Back. | Only the sheet closes. The screen behind it stays. |
| 3 | Bayar paid guard. Finish a demo payment so Bayar shows the paid state, then press Back. | The app lands on Beranda. It never shows Beli again. |
| 4 | Leave from a tab root. On Beranda with nothing pushed, press Back. | The app leaves to the launcher. Opening it again resumes it. |
| 5 | Other tab roots. On Jadwal, press Back. | The app goes to Beranda. A second Back leaves. |
| 6 | Preview. On Beranda with nothing pushed, hold a gesture mid-swipe. | The system back-to-home preview shows: the app window shrinks and the launcher shows behind it. |
| 7 | Cold launch. Force-stop the app (`adb shell am force-stop` with the app id), open it, and press Back on Beranda as soon as it shows. This row must run on API 34 and 35. Run it on 36 too. | The app leaves to the launcher on the first press. It never stays on Beranda while Back is pressed again and again. |

Extra checks to log, not part of the go rule: Back while the keyboard is open (the keyboard should close first), Back right after returning from the background, and Back after a rotation.

Expected result before running (from the code and issue 58407, not seen): with the flag on and no plugin, rows 1 to 5 may fail on API 33 to 35 because Back never reaches JS (section 3.2), and row 6 fails on every level because React Native's callback is still on.

### 2.4 Step 3: repeat with the plugin

Apply the plugin steps in section 3.4 on the throwaway branch, rebuild, and repeat section 2.3 for all three API levels.

### 2.5 Step 4: the go rule

Ship the flag and plugin only if every row 1 to 7 passes on all three API levels, both back types. If any cell fails:

- Commit only this report, with the failing cells filled in.
- Leave `predictiveBackGestureEnabled` unset.
- Note that in-app back progress needs a react-native-screens release that adds it. None is known (section 1.4).

### 2.6 Step 5: the hide-on-scroll go rule

Use the same build, with the patch described in sections 4.2 and 4.3 applied. To apply it on the throwaway branch:

1. Add `patch-package` as a root dev dependency: `npm install --save-dev patch-package`.
2. Add `"postinstall": "patch-package"` to `scripts` in the root `package.json`.
3. Run `npm install`. The postinstall step applies `patches/react-native-screens+4.26.2.patch`. Check that its output says the patch was applied.
4. Add `nestedScrollEnabled` to the page ScrollView at `packages/mobile-ui/src/components.tsx:443`.
5. Rebuild the development client (section 2.1).

Then use the customer app, on the Beranda or Jadwal tab, with a list long enough to scroll.

| Check | How to measure | Pass means |
| --- | --- | --- |
| Slides, no snap | `adb shell screenrecord --time-limit 20 /sdcard/s.mp4`, pull it, step through frames | The bar shows at least 8 in-between positions while it leaves and returns. It never jumps. |
| Content does not jump | `adb shell uiautomator dump` before and after the slide with the finger lifted. Compare the top bound of one list row. | The row moves only as far as the finger scrolled it. Nothing shifts when the bar finishes sliding. |
| Returns on any upward scroll | Scroll down until the bar is out, then scroll up by about 20 dp. | The bar starts back at once. |
| Returns at the top of a list | Scroll down, then jump to the top (drag fast or tap the active tab). | The bar is fully back. |
| Returns on a tab switch | With the bar slid out, switch tabs without touching the bar: `adb shell am start -a android.intent.action.VIEW -d catera://jadwal`. In a second run, scroll up a little and tap a tab. | The bar is in on the new tab. |
| TalkBack | Turn TalkBack on (Settings, Accessibility). Scroll with two-finger swipes. | The bar never hides, and the tabs stay reachable and read out. |
| Expo Go | Install Expo Go for SDK 57 and open the app with `npx expo start` (no dev client). | The app runs. The bar is fixed. No crash. |

Anything that fails: record the cost in the report and leave Android's bar fixed.

## 3. Design: the root-back-callback plugin

Draft files: `plugins/with-root-back-callback.cjs` and `plugins/root-back/`.

### 3.1 The idea

The system plays its back-to-home preview only when the app has no enabled back callback. React Native's callback is always enabled. So the plugin adds a switch:

- JS knows if the root navigator can go back. `useNavigationContainerRef().canGoBack()` answers it for the whole focused path, including the tab router's `initialRoute` rule.
- JS tells native through one function, `setRootCanGoBack(boolean)`.
- Native turns React Native's callback off when the answer is false, and on when it is true.

### 3.2 Why a native module is needed

- JS has no way to turn a native callback off. `BackHandler` only adds listeners and can exit. A listener cannot remove the enabled callback, so the system still sees the app as handling Back.
- ReactActivity's callback is a private field (`ReactActivity.java:31`). The draft finds it by type with reflection, so a renamed field still works. If R8 renames the class itself the lookup returns null and the module does nothing. The default builds do not minify, but this must be checked on a release build.
- React Native turns its callback back on after every back event (`ReactActivity.java:37` and `:129`). The module cannot stop that. So JS reports the state again after every navigation state change, when the navigation container becomes ready, when a hold is added or removed, and when the app returns to the foreground. The order works out because JS runs after the native code that re-enables the callback, so the later "off" wins. (To check: a quick double press of Back.)

### 3.3 The API 33 to 35 gap

React Native issue 58407 reports that with `enableOnBackInvokedCallback="true"`, `hardwareBackPress` never reaches JS on API 33 to 35. The reason given is that `ReactActivity` adds its callback only on API 36 (section 1.1). With no callback, Back falls through to `finish()`. The issue says API 36 is not affected. It is still in triage and unchanged on 0.86.3 and main, per a comment on the issue.

The draft module covers this. On API 33 to 35 it adds its own callback that sends Back to JS, as ReactActivity's does. It follows the same "root can go back" switch. It differs in one way: after it runs it stays off, and the next JS report turns it on again.

That difference matters. The first draft switched its callback on again right after `onBackPressed()`, as ReactActivity does. That causes a Back loop. When no JS listener takes Back, `BackHandler.exitApp()` reaches `invokeDefaultOnBackPressed` (`ReactActivity.java:122-130`). That turns off only React Native's own callback, then asks the dispatcher again. The dispatcher finds the module's callback still on and calls it. JS gets `hardwareBackPress` again, falls through again, and so on. On API 33 to 35 the user cannot leave the app.

Two cases led into the loop. One is a hold (`useKeepBackForJs`) at a root. The other is the launch window. JS says "can go back" until the container is ready, and the first draft did not report again until the first navigation, because the `state` event does not fire on ready. So a Back on Beranda right after a cold launch went into the loop. The fixed draft keeps the callback off after it runs, and JS also reports on the container's `ready` event. Row 7 in section 2.3 checks this.

The cost of staying off: if a JS listener handles Back without changing the navigation state, nothing reports, and the next Back on API 33 to 35 goes to the system. Such a listener must call `reportRootBackAgain()`. No such listener exists today. The Bayar guard always navigates to Beranda.

A recreated activity (after a rotation or a theme change) has a new dispatcher. The module remembers which activity it added its callback to, and adds a new one when the activity changes.

### 3.4 How to enable the draft (throwaway branch only)

1. `apps/customer/app.config.ts`: set `android.predictiveBackGestureEnabled: true` and add `"../../plugins/with-root-back-callback.cjs"` to `plugins`.
2. `apps/customer/package.json`: add `"expo": { "autolinking": { "nativeModulesDir": "../../plugins" } }` so Expo autolinks `plugins/root-back` as a local module.
3. `apps/customer/app/_layout.tsx`: call `useReportRootBack()` once. Any screen that keeps its own `BackHandler` listener at a root must call `useKeepBackForJs()` while mounted. A listener that returns true without navigating must call `reportRootBackAgain()`.
4. Repeat for the kitchen app after the customer app passes.

The plugin file is `.cjs` because the repo root `package.json` says `"type": "module"`. The plugin does one job: it stops the prebuild if the manifest flag is not `"true"`.

### 3.5 Risks

- Issue 58407 (above). Enabling the flag without the module is the main risk. The flag must never ship alone.
- Reflection on a private field. A React Native update can move or remove the field. The module then does nothing and the preview does not play, but Back still works.
- Back loop on API 33 to 35 (section 3.3). If the module's callback is still on when `invokeDefaultOnBackPressed` asks the dispatcher again, Back goes to JS forever and the user cannot leave the app. This is the worst failure. The draft prevents it by keeping the callback off after it runs. Rows 4 and 7 check it on API 34 and 35.
- Race at the end of a back event (section 3.2). A wrong order would leave Back disabled at a screen that needs it. The system then leaves the app instead of going back one screen. The double-press check covers it.
- A listener that handles Back without navigating (section 3.3). On API 33 to 35 the next Back leaves the app, unless that listener calls `reportRootBackAgain()`.
- Other JS listeners. At a root, a listener that wants Back would be skipped once the callback is off. Today only the Bayar guard exists and Bayar is a pushed screen. `useKeepBackForJs` is the escape hatch.
- Leaving the app: with the callback off, the system decides what leaving means. Today the app finishes. On Android 12 and later the system usually moves the task to the back. Check row 4 resumes the app correctly.
- The Kotlin and the module config have not been compiled. They follow `node_modules/expo-haptics/android` as a template.
- Android's back preview only covers leaving the app. The in-app peek stays unavailable (section 1.4).

### 3.6 Cost

About 100 lines of new code in two small folders. About one working day to build, run the matrix on three emulators, and fix what fails. Then the same again for the kitchen app, and a re-check at every Expo SDK bump, because it depends on `ReactActivity`'s private field.

## 4. Design: Android hide-on-scroll

Draft file: `patches/react-native-screens+4.26.2.patch`. It was created against the real 4.26.2 source and `git apply --check` accepts it. It has not been compiled.

### 4.1 The approach

Material has a behavior made for this. `HideViewOnScrollBehavior` (older name `HideBottomViewOnScrollBehavior`) slides a view off the bottom edge when a nested scroll goes down and back in when it goes up. It has `slideIn`, `slideOut`, a state listener and `disableOnTouchExploration`. It needs three things:

1. The bar must be a direct child of a `CoordinatorLayout`.
2. The scroll view must send nested scroll events up to that `CoordinatorLayout`. Android walks up the parent chain, and parents that do not take part are skipped, so React Native's view groups in between are fine.
3. The scroll view must have nested scrolling turned on. React Native's `nestedScrollEnabled` prop does that (`ReactScrollViewManager.kt:202-206`). It is off by default.

### 4.2 What the patch changes

`TabsContainer.kt` (the container that owns the `BottomNavigationView`):

- Puts the content view and the bar inside a new `CoordinatorLayout`, and puts that in the container.
- Gives the bar `CoordinatorLayout.LayoutParams` with bottom gravity and the behavior.
- Walks the coordinator's children when it passes insets, so the bar keeps its own inset logic.
- Slides the bar in when the user changes tab.
- Treats the bar as zero height for the content inset while it is slid out, so the list uses the freed room.

New file `BarHideOnScrollBehavior.kt`:

- Extends `HideViewOnScrollBehavior`, edge bottom.
- Calls `disableOnTouchExploration(true)` so the bar never hides when TalkBack is on.
- Overrides `onNestedScroll` to slide the bar in whenever the list cannot scroll up any further (at the top).
- Reports slid-out or slid-in so the container can update the inset.

Also needed, in app code and not in the patch: `nestedScrollEnabled` on the page's ScrollView in `packages/mobile-ui/src/components.tsx:443`. That change is Android-only and harmless in Expo Go.

### 4.3 How the patch reaches a build

- Add `patch-package` as a root dev dependency and `"postinstall": "patch-package"` to the root `package.json`.
- Keep the patch in `patches/`. The file name carries the version, `react-native-screens+4.26.2.patch`.
- EAS runs `npm ci`, which runs `postinstall`, so cloud builds get the patch too.
- A config plugin cannot do this job. The change edits a Kotlin class inside a library, not the generated app project.
- Expo Go ships its own binaries. The patch does not touch it, so the app runs there with a fixed bar.

### 4.4 To check on a device or at build time

- The exact signature of `onNestedScroll` and the listener type in Material 1.13.0 (`javap` on the downloaded `material-1.13.0` classes). The doc page read for this spike showed 1.14.0.
- Whether `HideViewOnScrollBehavior` reports the slid-out state at the start or the end of its animation. If it is at the start, the inset drops while the bar is still moving, and the content can jump. Fix: delay the inset change until the animation ends.
- Whether React Native's `ReactScrollView` sends the nested events with `nestedScrollEnabled` set. It extends the platform `ScrollView`, which supports nested scrolling as a child.

### 4.5 Risks

- Content jump. The bar's height is the content's bottom inset. If the inset changes while the bar slides, the page is resized. If it changes only at the end, there is a small viewport change at the bottom. If it never changes, an empty strip shows where the bar was.
- TalkBack. `disableOnTouchExploration(true)` is the answer in the draft. It has not been tried.
- Return on tab switch and at the top of a list. Both are in the draft. Neither has run.
- A fling that starts at the top. The behavior reacts to scroll deltas. A programmatic jump to the top gives no upward delta. The draft handles it by sliding in whenever the list cannot scroll up.
- One more native patch to carry. Each Expo SDK bump that moves react-native-screens breaks the patch file name. The build then fails loudly, which is good, but someone must redo the patch.
- Library coupling. The patch uses `TabsContainer` internals (`updateInterfaceInsets`, `onMenuItemSelected`). Upstream marks only a "Public API" region as stable (`TabsContainer.kt:49-52`).
- Every scrolling tab screen must opt in with `nestedScrollEnabled`. A screen that forgets it keeps a fixed bar. That is a safe failure.
- Android design guidance. Check the Material 3 navigation bar guidance before shipping. The owner asked for the behavior, but it is a departure from a fixed bar.

### 4.6 Cost

About 80 lines of Kotlin, one dependency, one JS prop, and a patch to maintain. About one to two working days including the device checks and the tuning of the inset. Re-check on every Expo SDK bump.

## 5. Open items nobody could determine tonight

- Everything marked "To check".
- Whether Android 16 ignores the manifest opt-out for apps that target 36. If it does, the flag only matters on API 33 to 35 and the real work is the plugin.
- Whether the Expo template's `MainActivity` overrides `invokeDefaultOnBackPressed`. The template is generated at prebuild and is not in `node_modules`. Read `android/app/src/main/java/id/catera/*/MainActivity.kt` after the first prebuild. The module does not edit `MainActivity`, but an override there could change the leave-the-app path.
- A react-native-screens release that adds back progress. None is known.
