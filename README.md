# expo-play-games-kit

Cross-platform game services for Expo and React Native: **Google Play Games Services v2** on Android and **Game Center** on iOS, behind one typed JavaScript API.

Built for the era of [Google Play Games Level Up](https://play.google.com/console/about/levelup): this library targets the compliance surface Play's UX guidelines actually require — platform authentication, achievements, and the new **Game Stats** and **Recall** APIs that no other React Native library covers.

- ✅ Authentication (PGS v2 automatic sign-in / GameKit authenticate handler)
- ✅ Achievements: unlock, reveal, incremental progress, native achievements UI
- ✅ **Game Stats API** (Android, guideline LU-GS): record schema events, progression updates, upload
- ✅ **Recall API** (Android): session ids for seamless restore
- ✅ Server-side access codes on Android (bring your own identity backend — Play's guidelines don't require Google sign-in)
- ✅ Config plugin: injects the Play Games `APP_ID` and the Game Center entitlement for you
- ✅ Honest capability flags — platform-specific features are `false` at runtime, not crashes
- ✅ Multi-variant safe: the SDK initialises only in variants that carry an `APP_ID`, so an under-13 flavour of the same app never touches Play Games

## Play Level Up compliance map

If you're working through the [Level Up user experience guidelines](https://developer.android.com/games/guidelines), this is where each one lands:

| Guideline | Requirement | Covered by |
|---|---|---|
| LU-PA (Platform auth) | Integrate the PGS v2 SDK, initialize at startup | Automatic — the module initializes `PlayGamesSdk` on create. Any identity provider remains fine. |
| LU-AC (Achievements) | ≥10 achievements (40+ recommended), ≥4 in the first hour for quest eligibility | `unlockAchievement`, `incrementAchievement`, `setAchievementSteps`, `showAchievements` |
| LU-GS (Game Stats) | ≥5 recurring stats, ≥1 competitive, ≥1 progression | `recordGameEvent`, `recordProgress`, `uploadGameEvents` — the stat schema itself is a CSV you upload in Play Console |
| Seamless restore | Recall API account linking | `requestRecallAccess` gives the session id; your backend does the linking |
| LU-CS (Cloud save) | Off-device save with conflict resolution — **any provider qualifies** | Your existing backend, or PGS Saved Games (not wrapped here yet) |
| LU-SK (Sidekick) | Play Console toggle for AAB apps | No code needed |

## Installation

```
npx expo install expo-play-games-kit
```

### Config plugin

```jsonc
// app.json
{
  "expo": {
    "plugins": [
      [
        "expo-play-games-kit",
        {
          "androidAppId": "123456789012" // Play Console → Play Games Services → Configuration
        }
      ]
    ]
  }
}
```

The plugin adds the `com.google.android.gms.games.APP_ID` meta-data (as a string resource — a raw numeric manifest value crashes the SDK) and the `com.apple.developer.game-center` entitlement. Set `"iosGameCenterEntitlement": false` if you manage entitlements yourself.

For a variant that must **not** use Play Games (for example an under-13 flavour of a multi-brand app), keep the plugin in the config but omit `androidAppId`: besides leaving the module dormant, the plugin then removes the games SDK's own manifest nodes (`PlayGamesInitProvider` and its two activities) with `tools:node="remove"`, so the process never contacts the Play Games service at all. Pair it with `"iosGameCenterEntitlement": false`.

On iOS, also enable the Game Center capability for your app in App Store Connect and define your achievements there; on Android, define them in Play Console. The two stores issue **different achievement ids** — see the id mapping below.

## Usage

```ts
import * as PlayGamesKit from 'expo-play-games-kit';

// Startup: both platforms attempt silent auth on their own.
const state = await PlayGamesKit.isAuthenticated();

// Interactive sign-in (resolves — never rejects — when the player cancels):
if (!state.isAuthenticated) {
  await PlayGamesKit.signIn();
}

// Achievements take a string (same id everywhere) or a per-platform pair:
await PlayGamesKit.unlockAchievement({
  android: 'CgkIxxxxxxxxEAIQAg',
  ios: 'first_world_complete',
});

// Incremental progress — absolute steps, identical semantics on both platforms:
await PlayGamesKit.setAchievementSteps(ids.solve100Levels, 42, 100);

// Native achievements UI:
await PlayGamesKit.showAchievements();

// React to auth changes (e.g. automatic sign-in finishing after startup):
const sub = PlayGamesKit.addAuthenticationListener(({ isAuthenticated, player }) => {
  console.log(isAuthenticated, player?.displayName);
});

// Game Stats (Android): event names and properties come from the stat
// schema you upload in Play Console. No-ops on iOS and web.
await PlayGamesKit.recordGameEvent('level_solved', { subtype: 'kakuro', score: 812 });
await PlayGamesKit.recordProgress(levelsSolved); // the progression stat
await PlayGamesKit.uploadGameEvents(); // e.g. when the app goes to background

// Branch on real capabilities instead of Platform.OS:
if (PlayGamesKit.getCapabilities().serverSideAccess) {
  const code = await PlayGamesKit.requestServerSideAccess(serverClientId);
  // send `code` to your backend and exchange it for tokens
}
if (PlayGamesKit.getCapabilities().recall) {
  const sessionId = await PlayGamesKit.requestRecallAccess();
  // your backend links it to the player's account via the PGS REST API
}
```

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

## Roadmap

- **v1.0** — Saved Games (optional PGS snapshot wrapper), full guideline-by-guideline docs.

Issues and PRs welcome.

## License

MIT
