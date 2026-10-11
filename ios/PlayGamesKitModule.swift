import ExpoModulesCore
import GameKit

public class PlayGamesKitModule: Module {
  private var pendingSignInPromises: [Promise] = []
  private var pendingAuthViewController: UIViewController?
  private let gameCenterDelegate = GameCenterDismissDelegate()

  public func definition() -> ModuleDefinition {
    Name("PlayGamesKit")

    Events("onAuthenticationChange")

    Constants([
      "capabilities": [
        "auth": true,
        "leaderboards": true,
        "achievements": true,
        "achievementsUI": true,
        "incrementalAchievements": true,
        "serverSideAccess": false,
        // Android-only APIs
        "gameStats": false,
        "recall": false,
      ]
    ])

    OnCreate {
      DispatchQueue.main.async {
        self.installAuthHandler()
      }
    }

    AsyncFunction("isAuthenticated") { () -> [String: Any] in
      return self.currentAuthState()
    }

    AsyncFunction("signIn") { (promise: Promise) in
      if GKLocalPlayer.local.isAuthenticated {
        promise.resolve(self.currentAuthState())
        return
      }
      self.pendingSignInPromises.append(promise)
      guard self.pendingSignInPromises.count == 1 else { return }
      if let viewController = self.pendingAuthViewController {
        self.pendingAuthViewController = nil
        if !self.present(viewController) {
          self.pendingAuthViewController = viewController
          self.rejectPendingSignIn()
        }
      } else {
        // Re-installing the handler makes GameKit retry authentication.
        self.installAuthHandler()
      }
    }.runOnQueue(.main)

    AsyncFunction("getPlayer") { () -> [String: Any]? in
      guard GKLocalPlayer.local.isAuthenticated else { return nil }
      return self.playerMap(GKLocalPlayer.local)
    }

    AsyncFunction("requestServerSideAccess") { (_: String, _: Bool, promise: Promise) in
      promise.reject("ERR_UNSUPPORTED", "requestServerSideAccess is Android-only. On iOS use GameKit identity verification instead.")
    }

    AsyncFunction("unlockAchievement") { (achievementId: String, promise: Promise) in
      self.report(achievementId: achievementId, percent: 100, promise: promise)
    }

    AsyncFunction("revealAchievement") { (_: String, promise: Promise) in
      // GameKit reveals hidden achievements automatically once progress is reported.
      promise.resolve(nil)
    }

    AsyncFunction("incrementAchievement") { (achievementId: String, steps: Int, totalSteps: Int, promise: Promise) in
      guard totalSteps > 0 else {
        promise.reject("ERR_TOTAL_STEPS_REQUIRED", "incrementAchievement needs `totalSteps` on iOS to convert steps into Game Center percent progress.")
        return
      }
      GKAchievement.loadAchievements { achievements, error in
        if let error = error {
          promise.reject("ERR_GAME_CENTER", error.localizedDescription)
          return
        }
        let current = achievements?.first { $0.identifier == achievementId }?.percentComplete ?? 0
        let percent = current + (Double(steps) / Double(totalSteps)) * 100
        self.report(achievementId: achievementId, percent: percent, promise: promise)
      }
    }

    AsyncFunction("setAchievementSteps") { (achievementId: String, steps: Int, totalSteps: Int, promise: Promise) in
      guard totalSteps > 0 else {
        promise.reject("ERR_TOTAL_STEPS_REQUIRED", "setAchievementSteps needs `totalSteps` on iOS to convert steps into Game Center percent progress.")
        return
      }
      let percent = (Double(steps) / Double(totalSteps)) * 100
      self.report(achievementId: achievementId, percent: percent, promise: promise)
    }

    AsyncFunction("submitScore") { (leaderboardId: String, score: Int, promise: Promise) in
      GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [leaderboardId]) { error in
        if let error = error { promise.reject("ERR_GAME_CENTER", error.localizedDescription) }
        else { promise.resolve(nil) }
      }
    }

    AsyncFunction("showLeaderboard") { (leaderboardId: String?, promise: Promise) in
      let viewController: GKGameCenterViewController
      if let leaderboardId = leaderboardId {
        viewController = GKGameCenterViewController(leaderboardID: leaderboardId, playerScope: .global, timeScope: .allTime)
      } else {
        viewController = GKGameCenterViewController(state: .leaderboards)
      }
      viewController.gameCenterDelegate = self.gameCenterDelegate
      if self.present(viewController) { promise.resolve(nil) }
      else { promise.reject("ERR_NO_PRESENTER", "Game Center needs an active screen with no presentation in progress.") }
    }.runOnQueue(.main)

    AsyncFunction("showAchievements") { (promise: Promise) in
      let viewController = GKGameCenterViewController(state: .achievements)
      viewController.gameCenterDelegate = self.gameCenterDelegate
      if self.present(viewController) {
        promise.resolve(nil)
      } else {
        promise.reject("ERR_NO_PRESENTER", "Game Center needs an active screen with no presentation in progress.")
      }
    }.runOnQueue(.main)
  }

  private func installAuthHandler() {
    GKLocalPlayer.local.authenticateHandler = { [weak self] viewController, error in
      guard let self = self else { return }
      DispatchQueue.main.async {
        if let viewController = viewController {
          if !self.pendingSignInPromises.isEmpty {
            if !self.present(viewController) {
              self.pendingAuthViewController = viewController
              self.rejectPendingSignIn()
            }
          } else {
            self.pendingAuthViewController = viewController
          }
          return
        }
        let state = self.currentAuthState(errorMessage: error?.localizedDescription)
        self.sendEvent("onAuthenticationChange", state)
        self.pendingAuthViewController = nil
        let promises = self.pendingSignInPromises
        self.pendingSignInPromises.removeAll()
        for promise in promises { promise.resolve(state) }
      }
    }
  }

  private func currentAuthState(errorMessage: String? = nil) -> [String: Any] {
    let player = GKLocalPlayer.local
    var state: [String: Any] = ["isAuthenticated": player.isAuthenticated]
    if player.isAuthenticated {
      state["player"] = playerMap(player)
    } else if let errorMessage = errorMessage {
      state["error"] = errorMessage
    }
    return state
  }

  private func playerMap(_ player: GKLocalPlayer) -> [String: Any] {
    return [
      "id": player.gamePlayerID,
      "displayName": player.displayName,
      "alias": player.alias,
    ]
  }

  private func report(achievementId: String, percent: Double, promise: Promise) {
    let achievement = GKAchievement(identifier: achievementId)
    achievement.percentComplete = min(100, max(0, percent))
    achievement.showsCompletionBanner = true
    GKAchievement.report([achievement]) { error in
      if let error = error {
        promise.reject("ERR_GAME_CENTER", error.localizedDescription)
      } else {
        promise.resolve(nil)
      }
    }
  }

  private func rejectPendingSignIn() {
    let promises = pendingSignInPromises
    pendingSignInPromises.removeAll()
    for promise in promises {
      promise.reject("ERR_NO_PRESENTER", "Game Center needs an active screen with no presentation in progress. Retry when the app is visible.")
    }
  }

  private func present(_ viewController: UIViewController) -> Bool {
    guard let presenter = appContext?.utilities?.currentViewController(),
          presenter.viewIfLoaded?.window != nil,
          !presenter.isBeingDismissed,
          !presenter.isBeingPresented,
          presenter.presentedViewController == nil else { return false }
    presenter.present(viewController, animated: true)
    return true
  }
}

private class GameCenterDismissDelegate: NSObject, GKGameCenterControllerDelegate {
  func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
    gameCenterViewController.dismiss(animated: true)
  }
}
