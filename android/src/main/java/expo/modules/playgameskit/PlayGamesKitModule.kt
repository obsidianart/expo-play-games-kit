package expo.modules.playgameskit

import android.app.Activity
import com.google.android.gms.games.PlayGames
import com.google.android.gms.games.PlayGamesSdk
import com.google.android.gms.games.Player
import com.google.android.gms.tasks.Task
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private class MissingActivityException :
  CodedException("ERR_NO_ACTIVITY: Play Games Services requires a foreground Activity")

private class PlayGamesException(cause: Throwable?) :
  CodedException("ERR_PLAY_GAMES", cause?.message ?: "Play Games Services call failed", cause)

class PlayGamesKitModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PlayGamesKit")

    Events("onAuthenticationChange")

    Constants(
      "capabilities" to mapOf(
        "auth" to true,
        "achievements" to true,
        "achievementsUI" to true,
        "incrementalAchievements" to true,
        "serverSideAccess" to true,
        // Planned for v0.2 (Android only)
        "gameStats" to false,
        "recall" to false,
      ),
    )

    OnCreate {
      // Required by Play Games Services v2 before any client is used. Safe to
      // call more than once; automatic sign-in is triggered by the SDK itself.
      appContext.reactContext?.let { PlayGamesSdk.initialize(it) }
    }

    AsyncFunction("isAuthenticated") { promise: Promise ->
      val activity = requireActivity()
      PlayGames.getGamesSignInClient(activity).isAuthenticated
        .addOnCompleteListener { task ->
          val authenticated = task.isSuccessful && task.result.isAuthenticated
          if (authenticated) {
            resolveAuthState(activity, promise)
          } else {
            promise.resolve(mapOf("isAuthenticated" to false))
          }
        }
    }

    AsyncFunction("signIn") { promise: Promise ->
      val activity = requireActivity()
      PlayGames.getGamesSignInClient(activity).signIn()
        .addOnCompleteListener { task ->
          val authenticated = task.isSuccessful && task.result.isAuthenticated
          if (authenticated) {
            resolveAuthState(activity, promise, emitEvent = true)
          } else {
            val state = mapOf("isAuthenticated" to false)
            sendEvent("onAuthenticationChange", state)
            promise.resolve(state)
          }
        }
    }

    AsyncFunction("getPlayer") { promise: Promise ->
      val activity = requireActivity()
      PlayGames.getPlayersClient(activity).currentPlayer.bind(promise) { playerMap(it) }
    }

    AsyncFunction("requestServerSideAccess") { serverClientId: String, forceRefresh: Boolean, promise: Promise ->
      val activity = requireActivity()
      PlayGames.getGamesSignInClient(activity)
        .requestServerSideAccess(serverClientId, forceRefresh)
        .bind(promise) { it }
    }

    AsyncFunction("unlockAchievement") { achievementId: String, promise: Promise ->
      PlayGames.getAchievementsClient(requireActivity())
        .unlockImmediate(achievementId)
        .bind(promise) { null }
    }

    AsyncFunction("revealAchievement") { achievementId: String, promise: Promise ->
      PlayGames.getAchievementsClient(requireActivity())
        .revealImmediate(achievementId)
        .bind(promise) { null }
    }

    AsyncFunction("incrementAchievement") { achievementId: String, steps: Int, _totalSteps: Int, promise: Promise ->
      PlayGames.getAchievementsClient(requireActivity())
        .incrementImmediate(achievementId, steps)
        .bind(promise) { null }
    }

    AsyncFunction("setAchievementSteps") { achievementId: String, steps: Int, _totalSteps: Int, promise: Promise ->
      PlayGames.getAchievementsClient(requireActivity())
        .setStepsImmediate(achievementId, steps)
        .bind(promise) { null }
    }

    AsyncFunction("showAchievements") { promise: Promise ->
      val activity = requireActivity()
      PlayGames.getAchievementsClient(activity).achievementsIntent
        .addOnSuccessListener { intent ->
          activity.startActivityForResult(intent, RC_ACHIEVEMENT_UI)
          promise.resolve(null)
        }
        .addOnFailureListener { promise.reject(PlayGamesException(it)) }
    }
  }

  private fun requireActivity(): Activity =
    appContext.currentActivity ?: throw MissingActivityException()

  private fun resolveAuthState(activity: Activity, promise: Promise, emitEvent: Boolean = false) {
    PlayGames.getPlayersClient(activity).currentPlayer
      .addOnSuccessListener { player ->
        val state = mapOf("isAuthenticated" to true, "player" to playerMap(player))
        if (emitEvent) sendEvent("onAuthenticationChange", state)
        promise.resolve(state)
      }
      .addOnFailureListener {
        // Authenticated but the player profile could not be loaded — still authenticated.
        val state = mapOf("isAuthenticated" to true)
        if (emitEvent) sendEvent("onAuthenticationChange", state)
        promise.resolve(state)
      }
  }

  private fun playerMap(player: Player?): Map<String, Any?>? =
    player?.let { mapOf("id" to it.playerId, "displayName" to it.displayName) }

  private fun <T> Task<T>.bind(promise: Promise, transform: (T) -> Any?) {
    addOnSuccessListener { promise.resolve(transform(it)) }
    addOnFailureListener { promise.reject(PlayGamesException(it)) }
  }

  companion object {
    private const val RC_ACHIEVEMENT_UI = 9003
  }
}
