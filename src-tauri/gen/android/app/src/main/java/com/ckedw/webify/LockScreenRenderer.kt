package com.ckedw.webify

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.hardware.display.DisplayManager
import android.text.TextPaint
import android.text.TextUtils
import android.util.DisplayMetrics
import android.view.Display
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.max
import kotlin.math.min

/**
 * Draws one frame of the lock screen list onto a full-screen bitmap.
 * All sizes are authored for a 1080px-wide screen and scaled from there.
 *
 * Layout, top to bottom (positions are % of screen height, from settings):
 *   status banner  — only when there are timed tasks; a pill above the clock
 *   [clock area]   — left empty, Samsung draws the clock there
 *   checklist, then tasks, then responsibilities
 */
object LockScreenRenderer {
    private const val REFERENCE_WIDTH = 1080f

    private const val GREEN = 0xFF2E9E5B.toInt()
    private const val YELLOW = 0xFFE0B420.toInt()
    private const val RED = 0xFFD64545.toInt()

    @Suppress("DEPRECATION") // Display.getRealMetrics — still the simplest real-screen-size call on API 24+
    fun render(ctx: Context, frame: JSONObject, settings: JSONObject): Bitmap {
        // Real screen size, always portrait — a lock screen wallpaper
        // must not be drawn for whatever rotation the app last had.
        val metrics = DisplayMetrics()
        val display = (ctx.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager)
            .getDisplay(Display.DEFAULT_DISPLAY)
        display.getRealMetrics(metrics)
        val w = min(metrics.widthPixels, metrics.heightPixels)
        val h = max(metrics.widthPixels, metrics.heightPixels)
        val scale = w / REFERENCE_WIDTH

        val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        // ---- Background ------------------------------------------------
        canvas.drawColor(color(settings, "bgColor", 0xFF101418.toInt()))
        val bgFile = LockScreenController.backgroundFile(ctx)
        if (bgFile.exists()) {
            val image = BitmapFactory.decodeFile(bgFile.absolutePath)
            if (image != null) {
                drawCover(canvas, image, w, h)
                image.recycle()
                val dim = settings.optInt("bgDim", 0).coerceIn(0, 80)
                if (dim > 0) canvas.drawColor(Color.argb(dim * 255 / 100, 0, 0, 0))
            }
        }

        // ---- Text styles -----------------------------------------------
        val fontPx = settings.optDouble("fontSize", 40.0).toFloat() * scale
        val textColor = color(settings, "textColor", Color.WHITE)
        val secondaryColor = color(settings, "secondaryColor", 0xFFB8C0CC.toInt())
        val shadow = 0xAA000000.toInt()

        val namePaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            color = textColor
            textSize = fontPx
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            setShadowLayer(4f * scale, 0f, 2f * scale, shadow)
        }
        val doneNamePaint = TextPaint(namePaint).apply { color = secondaryColor }
        val detailPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            color = secondaryColor
            textSize = fontPx * 0.78f
            typeface = Typeface.create("sans-serif", Typeface.NORMAL)
            setShadowLayer(4f * scale, 0f, 2f * scale, shadow)
        }
        val headerPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            color = secondaryColor
            textSize = fontPx * 0.66f
            typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
            setShadowLayer(4f * scale, 0f, 2f * scale, shadow)
        }
        val markerFill = Paint(Paint.ANTI_ALIAS_FLAG)
        val markerRing = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = max(2f, fontPx * 0.06f)
            color = textColor
        }

        val side = 56f * scale
        val right = w - side

        // ---- Status banner (above the clock) -----------------------------
        val status = frame.optString("status", "")
        val banner = frame.optString("banner", "")
        if (status.isNotEmpty() && banner.isNotEmpty()) {
            val bannerPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
                textSize = fontPx * 0.85f
                typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
                textAlign = Paint.Align.CENTER
                color = if (status == "yellow") Color.BLACK else Color.WHITE
            }
            val padX = fontPx * 0.9f
            val barH = fontPx * 1.5f
            val maxTextW = w - 2 * side - 2 * padX
            val text = TextUtils.ellipsize(banner, bannerPaint, maxTextW, TextUtils.TruncateAt.END).toString()
            val barW = bannerPaint.measureText(text) + 2 * padX
            val top = h * settings.optInt("bannerTop", 5) / 100f
            val left = (w - barW) / 2f
            markerFill.color = statusColor(status)
            canvas.drawRoundRect(RectF(left, top, left + barW, top + barH), barH / 2f, barH / 2f, markerFill)
            val baseline = top + barH / 2f - (bannerPaint.ascent() + bannerPaint.descent()) / 2f
            canvas.drawText(text, w / 2f, baseline, bannerPaint)
        }

        // ---- Lists ---------------------------------------------------------
        // Drawn in this order, skipping any section the payload left
        // empty. The marker in front of a row says which list it came
        // from: a checkbox for the Checklist page, a status dot for a
        // timed task, a ring that fills in for a responsibility.
        val sections = listOf(
            Triple("Checklist", frame.optJSONArray("checklist") ?: JSONArray(), "checklist"),
            Triple("Tasks", frame.optJSONArray("tasks") ?: JSONArray(), "task"),
            Triple("Responsibilities", frame.optJSONArray("responsibilities") ?: JSONArray(), "responsibility")
        ).filter { it.second.length() > 0 }
        if (sections.isEmpty()) return bitmap

        val rowH = fontPx * 1.62f
        val headerH = fontPx * 1.3f
        val sectionGap = fontPx * 0.7f
        val listTop = h * settings.optInt("listTop", 28) / 100f
        val listBottom = h * settings.optInt("listBottom", 70) / 100f

        val totalRows = sections.sumOf { it.second.length() }
        val chrome = sections.size * headerH + (sections.size - 1) * sectionGap
        val capacity = max(0, ((listBottom - listTop - chrome) / rowH).toInt())

        // When it all fits, everything is drawn. When it doesn't, each
        // section gets a share of the room proportional to its size —
        // but never less than one row, so no list silently disappears,
        // and the last one mops up whatever rounding left over.
        val shown = IntArray(sections.size) { sections[it].second.length() }
        if (totalRows > capacity) {
            var remaining = capacity
            for (i in sections.indices) {
                val want = sections[i].second.length()
                val share = if (i == sections.size - 1) remaining else capacity * want / totalRows
                shown[i] = min(want, max(1, share)).coerceAtMost(max(0, remaining))
                remaining -= shown[i]
            }
        }

        val markerX = side + fontPx * 0.28f
        val markerR = fontPx * 0.2f
        val nameX = side + fontPx * 1.0f

        fun rowBaseline(rowTop: Float, paint: Paint): Float =
            rowTop + rowH / 2f - (paint.ascent() + paint.descent()) / 2f

        fun drawDetailAndName(rowTop: Float, name: String, detail: String, namePaintForRow: TextPaint) {
            val detailW = if (detail.isEmpty()) 0f else detailPaint.measureText(detail)
            if (detail.isNotEmpty()) {
                canvas.drawText(detail, right - detailW, rowBaseline(rowTop, detailPaint), detailPaint)
            }
            val nameMax = right - nameX - detailW - (if (detail.isEmpty()) 0f else fontPx * 0.6f)
            val shownName = TextUtils.ellipsize(name, namePaintForRow, max(0f, nameMax), TextUtils.TruncateAt.END).toString()
            canvas.drawText(shownName, nameX, rowBaseline(rowTop, namePaintForRow), namePaintForRow)
        }

        fun drawMore(rowTop: Float, count: Int) {
            canvas.drawText("+$count more", nameX, rowBaseline(rowTop, detailPaint), detailPaint)
        }

        var y = listTop
        for ((index, section) in sections.withIndex()) {
            val (title, rows, kind) = section
            val total = rows.length()
            if (index > 0) y += sectionGap
            canvas.drawText(title, side, y + headerPaint.textSize, headerPaint)
            y += headerH

            // A truncated section spends its last row on "+N more"
            // rather than stopping mid-list with no explanation.
            val truncated = shown[index] < total
            val drawn = if (truncated) max(0, shown[index] - 1) else shown[index]
            for (i in 0 until drawn) {
                val row = rows.getJSONObject(i)
                val centerY = y + rowH / 2f
                var namePaintForRow = namePaint
                when (kind) {
                    "task" -> {
                        markerFill.color = statusColor(row.optString("status", "green"))
                        canvas.drawCircle(markerX, centerY, markerR, markerFill)
                    }
                    "checklist" -> {
                        val box = markerR * 1.8f
                        canvas.drawRoundRect(
                            RectF(markerX - box / 2f, centerY - box / 2f, markerX + box / 2f, centerY + box / 2f),
                            box * 0.22f,
                            box * 0.22f,
                            markerRing
                        )
                    }
                    else -> {
                        if (row.optBoolean("done", false)) {
                            markerFill.color = secondaryColor
                            canvas.drawCircle(markerX, centerY, markerR, markerFill)
                            namePaintForRow = doneNamePaint
                        } else {
                            canvas.drawCircle(markerX, centerY, markerR - markerRing.strokeWidth / 2f, markerRing)
                        }
                    }
                }
                drawDetailAndName(y, row.optString("name", ""), row.optString("detail", ""), namePaintForRow)
                y += rowH
            }
            if (truncated) {
                drawMore(y, total - drawn)
                y += rowH
            }
        }

        return bitmap
    }

    private fun statusColor(status: String): Int = when (status) {
        "red" -> RED
        "yellow" -> YELLOW
        else -> GREEN
    }

    private fun color(settings: JSONObject, key: String, fallback: Int): Int {
        return try {
            Color.parseColor(settings.optString(key, ""))
        } catch (e: Exception) {
            fallback
        }
    }

    private fun drawCover(canvas: Canvas, image: Bitmap, w: Int, h: Int) {
        val scale = max(w.toFloat() / image.width, h.toFloat() / image.height)
        val dw = image.width * scale
        val dh = image.height * scale
        val left = (w - dw) / 2f
        val top = (h - dh) / 2f
        canvas.drawBitmap(image, null, RectF(left, top, left + dw, top + dh), Paint(Paint.FILTER_BITMAP_FLAG))
    }
}