package com.ckedw.webify

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.drawable.Icon
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

/**
 * Quick Settings tile that shows the number of remaining (unticked)
 * checklist tasks — the same count the lock screen list uses — and
 * opens Webify to a configurable first-level page on tap.
 *
 * State is written by LockScreenBridge.updateQuickTile whenever the
 * lock-screen payload is pushed (or settings change). This service
 * never talks to SQLite itself; the JS side already has the count.
 *
 * Samsung S10e (and other One UI devices): add the tile via Edit on
 * the Quick Settings panel — it appears under the app name as
 * "Checklist".
 */
class ChecklistTileService : TileService() {

    override fun onStartListening() {
        super.onStartListening()
        applyState(qsTile)
    }

    override fun onClick() {
        super.onClick()
        val prefs = prefs(this)
        val destination = prefs.getString(KEY_DESTINATION, DEFAULT_DESTINATION) ?: DEFAULT_DESTINATION

        // Stash the target so the WebView can pick it up after launch
        // (MainActivity forwards the intent extra; JS calls consumeOpenView).
        prefs.edit().putString(KEY_PENDING_VIEW, destination).apply()

        val intent = Intent(this, MainActivity::class.java).apply {
            action = Intent.ACTION_MAIN
            addCategory(Intent.CATEGORY_LAUNCHER)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_OPEN_VIEW, destination)
        }

        // Collapse the QS panel then start the activity. On API 34+
        // startActivityAndCollapse(Intent) is deprecated in favour of
        // the PendingIntent form; keep both paths.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val pending = android.app.PendingIntent.getActivity(
                this,
                0,
                intent,
                android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
            )
            startActivityAndCollapse(pending)
        } else {
            @Suppress("DEPRECATION")
            startActivityAndCollapse(intent)
        }
    }

    companion object {
        const val PREFS = "webify_quick_tile"
        const val KEY_COUNT = "count"
        const val KEY_DESTINATION = "destination"
        const val KEY_ENABLED = "enabled"
        const val KEY_PENDING_VIEW = "pending_open_view"
        const val EXTRA_OPEN_VIEW = "com.ckedw.webify.OPEN_VIEW"
        const val DEFAULT_DESTINATION = "checklist-home"

        fun prefs(ctx: Context): SharedPreferences =
            ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

        /**
         * Called from the JS bridge after a lock-screen push. Writes the
         * count and asks SystemUI to rebind the tile so onStartListening
         * picks up the new number without the panel being open.
         */
        fun update(ctx: Context, count: Int, destination: String, enabled: Boolean) {
            prefs(ctx).edit()
                .putInt(KEY_COUNT, count)
                .putString(KEY_DESTINATION, destination.ifBlank { DEFAULT_DESTINATION })
                .putBoolean(KEY_ENABLED, enabled)
                .apply()
            try {
                requestListeningState(
                    ctx.applicationContext,
                    ComponentName(ctx.applicationContext, ChecklistTileService::class.java)
                )
            } catch (_: Exception) {
                // Tile not added yet, or OEM restriction — fine, next
                // onStartListening will still read the prefs.
            }
        }

        fun applyState(tile: Tile?) {
            if (tile == null) return
            // Context is available on the service instance via the
            // receiver of the non-static path; static callers pass tile
            // already obtained from qsTile.
        }
    }

    private fun applyState(tile: Tile?) {
        if (tile == null) return
        val prefs = prefs(this)
        val enabled = prefs.getBoolean(KEY_ENABLED, true)
        val count = prefs.getInt(KEY_COUNT, -1)

        tile.label = "Checklist"
        if (!enabled || count < 0) {
            tile.subtitle = "—"
            tile.state = Tile.STATE_INACTIVE
        } else {
            // One number only, matching the lock-screen remaining count.
            tile.subtitle = count.toString()
            tile.state = if (count > 0) Tile.STATE_ACTIVE else Tile.STATE_INACTIVE
        }
        // Content description for TalkBack / accessibility.
        tile.contentDescription = if (count >= 0) {
            if (count == 1) "1 checklist task remaining" else "$count checklist tasks remaining"
        } else {
            "Checklist"
        }
        tile.updateTile()
    }
}
