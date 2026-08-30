# Releasing

1. Update the version in `package.json`, `android/build.gradle` (`version` + `versionName`), and `ios/PlayGamesKit.podspec`.
2. Move the `CHANGELOG.md` "unreleased" entries under the new version.
3. Verify locally:

   ```
   npm run build
   npm run lint
   ```

4. Commit, tag, and push:

   ```
   git tag v<version>
   git push && git push --tags
   ```

5. Publish (from the repo root — `.npmignore` excludes the example and internals):

   ```
   npm publish
   ```
