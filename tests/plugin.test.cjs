const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const moduleMock = { exports: {} };
const wrap = key => (config, fn) => { config[key] = fn({ modResults: config[key] }).modResults; return config; };
vm.runInNewContext(fs.readFileSync('app.plugin.js', 'utf8'), {
  module: moduleMock, console: { warn() {} }, require: name => name === './package.json' ? { name: 'test', version: '0' } : {
    createRunOncePlugin: plugin => plugin,
    withAndroidManifest: wrap('manifest'), withStringsXml: wrap('strings'), withEntitlementsPlist: wrap('entitlements'),
    AndroidConfig: { Manifest: { getMainApplicationOrThrow: result => result.manifest.application[0] }, Strings: { setStringItem: (items, result) => ({ ...result, resources: { string: items } }) } },
  },
});
const plugin = moduleMock.exports;
const fresh = () => ({ manifest: { manifest: { $: {}, application: [{ 'meta-data': [{ $: { 'android:name': 'unrelated', 'android:value': 'keep' } }] }] } }, strings: {}, entitlements: {} });
const app = c => c.manifest.manifest.application[0];
test('APP_ID is a string resource and unrelated metadata survives', () => {
  const c = plugin(fresh(), { androidAppId: '123456' });
  assert.equal(app(c)['meta-data'][1].$['android:value'], '@string/expo_play_games_app_id');
  assert.equal(c.strings.resources.string[0]._, '123456');
  assert.equal(c.entitlements['com.apple.developer.game-center'], true);
  assert.equal(app(c)['meta-data'][0].$['android:name'], 'unrelated');
});
test('enabled → disabled removes stale APP_ID and initialization components', () => {
  const c = plugin(plugin(fresh(), { androidAppId: '123' }), { iosGameCenterEntitlement: false });
  assert.equal(app(c)['meta-data'].length, 1);
  assert.equal(app(c).provider[0].$['tools:node'], 'remove');
  assert.equal(app(c).activity.length, 2);
});
test('disabled → enabled removes only owned removal markers; repeated application is stable', () => {
  const c = plugin(fresh(), {});
  app(c).activity.push({ $: { 'android:name': 'my.Activity', 'tools:node': 'remove' } });
  plugin(c, { androidAppId: '123' }); plugin(c, { androidAppId: '123' });
  assert.equal(app(c).provider.length, 0); assert.equal(app(c).activity.length, 1);
  assert.equal(app(c).activity[0].$['android:name'], 'my.Activity');
  assert.equal(app(c)['meta-data'].length, 2);
});
