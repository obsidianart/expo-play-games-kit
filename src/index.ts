import { Platform } from 'react-native';

import {
  AchievementId,
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

/** Feature flags for the current platform — see {@link PlayGamesKitCapabilities}. */
export function getCapabilities(): PlayGamesKitCapabilities {
  return PlayGamesKitModule.capabilities;
}

/**
 * Current authentication state. On Android the Play Games SDK attempts
 * automatic sign-in at startup; on iOS the GameKit authenticate handler is
 * installed at startup. Neither shows UI from this call.
 */
export function isAuthenticated(): Promise<AuthState> {
  return PlayGamesKitModule.isAuthenticated();
}

/**
 * Interactive sign-in. Shows the platform sign-in UI when needed and resolves
 * with the resulting state (never rejects for a user-cancelled sign-in).
 */
export function signIn(): Promise<AuthState> {
  return PlayGamesKitModule.signIn();
}

export function getPlayer(): Promise<PlayerInfo | null> {
  return PlayGamesKitModule.getPlayer();
}

/**
 * Android only: returns a server auth code your backend can exchange for an
 * access token to verify the player's identity (OAuth server client id from
 * the same Play Console games setup). Rejects on iOS and web.
 */
export function requestServerSideAccess(
  serverClientId: string,
  forceRefresh = false
): Promise<string> {
  return PlayGamesKitModule.requestServerSideAccess(serverClientId, forceRefresh);
}

/** Unlock a standard achievement. No-op if `id` has no entry for this platform. */
export async function unlockAchievement(id: AchievementId): Promise<void> {
  const achievementId = resolveId(id);
  if (achievementId === null) {
    return;
  }
  return PlayGamesKitModule.unlockAchievement(achievementId);
}

/**
 * Reveal a hidden achievement. Android reveals it explicitly; on iOS Game
 * Center reveals achievements automatically, so this resolves immediately.
 */
export async function revealAchievement(id: AchievementId): Promise<void> {
  const achievementId = resolveId(id);
  if (achievementId === null) {
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
  if (achievementId === null) {
    return;
  }
  return PlayGamesKitModule.incrementAchievement(achievementId, steps, totalSteps);
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
  if (achievementId === null) {
    return;
  }
  return PlayGamesKitModule.setAchievementSteps(achievementId, steps, totalSteps);
}

/** Show the platform's native achievements UI. */
export function showAchievements(): Promise<void> {
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
  if (!PlayGamesKitModule.capabilities.gameStats || events.length === 0) {
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
  if (!PlayGamesKitModule.capabilities.gameStats) {
    return;
  }
  return PlayGamesKitModule.uploadGameEvents();
}

/**
 * Android only: a Recall session id. Send it to your backend, which calls the
 * Play Games Services REST API (`recall.linkPersona` / `recall.retrieveTokens`)
 * to tie the Play Games player to your own account — that is what makes
 * "seamless restore" seamless on a new device. Rejects on iOS and web.
 */
export function requestRecallAccess(): Promise<string> {
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

export default PlayGamesKitModule;
