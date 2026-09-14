import { NativeModule, requireNativeModule } from 'expo';

import {
  AuthState,
  GameEvent,
  PlayerInfo,
  PlayGamesKitCapabilities,
  PlayGamesKitModuleEvents,
} from './PlayGamesKit.types';

declare class PlayGamesKitModule extends NativeModule<PlayGamesKitModuleEvents> {
  capabilities: PlayGamesKitCapabilities;
  isAuthenticated(): Promise<AuthState>;
  signIn(): Promise<AuthState>;
  getPlayer(): Promise<PlayerInfo | null>;
  requestServerSideAccess(serverClientId: string, forceRefresh: boolean): Promise<string>;
  unlockAchievement(achievementId: string): Promise<void>;
  revealAchievement(achievementId: string): Promise<void>;
  incrementAchievement(achievementId: string, steps: number, totalSteps: number): Promise<void>;
  setAchievementSteps(achievementId: string, steps: number, totalSteps: number): Promise<void>;
  showAchievements(): Promise<void>;
  // Android only — the JS layer gates these on `capabilities`, so the iOS
  // module does not declare them.
  recordGameEvents(events: GameEvent[]): Promise<void>;
  uploadGameEvents(): Promise<void>;
  requestRecallAccess(): Promise<string>;
}

export default requireNativeModule<PlayGamesKitModule>('PlayGamesKit');
