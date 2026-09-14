/**
 * What the current platform's native implementation can actually do.
 * Android-only or iOS-only features are honest `false` flags instead of
 * runtime surprises — branch on these rather than on `Platform.OS`.
 */
export type PlayGamesKitCapabilities = {
  auth: boolean;
  achievements: boolean;
  achievementsUI: boolean;
  incrementalAchievements: boolean;
  /** Android only: exchange the Play Games session for a server auth code. */
  serverSideAccess: boolean;
  /** Android only: Google Play Games Game Stats API (games-v2 22.0.0+). */
  gameStats: boolean;
  /** Android only: Google Play Games Recall API (seamless restore). */
  recall: boolean;
};

/**
 * Properties of a Game Stats event. Numbers are sent as INT when integral
 * and as DOUBLE otherwise, matching the property types declared in the
 * stat schema uploaded to Play Console. At most 25 properties per event.
 */
export type GameEventProperties = Record<string, string | number | boolean>;

/** A Game Stats event: an event name from your schema plus its properties. */
export type GameEvent = {
  name: string;
  properties?: GameEventProperties;
};

export type PlayerInfo = {
  id: string;
  displayName: string;
  /** iOS only. */
  alias?: string;
};

export type AuthState = {
  isAuthenticated: boolean;
  player?: PlayerInfo;
  /** Present when authentication finished with an error (iOS). */
  error?: string;
};

export type PlayGamesKitModuleEvents = {
  onAuthenticationChange: (state: AuthState) => void;
};

/**
 * An achievement id, either a single string used as-is on the current
 * platform, or a per-platform pair (Play Console ids and App Store Connect
 * ids are different). Calls resolve to a no-op when the current platform has
 * no id, so a game can ship iOS-only or Android-only achievements without
 * branching.
 */
export type AchievementId = string | { android?: string; ios?: string };
