# Changelog

## 0.2.1 — 2026-09-24

- Android config plugin: a variant built **without** `androidAppId` now also strips the games SDK's own manifest nodes (`PlayGamesInitProvider`, `GamesResolutionActivity`, `PlayGamesAppShortcutsActivity`) with `tools:node="remove"`. Previously the SDK's ContentProvider still ran at process start and looked up the Play Games service even though the module never initialised it; an under-13 title sharing a codebase with an enrolled one now makes no contact with Play Games at all.

## 0.2.0 — 2026-09-14

- Android: **Game Stats API** — `recordGameEvent`, `recordGameEvents`, `recordProgress`, `uploadGameEvents` over `PlayGames.getGameStatsClient` / `PlayerGameEvent` (games-v2 22.0.0). Integral numbers are sent as INT, fractional as DOUBLE. No-ops on iOS and web (`capabilities.gameStats === false`).
- Android: **Recall API** — `requestRecallAccess()` returns the session id for server-side account linking (`capabilities.recall`). Rejects on iOS and web.
- `GameEvent` / `GameEventProperties` types.

## 0.1.1 — 2026-09-14

- Android: the SDK is initialised only when the manifest carries the `com.google.android.gms.games.APP_ID` meta-data. A multi-variant app can link the module everywhere and configure it per variant; variants without an APP_ID (for example an under-13 title that must not use Play Games Services) stay dormant instead of initialising against a missing id.
- Releases now go through npm trusted publishing (GitHub Actions + OIDC) on tag push.

## 0.1.0 — 2026-09-14

Initial release.

- Android: Play Games Services v2 (`play-services-games-v2:22.0.0`) — SDK initialization, automatic + interactive sign-in, player info, server-side access codes, achievements (unlock / reveal / increment / set steps), native achievements UI.
- iOS: Game Center (GameKit) — authenticate handler, interactive sign-in, player info, achievements with steps→percent conversion, native achievements UI.
- Typed JS API with per-platform achievement id mapping and runtime capability flags.
- Config plugin: Android `APP_ID` meta-data via string resource, iOS Game Center entitlement.
- Web: no-op stub (all capabilities `false`).
