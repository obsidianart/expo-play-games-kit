# Changelog

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
