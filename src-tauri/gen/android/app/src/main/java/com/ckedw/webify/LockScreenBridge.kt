package com.ckedw.webify

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import android.webkit.JavascriptInterface
import java.io.ByteArrayOutputStream

/**
 * Exposed to the web app as `window.WebifyNative` (see MainActivity.kt
 * and src/lockscreen/nativeBridge.ts). JavascriptInterface methods run
 * on a WebView background thread, not the UI thread, so drawing and
 * setting the wallpaper here is fine. Every method returns a plain
 * string / boolean — "ok" or "error: ..." — never throws into JS.
 */
class LockScreenBridge(context: Context) {
    private val ctx: Context = context.applicationContext

    @JavascriptInterface
    fun push(json: String): String = LockScreenController.applyPayload(ctx, json)

    @JavascriptInterface
    fun setBackground(dataUrl: String): String {
        return try {
            val comma = dataUrl.indexOf(',')
            if (comma < 0) return "error: not a data URL"
            val bytes = Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT)

            // Make sure it really is an image before replacing the old one.
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return "error: couldn't read that image"

            LockScreenController.backgroundFile(ctx).writeBytes(bytes)
            "ok"
        } catch (e: Exception) {
            "error: ${e.javaClass.simpleName}: ${e.message}"
        }
    }

    @JavascriptInterface
    fun clearBackground(): String {
        return try {
            LockScreenController.backgroundFile(ctx).delete()
            "ok"
        } catch (e: Exception) {
            "error: ${e.javaClass.simpleName}: ${e.message}"
        }
    }

    @JavascriptInterface
    fun hasBackground(): Boolean = LockScreenController.backgroundFile(ctx).exists()

    @JavascriptInterface
    fun getBackgroundPreview(): String {
        return try {
            val file = LockScreenController.backgroundFile(ctx)
            if (!file.exists()) return ""
            val options = BitmapFactory.Options().apply { inSampleSize = 4 }
            val small = BitmapFactory.decodeFile(file.absolutePath, options) ?: return ""
            val out = ByteArrayOutputStream()
            small.compress(Bitmap.CompressFormat.JPEG, 70, out)
            small.recycle()
            "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
        } catch (e: Exception) {
            ""
        }
    }

    /**
     * Remaining checklist count + where the Quick Settings tile should
     * open. Written on every lock-screen push so the tile stays in step
     * without its own DB access. See ChecklistTileService.
     */
    @JavascriptInterface
    fun updateQuickTile(count: Int, destination: String, enabled: Boolean): String {
        return try {
            ChecklistTileService.update(ctx, count, destination, enabled)
            "ok"
        } catch (e: Exception) {
            "error: ${e.javaClass.simpleName}: ${e.message}"
        }
    }

    /**
     * Returns the pending first-level view key stashed by a tile tap
     * (or by MainActivity from the intent extra), then clears it so a
     * later resume doesn't re-navigate.
     */
    @JavascriptInterface
    fun consumeOpenView(): String {
        val prefs = ChecklistTileService.prefs(ctx)
        val view = prefs.getString(ChecklistTileService.KEY_PENDING_VIEW, "") ?: ""
        if (view.isNotEmpty()) {
            prefs.edit().remove(ChecklistTileService.KEY_PENDING_VIEW).apply()
        }
        return view
    }
}
