# Releasing

Releases go to npm through **trusted publishing** (GitHub Actions + OIDC, `.github/workflows/publish.yml`). There is no npm token in the repo, in CI secrets, or on any machine: npm's 2FA-bypass tokens lost the ability to publish directly (see the [July 2026 npm changelog](https://github.blog/changelog/2026-07-31-restricting-npm-bypass-2fa-granular-access-tokens/)), and OIDC is the replacement.

## Every release

1. Update the version in `package.json`, `android/build.gradle` (`version` + `versionName`), and `ios/PlayGamesKit.podspec`.
2. Move the `CHANGELOG.md` "unreleased" entries under the new version with today's date.
3. Verify locally:

   ```
   npm run build
   npm run lint
   ```

4. Commit, tag, and push. The tag is the release trigger and must equal the `package.json` version:

   ```
   git tag v<version>
   git push && git push --tags
   ```

5. Watch the **Publish** workflow in GitHub Actions. It checks the tag against `package.json`, builds, lints, and runs `npm publish --provenance --access public`. The published version carries a provenance attestation linking it to the commit.

## One-time setup (already done once the package exists)

npm only lets you configure a trusted publisher on a package that already exists, so the **first version of a new package is published by hand**, with interactive 2FA:

```
npm login
npm publish --access public
```

Then on npmjs.com → the package → **Settings** → **Trusted publisher** → GitHub Actions:

| Field | Value |
|---|---|
| Organization or user | `obsidianart` |
| Repository | `expo-play-games-kit` |
| Workflow filename | `publish.yml` |
| Environment name | leave empty |

All fields are case-sensitive. After that, every tag push publishes on its own. Trusted publishing requires cloud-hosted runners (no self-hosted) and the workflow that runs `npm publish` must be the one named above (not a reusable workflow it calls).
