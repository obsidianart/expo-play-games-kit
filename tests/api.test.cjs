const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(platform = 'ios', overrides = {}) {
  const module = {
    capabilities: { auth: true, achievements: true, achievementsUI: true, gameStats: true, recall: true, serverSideAccess: true, leaderboards: true },
    ...overrides,
  };
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync('src/index.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(source, { exports, require: name => name === 'react-native' ? { Platform: { OS: platform } } : name === './PlayGamesKitModule' ? { __esModule: true, default: module } : {}, console });
  return { api: exports, module };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('simultaneous sign-in shares native request; cancellation permits retry', async () => {
  let calls = 0, finish;
  const { api } = load('ios', { signIn: () => { calls++; return new Promise(resolve => { finish = resolve; }); } });
  const a = api.signIn(), b = api.signIn();
  await tick(); assert.equal(calls, 1);
  finish({ isAuthenticated: false });
  assert.equal((await a).isAuthenticated, false); await b;
  const c = api.signIn(); await tick(); assert.equal(calls, 2);
  finish({ isAuthenticated: true }); assert.equal((await c).isAuthenticated, true);
});
test('failed sign-in clears shared request', async () => {
  let calls = 0;
  const { api } = load('ios', { signIn: async () => { calls++; throw new Error('no presenter'); } });
  await assert.rejects(api.signIn(), /no presenter/);
  await assert.rejects(api.signIn(), /no presenter/); assert.equal(calls, 2);
});
test('iOS concurrent increments preserve both updates', async () => {
  let progress = 0;
  const { api } = load('ios', { incrementAchievement: async (_id, steps) => { const before = progress; await tick(); progress = before + steps; } });
  await Promise.all([api.incrementAchievement('a', 2, 10), api.incrementAchievement('a', 3, 10)]);
  assert.equal(progress, 5);
});
test('failed achievement write does not block later operations', async () => {
  let calls = 0;
  const { api } = load('ios', { incrementAchievement: async () => { if (++calls === 1) throw new Error('offline'); } });
  const a = api.incrementAchievement('a', 1, 10), b = api.incrementAchievement('a', 1, 10);
  await assert.rejects(a, /offline/); await b; assert.equal(calls, 2);
});
test('unrelated achievement writes do not block each other', async () => {
  let finish, other = false;
  const { api } = load('ios', { unlockAchievement: id => id === 'a' ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(other = true) });
  const a = api.unlockAchievement('a'); await api.unlockAchievement('b'); assert.equal(other, true); finish(); await a;
});
test('set and increment share the same iOS queue', async () => {
  let value = 0;
  const { api } = load('ios', { setAchievementSteps: async (_id, steps) => { await tick(); value = steps; }, incrementAchievement: async (_id, steps) => { value += steps; } });
  await Promise.all([api.setAchievementSteps('a', 5, 10), api.incrementAchievement('a', 2, 10)]); assert.equal(value, 7);
});
test('invalid progress never crosses the native bridge', async () => {
  const { api } = load('ios', { incrementAchievement: () => assert.fail('native called') });
  for (const n of [-1, NaN, Infinity, 0.5, 2147483648]) await assert.rejects(api.incrementAchievement('a', n, 10), /steps/);
  await assert.rejects(api.incrementAchievement('a', 1, 0), /totalSteps/);
});
test('unsupported builds have safe no-ops and explicit unsupported errors', async () => {
  const { api } = load('web', { capabilities: {} });
  assert.equal((await api.signIn()).isAuthenticated, false);
  assert.equal(await api.getPlayer(), null);
  await api.unlockAchievement('a'); await api.showLeaderboard(); await api.submitScore('a', 1);
  await api.recordGameEvents([{ name: 'a' }]);
  await assert.rejects(api.requestRecallAccess(), /not available/);
  await assert.rejects(api.requestServerSideAccess('a'), /not available/);
});
test('leaderboard platform mapping, missing IDs and score validation', async () => {
  const calls = [];
  const { api } = load('android', { submitScore: async (...args) => calls.push(args), showLeaderboard: async id => calls.push(id) });
  await api.submitScore({ android: 'android-board', ios: 'ios-board' }, 42);
  await api.submitScore({ ios: 'ios-only' }, 42);
  await api.showLeaderboard(); await api.showLeaderboard({ ios: 'missing' });
  assert.deepEqual(calls, [['android-board', 42], null]);
  for (const n of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) await assert.rejects(api.submitScore('a', n), /safe integer/);
});
