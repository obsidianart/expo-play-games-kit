# expo-play-games-kit

Cross-platform game services for Expo and React Native: **Google Play Games Services v2** on Android and **Game Center** on iOS, behind one typed JavaScript API.

Built for the era of [Google Play Games Level Up](https://play.google.com/console/about/levelup): this library targets the compliance surface Play's UX guidelines actually require — platform authentication, achievements, and (on the roadmap) the new **Game Stats** and **Recall** APIs that no other React Native library covers yet.

- ✅ Authentication (PGS v2 automatic sign-in / GameKit authenticate handler)
- ✅ Achievements: unlock, reveal, incremental progress, native achievements UI
- ✅ Server-side access codes on Android (bring your own identity backend — Play's guidelines don't require Google sign-in)
- ✅ Config plugin: injects the Play Games `APP_ID` and the Game Center entitlement for you
- ✅ Honest capability flags — platform-specific features are `false` at runtime, not crashes
- 🚧 Game Stats API (Android, guideline LU-GS) — v0.2
- 🚧 Recall API for seamless restore (Android) — v0.2

## Play Level Up compliance map

If you're working through the [Level Up user experience guidelines](https://developer.android.com/games/guidelines), this is where each one lands:

| Guideline | Requirement | Covered by |
|---|---|---|
| LU-PA (Platform auth) | Integrate the PGS v2 SDK, initialize at startup | Automatic — the module initializes `PlayGamesSdk` on create. Any identity provider remains fine. |
| LU-AC (Achievements) | ≥10 achievements (40+ recommended), ≥4 in the first hour for quest eligibility | `unlockAchievement`, `incrementAchievement`, `setAchievementSteps`, `showAchievements` |
| LU-GS (Game Stats) | ≥5 recurring stats, ≥1 competitive | Planned (v0.2) |
| Seamless restore | Recall API account linking | Planned (v0.2) |
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

// Branch on real capabilities instead of Platform.OS:
if (PlayGamesKit.getCapabilities().serverSideAccess) {
  const code = await PlayGamesKit.requestServerSideAccess(serverClientId);
  // send `code` to your backend and exchange it for tokens
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
| `addAuthenticationListener(fn)` | ✅ | ✅ | |

All achievement calls accept `string | { android?: string; ios?: string }` and resolve as a no-op when the current platform has no id.

## Roadmap

- **v0.2** — Game Stats API and Recall API (Android): the two Level Up requirements no React Native library covers.
- **v1.0** — Saved Games (optional PGS snapshot wrapper), full guideline-by-guideline docs.

Issues and PRs welcome.

## License

MIT
