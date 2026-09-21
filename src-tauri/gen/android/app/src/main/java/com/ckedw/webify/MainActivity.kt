package com.ckedw.webify

import android.content.Intent
import android.os.Bundle
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    stashOpenViewFromIntent(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    stashOpenViewFromIntent(intent)
  }

  // Exposes the lock screen bridge to the web app as window.WebifyNative
  // (see LockScreenBridge.kt and src/lockscreen/nativeBridge.ts).
  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    webView.addJavascriptInterface(LockScreenBridge(applicationContext), "WebifyNative")
  }

  // Tile taps arrive as ACTION_MAIN with EXTRA_OPEN_VIEW. Stash the key
  // in the same prefs the bridge's consumeOpenView() reads so the JS
  // side can navigate once the WebView is up — works whether the app
  // was cold-started or already running (singleTask + onNewIntent).
  private fun stashOpenViewFromIntent(intent: Intent?) {
    val view = intent?.getStringExtra(ChecklistTileService.EXTRA_OPEN_VIEW) ?: return
    if (view.isBlank()) return
    ChecklistTileService.prefs(this)
      .edit()
      .putString(ChecklistTileService.KEY_PENDING_VIEW, view)
      .apply()
  }
}
