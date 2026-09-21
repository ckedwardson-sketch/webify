package com.ckedw.webify

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Wakes the lock screen list up when it needs to redraw with the app
 * closed: the next-frame alarm, plus events that clear alarms or change
 * what "now" means (reboot, app update, clock/timezone/date change).
 * Any intent is answered the same way — re-draw the current frame and
 * re-schedule — so it doesn't matter which one arrived.
 */
class LockScreenReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        // Drawing takes a moment; don't do it on the main thread.
        val pending = goAsync()
        Thread {
            try {
                LockScreenController.refresh(context)
            } finally {
                pending.finish()
            }
        }.start()
    }
}
