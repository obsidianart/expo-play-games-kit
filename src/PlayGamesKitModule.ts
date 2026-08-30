import { NativeModule, requireNativeModule } from 'expo';

import {
  AuthState,
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
}

export default requireNativeModule<PlayGamesKitModule>('PlayGamesKit');
