import { NativeModule, registerWebModule } from 'expo';

import {
  AuthState,
  PlayGamesKitCapabilities,
  PlayGamesKitModuleEvents,
} from './PlayGamesKit.types';

const NOT_AUTHENTICATED: AuthState = { isAuthenticated: false };

class PlayGamesKitModule extends NativeModule<PlayGamesKitModuleEvents> {
  capabilities: PlayGamesKitCapabilities = {
    auth: false,
    achievements: false,
    achievementsUI: false,
    incrementalAchievements: false,
    serverSideAccess: false,
    gameStats: false,
    recall: false,
  };

  async isAuthenticated(): Promise<AuthState> {
    return NOT_AUTHENTICATED;
  }

  async signIn(): Promise<AuthState> {
    return NOT_AUTHENTICATED;
  }

  async getPlayer() {
    return null;
  }

  async requestServerSideAccess(): Promise<string> {
    throw new Error('requestServerSideAccess is not available on web');
  }

  async unlockAchievement(): Promise<void> {}

  async revealAchievement(): Promise<void> {}

  async incrementAchievement(): Promise<void> {}

  async setAchievementSteps(): Promise<void> {}

  async showAchievements(): Promise<void> {}
}

export default registerWebModule(PlayGamesKitModule, 'PlayGamesKit');
