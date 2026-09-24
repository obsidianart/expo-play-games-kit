const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withEntitlementsPlist,
  withStringsXml,
} = require('expo/config-plugins');

const pkg = require('./package.json');

const APP_ID_META_DATA = 'com.google.android.gms.games.APP_ID';
const APP_ID_STRING_RESOURCE = 'expo_play_games_app_id';

// Manifest nodes contributed by play-services-games-v2 22.x that are removed
// when the variant has no APP_ID (see below).
const DORMANT_MANIFEST_NODES = {
  provider: ['com.google.android.gms.games.provider.PlayGamesInitProvider'],
  activity: [
    'com.google.android.gms.games.internal.v2.resolution.GamesResolutionActivity',
    'com.google.android.gms.games.internal.v2.appshortcuts.PlayGamesAppShortcutsActivity',
  ],
};

/**
 * @param {import('expo/config').ExpoConfig} config
 * @param {{ androidAppId?: string; iosGameCenterEntitlement?: boolean }} [props]
 */
const withPlayGamesKit = (config, props = {}) => {
  const { androidAppId, iosGameCenterEntitlement = true } = props;

  if (androidAppId) {
    // The APP_ID meta-data must reference a string resource: a raw numeric
    // value in the manifest is parsed as an integer and crashes the Play
    // Games SDK at startup.
    config = withStringsXml(config, (config) => {
      config.modResults = AndroidConfig.Strings.setStringItem(
        [
          {
            $: { name: APP_ID_STRING_RESOURCE, translatable: 'false' },
            _: String(androidAppId),
          },
        ],
        config.modResults,
      );
      return config;
    });
    config = withAndroidManifest(config, (config) => {
      const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
      application['meta-data'] = (application['meta-data'] ?? []).filter(
        (item) => item.$['android:name'] !== APP_ID_META_DATA,
      );
      application['meta-data'].push({
        $: {
          'android:name': APP_ID_META_DATA,
          'android:value': `@string/${APP_ID_STRING_RESOURCE}`,
        },
      });
      return config;
    });
  } else {
    console.warn(
      `[${pkg.name}] no "androidAppId" was provided — Play Games Services will not work on Android. ` +
        'Pass the numeric project id from Play Console → Play Games Services → Setup and management → Configuration.',
    );
    // Without an APP_ID this variant must not touch Play Games at all (think
    // of an under-13 title that links the module only because it shares a
    // codebase with an enrolled one). The games SDK ships its own
    // ContentProvider that connects to the Play Games service at process
    // start whether or not the app ever calls the SDK, plus two activities.
    // Strip them from the merged manifest.
    config = withAndroidManifest(config, (config) => {
      const manifest = config.modResults.manifest;
      manifest.$ = manifest.$ ?? {};
      manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] ?? 'http://schemas.android.com/tools';
      const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
      for (const [kind, names] of Object.entries(DORMANT_MANIFEST_NODES)) {
        application[kind] = (application[kind] ?? []).filter((item) => !names.includes(item.$['android:name']));
        for (const name of names) {
          application[kind].push({ $: { 'android:name': name, 'tools:node': 'remove' } });
        }
      }
      return config;
    });
  }

  if (iosGameCenterEntitlement) {
    config = withEntitlementsPlist(config, (config) => {
      config.modResults['com.apple.developer.game-center'] = true;
      return config;
    });
  }

  return config;
};

module.exports = createRunOncePlugin(withPlayGamesKit, pkg.name, pkg.version);
