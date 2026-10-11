import { Platform } from 'react-native';

import {
  AchievementId,
  LeaderboardId,
  AuthState,
  GameEvent,
  GameEventProperties,
  PlayerInfo,
  PlayGamesKitCapabilities,
} from './PlayGamesKit.types';
import PlayGamesKitModule from './PlayGamesKitModule';

export * from './PlayGamesKit.types';

function resolveId(id: AchievementId): string | null {
  if (typeof id === 'string') {
    return id;
  }
  if (Platform.OS === 'android') {
    return id.android ?? null;
  }
  if (Platform.OS === 'ios') {
    return id.ios ?? null;
  }
  return null;
}

/**
 * Feature flags for the current platform — see {@link PlayGamesKitCapabilities}.
 * All flags are also `false` on an Android build that carries no Play Games
 * `APP_ID` (a variant that deliberately leaves the SDK dormant): achievement and stats calls
 * become no-ops; Recall and server access still reject.
 */
export function getCapabilities(): PlayGamesKitCapabilities {
  return PlayGamesKitModule.capabilities;
}

const NOT_AUTHENTICATED: AuthState = { isAuthenticated: false };
let pendingSignIn: Promise<AuthState> | undefined;
const achievementQueues = new Map<string, Promise<void>>();

function validateSteps(steps: number, totalSteps: number, needsTotal: boolean): void {
  if (!Number.isInteger(steps) || steps < 0 || steps > 2147483647) {
    throw new RangeError('steps must be an integer between 0 and 2147483647');
  }
  if (needsTotal && (!Number.isInteger(totalSteps) || totalSteps <= 0 || totalSteps > 2147483647)) {
    throw new RangeError('totalSteps must be a positive 32-bit integer');
  }
}

// GameKit increments are read/modify/write operations. Serialize all writes
// for the same achievement so two callers cannot overwrite each other's work.
function writeAchievement(id: string, operation: () => Promise<void>): Promise<void> {
  if (Platform.OS !== 'ios') return operation();
  const previous = achievementQueues.get(id) ?? Promise.resolve();
  const result = previous.then(operation);
  const settled = result.catch(() => {});
  achievementQueues.set(id, settled);
  settled.then(() => {
    if (achievementQueues.get(id) === settled) achievementQueues.delete(id);
  });
  return result;
}

function can(flag: keyof PlayGamesKitCapabilities): boolean {
  return PlayGamesKitModule.capabilities[flag] === true;
}

/**
 * Current authentication state. On Android the Play Games SDK attempts
 * automatic sign-in at startup; on iOS the GameKit authenticate handler is
 * installed at startup. Neither shows UI from this call.
 */
export async function isAuthenticated(): Promise<AuthState> {
  if (!can('auth')) {
    return NOT_AUTHENTICATED;
  }
  return PlayGamesKitModule.isAuthenticated();
}

/**
 * Interactive sign-in. Shows the platform sign-in UI when needed and resolves
 * with the resulting state (never rejects for a user-cancelled sign-in).
 */
export async function signIn(): Promise<AuthState> {
  if (!can('auth')) {
    return NOT_AUTHENTICATED;
  }
  if (!pendingSignIn) {
    pendingSignIn = Promise.resolve()
      .then(() => PlayGamesKitModule.signIn())
      .finally(() => {
        pendingSignIn = undefined;
      });
  }
  return pendingSignIn;
}

export async function getPlayer(): Promise<PlayerInfo | null> {
  if (!can('auth')) {
    return null;
  }
  return PlayGamesKitModule.getPlayer();
}

/**
 * Android only: returns a server auth code your backend can exchange for an
 * access token to verify the player's identity (OAuth server client id from
 * the same Play Console games setup). Rejects on iOS and web, and on an
 * Android build without an APP_ID.
 */
export async function requestServerSideAccess(
  serverClientId: string,
  forceRefresh = false
): Promise<string> {
  if (!can('serverSideAccess')) {
    throw new Error('requestServerSideAccess is not available on this build');
  }
  return PlayGamesKitModule.requestServerSideAccess(serverClientId, forceRefresh);
}

/** Unlock a standard achievement. No-op if `id` has no entry for this platform. */
export async function unlockAchievement(id: AchievementId): Promise<void> {
  const achievementId = resolveId(id);
  if (achievementId === null || !can('achievements')) {
    return;
  }
  return writeAchievement(achievementId, () => PlayGamesKitModule.unlockAchievement(achievementId));
}

/**
 * Reveal a hidden achievement. Android reveals it explicitly; on iOS Game
 * Center reveals achievements automatically, so this resolves immediately.
 */
export async function revealAchievement(id: AchievementId): Promise<void> {
  const achievementId = resolveId(id);
  if (achievementId === null || !can('achievements')) {
    return;
  }
  return PlayGamesKitModule.revealAchievement(achievementId);
}

/**
 * Add `steps` of progress to an incremental achievement.
 * `totalSteps` is required for iOS (Game Center stores percent, not steps);
 * Android uses its own configured step total and ignores it.
 */
export async function incrementAchievement(
  id: AchievementId,
  steps: number,
  totalSteps = 0
): Promise<void> {
  const achievementId = resolveId(id);
  if (achievementId === null || !can('achievements')) {
    return;
  }
  validateSteps(steps, totalSteps, Platform.OS === 'ios');
  if (steps === 0) return;
  return writeAchievement(achievementId, () =>
    PlayGamesKitModule.incrementAchievement(achievementId, steps, totalSteps)
  );
}

/**
 * Set the absolute progress of an incremental achievement. Prefer this over
 * {@link incrementAchievement} when your game tracks progress itself: it is
 * idempotent, and it behaves identically on both platforms.
 */
export async function setAchievementSteps(
  id: AchievementId,
  steps: number,
  totalSteps: number
): Promise<void> {
  const achievementId = resolveId(id);
  if (achievementId === null || !can('achievements')) {
    return;
  }
  validateSteps(steps, totalSteps, true);
  return writeAchievement(achievementId, () =>
    PlayGamesKitModule.setAchievementSteps(achievementId, steps, totalSteps)
  );
}

/** Show the platform's native achievements UI. No-op where `capabilities.achievementsUI` is false. */
export async function showAchievements(): Promise<void> {
  if (!can('achievementsUI')) {
    return;
  }
  return PlayGamesKitModule.showAchievements();
}

/**
 * Record Game Stats events (Android, games-v2 22.0.0+). Event names and
 * property keys must match the stat schema uploaded to Play Console; the SDK
 * validates them and drops what it does not know. Resolves as a no-op where
 * `capabilities.gameStats` is false. Record events as they happen — Google
 * asks for immediate submission — and call {@link uploadGameEvents} at a
 * quiet moment (end of a level, app going to background).
 */
export async function recordGameEvents(events: GameEvent[]): Promise<void> {
  if (!can('gameStats') || events.length === 0) {
    return;
  }
  return PlayGamesKitModule.recordGameEvents(events);
}

/** Record a single Game Stats event — see {@link recordGameEvents}. */
export function recordGameEvent(name: string, properties: GameEventProperties = {}): Promise<void> {
  return recordGameEvents([{ name, properties }]);
}

/**
 * The Game Stats progression event. Send it at launch and whenever the
 * player's primary progression moves (level reached, chapter, rank);
 * `currentProgress` is the value your progression stat displays.
 */
export function recordProgress(currentProgress: number | string): Promise<void> {
  return recordGameEvent('progressUpdate', { currentProgress });
}

/** Ask the SDK to upload the events recorded so far. No-op off Android. */
export async function uploadGameEvents(): Promise<void> {
  if (!can('gameStats')) {
    return;
  }
  return PlayGamesKitModule.uploadGameEvents();
}

/**
 * Android only: a Recall session id. Send it to your backend, which calls the
 * Play Games Services REST API (`recall.linkPersona` / `recall.retrieveTokens`)
 * to tie the Play Games player to your own account — that is what makes
 * "seamless restore" seamless on a new device. Rejects on iOS and web, and
 * on an Android build without an APP_ID.
 */
export async function requestRecallAccess(): Promise<string> {
  if (!can('recall')) {
    throw new Error('requestRecallAccess is not available on this build');
  }
  return PlayGamesKitModule.requestRecallAccess();
}

/**
 * Listen for authentication changes (automatic sign-in completing, the player
 * signing in or cancelling). Returns a subscription with `remove()`.
 */
export function addAuthenticationListener(listener: (state: AuthState) => void): {
  remove(): void;
} {
  return PlayGamesKitModule.addListener('onAuthenticationChange', listener);
}

/** Submit an integer score in the units configured in each store. */
export async function submitScore(id: LeaderboardId, score: number): Promise<void> {
  const leaderboardId = resolveId(id);
  if (leaderboardId === null || !can('leaderboards')) return;
  if (!Number.isSafeInteger(score)) throw new RangeError('score must be a safe integer');
  return PlayGamesKitModule.submitScore(leaderboardId, score);
}

/** Show one leaderboard, or all leaderboards when no ID is supplied. */
export async function showLeaderboard(id?: LeaderboardId): Promise<void> {
  if (!can('leaderboards')) return;
  const leaderboardId = id === undefined ? null : resolveId(id);
  if (id !== undefined && leaderboardId === null) return;
  return PlayGamesKitModule.showLeaderboard(leaderboardId);
}

export default PlayGamesKitModule;
