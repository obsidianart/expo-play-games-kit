# expo-play-games-kit

[![npm version](https://img.shields.io/npm/v/expo-play-games-kit)](https://www.npmjs.com/package/expo-play-games-kit)
[![CI](https://github.com/obsidianart/expo-play-games-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/obsidianart/expo-play-games-kit/actions/workflows/ci.yml)
[![MIT license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Google Play Games achievements and Apple Game Center for Expo, through one TypeScript API.**

Sign players in, unlock achievements, sync progress, and open the native achievements screen. On Android, also send Game Stats and request Recall session IDs for your backend.

Built while adding game services to Imagzle and Imagzle Minigames. Includes an Expo config plugin for native setup.

[Quick start](#quick-start) · [Example app](example/README.md) · [API](#api) · [Troubleshooting](#troubleshooting) · [Level Up](#google-play-games-level-up)

## Features and limits

| Feature | Android | iOS | Web |
|---|---|---|---|
| Platform authentication and player profile | Play Games Services v2 | Game Center | Unavailable |
| Standard and incremental achievements | Yes | Yes | No-op |
| Native achievements screen | Yes | Yes | No-op |
| Game Stats events and progression | Yes | No-op | No-op |
| Recall session ID | Yes; backend linking required | Unavailable | Unavailable |
| Server-side access code | Yes; backend exchange required | Unavailable | Unavailable |

Leaderboards, PGS Saved Games, and Play Billing reward fulfillment are **not included**. Recall does not save or restore game progress by itself. Use your own backend for cloud saves and account linking.

## Requirements and validation

- **Use a native development or production build. Expo Go is not supported.** Adding this module or changing its plugin options requires a new native build; an OTA JavaScript update is not enough.
- iOS **16.4+**, as declared by this package's podspec. Your app and provisioning profile need Game Center enabled.
- Android: a configured Play Games Services project and a device or emulator with Google Play services. The library bundles `play-services-games-v2` **22.0.0**.
- React Native projects must have Expo Modules installed. The config plugin is intended for Expo prebuild/CNG projects.

| Validation | Current coverage |
|---|---|
| Library development dependencies | Expo 57 / React Native 0.82 |
| Included example dependencies | Expo 57 / React Native 0.86 |
| CI | TypeScript build, ESLint, Android Kotlin compilation |
| iOS builds and device behavior | Not covered by CI; verify in your app |

These are the repository's configured versions, not a promise of support for every Expo/RN combination. See [package.json](package.json) and [example/package.json](example/package.json) for exact versions. When reporting a problem, include your versions, platform, and build type.

## Quick start

### 1. Install

```sh
npx expo install expo-play-games-kit
```

### 2. Configure the plugin

Add this entry to your existing `app.json` plugins array:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-play-games-kit",
        { "androidAppId": "YOUR_NUMERIC_PGS_PROJECT_ID" }
      ]
    ]
  }
}
```

Replace the placeholder with the numeric project ID from **Play Console → Play Games Services → Setup and management → Configuration**. It is not your Android package name or OAuth client ID. Keep it a string. The plugin writes the required Android string resource and adds the iOS Game Center entitlement.

**Android setup:**

1. Create or select the PGS project for your game in Play Console.
2. Link Android credentials matching your package name and signing certificate. Local debug, EAS builds, and Play-distributed builds can have different certificates; Play builds use the **Play app signing** certificate, not the upload certificate.
3. Add your test account under PGS testers when testing unpublished configuration.
4. Create achievements and copy their generated IDs into your app. For step-based calls, configure incremental achievements with the matching total.
5. Publish the PGS configuration when ready for all players. This is separate from publishing your app release.

**iOS setup:**

1. Use your app's registered bundle identifier and enable Game Center for it in Apple Developer/App Store Connect.
2. Create achievements in App Store Connect and use those IDs in your app.
3. Build with a provisioning profile that includes the Game Center entitlement. The plugin cannot create your Apple records or signing profile.
4. Ensure your app's deployment target is at least 16.4.

### 3. Build the native app

```sh
npx expo run:android
# Or, on macOS with Xcode:
npx expo run:ios
```

An EAS native build is also an option. For projects that commit native directories, make sure plugin changes are applied to those projects before rebuilding.

### 4. Unlock an achievement

Use real IDs from each store. Call this from an async event handler and handle errors in your app:

```ts
import * as PlayGamesKit from 'expo-play-games-kit';

export async function unlockFirstPuzzle() {
  if (!PlayGamesKit.getCapabilities().achievements) return;

  let state = await PlayGamesKit.isAuthenticated();
  if (!state.isAuthenticated) state = await PlayGamesKit.signIn();
  if (!state.isAuthenticated) return; // Player cancelled or sign-in failed.

  await PlayGamesKit.unlockAchievement({
    android: 'YOUR_PLAY_ACHIEVEMENT_ID',
    ios: 'first_puzzle',
  });
  await PlayGamesKit.showAchievements();
}
```

Android attempts automatic sign-in at module startup; iOS installs GameKit's authentication handler. `isAuthenticated()` reads state without opening UI. `signIn()` can show platform UI; a cancelled sign-in resolves with the resulting state.

## Sync achievement progress

If your game already tracks progress, send an absolute value. Re-sending the same progress is safe:

```ts
await PlayGamesKit.setAchievementSteps(
  { android: 'YOUR_INCREMENTAL_ACHIEVEMENT_ID', ios: 'solve_100' },
  42,
  100,
);
```

The Android achievement must be configured for 100 steps. iOS uses the total to convert steps to a percentage. Neither platform's achievements should replace your game's own save data.

Subscribe to authentication changes so you can retry synchronization after sign-in, and remove the listener when its owner unmounts:

```ts
const subscription = PlayGamesKit.addAuthenticationListener((state) => {
  console.log('Signed in:', state.isAuthenticated);
});

// Cleanup:
subscription.remove();
```

## Game Stats and Recall

On Android, event names and properties must match the schema you configure in Play Console. The following is an example schema, not a built-in one:

```ts
if (PlayGamesKit.getCapabilities().gameStats) {
  await PlayGamesKit.recordGameEvent('level_solved', { score: 812 });
  await PlayGamesKit.recordProgress(42);
  await PlayGamesKit.uploadGameEvents();
}
```

Record events as gameplay happens; request an upload after a level or when the app goes to the background. A resolved call alone does not prove that a stat appeared in the player's profile.

```ts
if (PlayGamesKit.getCapabilities().recall) {
  const sessionId = await PlayGamesKit.requestRecallAccess();
  // Send to your backend for PGS Recall account linking.
}
```

Server access codes similarly require your backend to exchange the code. Do not place client secrets in the app. Guard Recall and server-access calls with capability checks: they reject on unsupported platforms and Android builds without an APP_ID.

### API

| Function | Android | iOS | Notes |
|---|---|---|---|
| `getCapabilities()` | ✅ | ✅ | Synchronous feature flags |
| `isAuthenticated()` | ✅ | ✅ | Never shows UI |
| `signIn()` | ✅ | ✅ | Shows platform UI when needed |
| `getPlayer()` | ✅ | ✅ | `null` when signed out |
| `unlockAchievement(id)` | ✅ | ✅ | |
| `revealAchievement(id)` | ✅ | ✅* | *iOS resolves immediately (GameKit auto-reveals) |
| `incrementAchievement(id, steps, totalSteps?)` | ✅ | ✅ | `totalSteps` required on iOS |
| `setAchievementSteps(id, steps, totalSteps)` | ✅ | ✅ | Absolute + idempotent — prefer this |
| `showAchievements()` | ✅ | ✅ | Native UI |
| `requestServerSideAccess(clientId, forceRefresh?)` | ✅ | ❌ | Rejects on iOS |
| `recordGameEvent(name, properties?)` | ✅ | ➖ | Game Stats; no-op where `capabilities.gameStats` is false |
| `recordGameEvents(events)` | ✅ | ➖ | Batch form |
| `recordProgress(currentProgress)` | ✅ | ➖ | The `progressUpdate` event |
| `uploadGameEvents()` | ✅ | ➖ | Flush recorded events |
| `requestRecallAccess()` | ✅ | ❌ | Recall session id; rejects on iOS |
| `addAuthenticationListener(fn)` | ✅ | ✅ | |

All achievement calls accept `string | { android?: string; ios?: string }` and resolve as a no-op when the current platform has no id.

### Game Stats notes

- Requires `play-services-games-v2` 22.0.0 or later (bundled) and a stat schema uploaded in Play Console (repetitive stats, progression stats, localisation CSVs). Events the schema does not declare are dropped by the SDK.
- Numbers are sent as INT when integral, DOUBLE otherwise; strings and booleans pass through. Up to 25 properties per event.
- Stats may not be driven by purchases or ad views, and competitive stats need an hourly cap in the schema — both are Play's rules, not the library's.

## Builds without Play Games

For an Android variant that should not use PGS, keep the plugin but omit `androidAppId`:

```json
["expo-play-games-kit", { "iosGameCenterEntitlement": false }]
```

The plugin strips the PGS SDK's initialization provider and related activities from that Android build. Android capabilities are all `false`; authentication reports signed out, while achievement and Game Stats calls become no-ops. Recall and server-access calls still reject.

`iosGameCenterEntitlement: false` only stops the plugin from adding the iOS entitlement. It does **not** disable the iOS module or remove an entitlement already supplied elsewhere. Review each variant's native configuration and app behavior separately. This option alone is not a children's privacy compliance solution.

## Troubleshooting

| Symptom | Check |
|---|---|
| Native module missing / running in Expo Go | Rebuild a native app after installing the library. |
| Android capabilities are all false | Set the correct `androidAppId`, apply the plugin, and rebuild. |
| Android sign-in fails | Package name, actual build certificate SHA-1, linked PGS credentials, test account, and configuration publication. |
| Achievement does not appear | Correct platform ID, authenticated player, standard versus incremental type, and store configuration. |
| Game Stats never change | Published event schema, exact property names/types, stat aggregation, authentication, and upload. |
| iOS build or sign-in fails | iOS 16.4+ target, bundle ID, Game Center capability, signing profile, and a Game Center account on the device. |
| Works locally but fails after installing from Play | Check the Play app signing certificate's PGS credentials. |

The [example app](example/README.md) exposes authentication state, capabilities, achievements, Game Stats, and Recall so you can test setup before adding it to your game.

## Google Play Games Level Up

This library covers parts of the [Level Up guidelines](https://developer.android.com/games/guidelines); installing it does not make a game compliant or enroll it in the program.

| Area | What this package provides | What your game still needs |
|---|---|---|
| Platform authentication | PGS v2 initialization and sign-in | Correct credentials and build configuration |
| Achievements | Unlocking, steps, and native UI | Store records and achievable gameplay milestones |
| Game Stats | Event, progression, and upload calls | Schemas, stat definitions, and gameplay instrumentation |
| Recall | Session ID | Backend account linking |
| Cloud save | Not included | Your save service and conflict resolution |
| Rewards | Not included | Play Billing claim recovery, validation, granting, and acknowledgement |
| Sidekick, PC, input, quality | Not included | Console configuration and device testing |

Check Google's [current enrollment rules](https://support.google.com/googleplay/android-developer/answer/18018581) separately from the technical guidelines. For rewards, see [Google's reward integration guide](https://developer.android.com/games/rewards).

## Contributing

[Issues and pull requests](https://github.com/obsidianart/expo-play-games-kit/issues) are welcome. Please include a minimal reproduction and remove credentials, purchase tokens, and player identifiers from logs.

```sh
npm ci
npm run build
npm run lint -- --max-warnings 0
```

If this helps your game, a GitHub star helps other developers find it. Reports from real integrations are especially useful.

## Roadmap

- Investigate a PGS Saved Games wrapper.
- Expand device validation and setup examples based on integration feedback.

## License

[MIT](LICENSE)
