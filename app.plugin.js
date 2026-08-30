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
