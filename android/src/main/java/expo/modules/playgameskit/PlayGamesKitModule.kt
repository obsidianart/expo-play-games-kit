package expo.modules.playgameskit

import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import com.google.android.gms.games.PlayGames
import com.google.android.gms.games.PlayGamesSdk
import com.google.android.gms.games.Player
import com.google.android.gms.games.playergameevent.PlayerGameEvent
import com.google.android.gms.tasks.Task
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

private class MissingActivityException :
  CodedException("ERR_NO_ACTIVITY: Play Games Services requires a foreground Activity")

private class PlayGamesException(cause: Throwable?) :
  CodedException("ERR_PLAY_GAMES", cause?.message ?: "Play Games Services call failed", cause)

/** One Game Stats event as it arrives from JS: `{ name, properties }`. */
class GameEventRecord : Record {
  @Field
  val name: String = ""

  @Field
  val properties: Map<String, Any?> = emptyMap()

  /**
   * JS numbers arrive as Double; the Game Stats schema distinguishes INT
   * from DOUBLE properties, so an integral value is sent as a long and only a
   * fractional one as a double. Unsupported value types are skipped rather
   * than failing the whole event.
   */
  fun toPlayerGameEvent(): PlayerGameEvent {
    val builder = PlayerGameEvent.Builder(name)
    properties.forEach { (key, value) ->
      when (value) {
        is Boolean -> builder.addProperty(key, value)
        is String -> builder.addProperty(key, value)
        is Int -> builder.addProperty(key, value.toLong())
        is Long -> builder.addProperty(key, value)
        is Float -> addNumber(builder, key, value.toDouble())
        is Double -> addNumber(builder, key, value)
        else -> Unit
      }
    }
    return builder.build()
  }

  private fun addNumber(builder: PlayerGameEvent.Builder, key: String, value: Double) {
    if (value.isFinite() && value == Math.floor(value) && Math.abs(value) < 9.007199254740992E15) {
      builder.addProperty(key, value.toLong())
    } else {
      builder.addProperty(key, value)
    }
  }
}

class PlayGamesKitModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PlayGamesKit")

    Events("onAuthenticationChange")

    Constants {
      // A variant without the APP_ID meta-data never initialises the SDK (see
      // OnCreate), and every Play Games client throws IllegalStateException
      // when used before initialisation. Report that honestly so the JS side
      // turns every call into a no-op instead of a rejected promise. When the
      // context is not available yet, assume the configured case.
      val configured = appContext.reactContext?.let { hasPlayGamesAppId(it) } ?: true
      mapOf(
        "capabilities" to mapOf(
          "auth" to configured,
          "achievements" to configured,
          "achievementsUI" to configured,
          "incrementalAchievements" to configured,
          "serverSideAccess" to configured,
          "gameStats" to configured,
          "recall" to configured,
        ),
      )
    }

    OnCreate {
      // Required by Play Games Services v2 before any client is used. Safe to
      // call more than once; automatic sign-in is triggered by the SDK itself.
      //
      // Only when the app actually carries an APP_ID: a multi-brand app can
      // link this module into every variant while only some are configured
      // (the config plugin adds the meta-data per variant), and an app aimed
      // at under-13 players must not start Play Games Services at all.
      appContext.reactContext?.let { context ->
        if (hasPlayGamesAppId(context)) PlayGamesSdk.initialize(context)
      }
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

    // Game Stats API (games-v2 22.0.0+). Events are validated against the
    // stat schema declared in Play Console and buffered by the SDK; the
    // record calls themselves return nothing, so they resolve as soon as the
    // events are handed over. `requestEventsUpload` asks the SDK to flush.
    AsyncFunction("recordGameEvents") { events: List<GameEventRecord> ->
      val client = PlayGames.getGameStatsClient(requireActivity())
      client.recordEvents(events.map { it.toPlayerGameEvent() })
    }

    AsyncFunction("uploadGameEvents") {
      PlayGames.getGameStatsClient(requireActivity()).requestEventsUpload()
    }

    // Recall API: a session id your backend exchanges (with the Play Games
    // Services REST API) to link or look up the player's Recall tokens, so a
    // returning player is recognised on a new device before they sign in to
    // your own identity provider.
    AsyncFunction("requestRecallAccess") { promise: Promise ->
      PlayGames.getRecallClient(requireActivity()).requestRecallAccess()
        .bind(promise) { it.sessionId }
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

  /** True when the manifest carries the `com.google.android.gms.games.APP_ID` meta-data. */
  private fun hasPlayGamesAppId(context: Context): Boolean =
    try {
      val info = context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
      !info.metaData?.getString(APP_ID_META_DATA).isNullOrBlank()
    } catch (e: PackageManager.NameNotFoundException) {
      false
    }

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
    private const val APP_ID_META_DATA = "com.google.android.gms.games.APP_ID"
  }
}
