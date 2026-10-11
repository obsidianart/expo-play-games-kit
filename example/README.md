# Example app

A small native test app for `expo-play-games-kit`. It shows sign-in state, capability flags, and the result of each action.

## Run it

From the repository root:

```sh
npm ci
npm run build
cd example
npm ci
```

Before building:

1. Replace `android.package` and/or `ios.bundleIdentifier` in `app.json` with an app you control and have configured in the relevant store.
2. Replace the sample `androidAppId` with your numeric PGS project ID. Set up PGS credentials for the package and certificate used by this build, and add your test account.
3. In `App.tsx`, replace both achievement ID pairs. Use a standard achievement for unlock and a separate 10-step incremental achievement for progress.
4. For the Game Stats buttons, declare `level_solved` with an integer `score` property and configure progression using `progressUpdate.currentProgress` in Play Console. Use a test project/account: these buttons send real events.
5. For iOS, enable Game Center and use an appropriate signing profile. The library requires iOS 16.4+.

```sh
npm run android
# Or on macOS with Xcode:
npm run ios
```

Expo Go cannot load this native module. Rebuild after changes to plugin options. The example uses the parent library via Metro configuration and Expo module autolinking.

For leaderboard testing, replace `DEMO_LEADERBOARD` in `App.tsx` with real IDs and configure identical score units/sorting in both stores. These APIs are not part of npm 0.2.2 yet.

## What to check

- Sign in and confirm that the player name appears.
- Unlock the standard achievement, then open the native achievements screen.
- Set incremental progress to 5/10 twice: the second call should not double the progress.
- On Android, record an event, send progression, and request upload. Confirm the resulting stats separately in the platform; the result label only confirms the call resolved.
- Request a Recall session on Android. The UI only confirms a session was returned; no account linking or cloud restore happens without your backend.
- Submit score 42 and open the leaderboard to verify it was stored.
- Try cancelling sign-in and reopening the app.

## Capture a demo

Use configured test accounts on both platforms. Record sign-in, an achievement unlock, and the native achievements screen. Hide player identifiers and account details before publishing. A screenshot of this app's result label is not proof that Google or Apple persisted an achievement.
