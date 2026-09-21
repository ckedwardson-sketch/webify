package com.ckedw.webify

import android.app.AlarmManager
import android.app.PendingIntent
import android.app.WallpaperManager
import android.content.Context
import android.content.Intent
import org.json.JSONObject
import java.io.File

/**
 * Owns the lock screen list: stores the latest payload the web side
 * pushed, draws whichever frame is current onto the lock screen
 * wallpaper, and sets an alarm for the moment the next frame takes over.
 *
 * The payload is a timeline (see src/lockscreen/lockScreenSnapshot.ts):
 * frames sorted by `at`, each frame valid from its `at` until the next
 * frame's `at`. That is what lets the wallpaper stay correct while the
 * app is closed, without any scheduling logic in Kotlin.
 */
object LockScreenController {
    const val ACTION_ALARM = "com.ckedw.webify.LOCKSCREEN_ALARM"

    private const val PAYLOAD_FILE = "lockscreen_payload.json"
    private const val BG_FILE = "lockscreen_bg.jpg"
    private const val PREFS = "lockscreen_state"
    private const val KEY_LAST_DRAWN = "last_drawn_key"
    private const val ALARM_REQUEST_CODE = 4101

    fun backgroundFile(ctx: Context): File = File(ctx.applicationContext.filesDir, BG_FILE)

    private fun payloadFile(ctx: Context): File = File(ctx.applicationContext.filesDir, PAYLOAD_FILE)

    /** Called from the JS bridge with a fresh payload. */
    @Synchronized
    fun applyPayload(ctx: Context, json: String): String {
        return try {
            JSONObject(json) // reject garbage before it overwrites a good payload
            payloadFile(ctx).writeText(json)
            refresh(ctx)
        } catch (e: Exception) {
            "error: ${e.javaClass.simpleName}: ${e.message}"
        }
    }

    /**
     * Draws the frame that's current *now* (if it differs from what's
     * already on the lock screen) and schedules the next change.
     * Called after a push, from the alarm, and after boot / time changes.
     */
    @Synchronized
    fun refresh(ctx: Context, force: Boolean = false): String {
        val app = ctx.applicationContext
        val file = payloadFile(app)
        if (!file.exists()) return "no payload yet"
        return try {
            val payload = JSONObject(file.readText())
            val settings = payload.getJSONObject("settings")
            if (!settings.optBoolean("enabled", false)) {
                cancelAlarm(app)
                return "disabled"
            }
            val frames = payload.getJSONArray("frames")
            if (frames.length() == 0) return "error: payload has no frames"

            // Frames are sorted ascending; the current one is the last
            // whose start time has passed.
            val now = System.currentTimeMillis()
            var index = 0
            for (i in 0 until frames.length()) {
                if (frames.getJSONObject(i).optLong("at") <= now) index = i else break
            }
            val frame = frames.getJSONObject(index)

            val bg = backgroundFile(app)
            val drawnKey = (frame.toString() + settings.toString() + (if (bg.exists()) bg.lastModified() else 0L))
                .hashCode().toString()
            val prefs = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

            var status = "ok (unchanged)"
            if (force || prefs.getString(KEY_LAST_DRAWN, null) != drawnKey) {
                val bitmap = LockScreenRenderer.render(app, frame, settings)
                try {
                    WallpaperManager.getInstance(app)
                        .setBitmap(bitmap, null, true, WallpaperManager.FLAG_LOCK)
                } finally {
                    bitmap.recycle()
                }
                prefs.edit().putString(KEY_LAST_DRAWN, drawnKey).apply()
                status = "ok"
            }

            if (index + 1 < frames.length()) {
                scheduleAlarm(app, frames.getJSONObject(index + 1).optLong("at"))
            } else {
                cancelAlarm(app)
            }
            status
        } catch (e: Exception) {
            "error: ${e.javaClass.simpleName}: ${e.message}"
        }
    }

    private fun alarmIntent(ctx: Context): PendingIntent {
        val intent = Intent(ctx, LockScreenReceiver::class.java).setAction(ACTION_ALARM)
        return PendingIntent.getBroadcast(
            ctx,
            ALARM_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    // Inexact on purpose: needs no special permission, and a frame that
    // takes over a few minutes late is fine for a lock screen list.
    private fun scheduleAlarm(ctx: Context, atMs: Long) {
        val alarms = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, alarmIntent(ctx))
    }

    private fun cancelAlarm(ctx: Context) {
        val alarms = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarms.cancel(alarmIntent(ctx))
    }
}
