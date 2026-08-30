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
  /** Google Play Games Game Stats API (planned, Android only). */
  gameStats: boolean;
  /** Google Play Games Recall API (planned, Android only). */
  recall: boolean;
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
