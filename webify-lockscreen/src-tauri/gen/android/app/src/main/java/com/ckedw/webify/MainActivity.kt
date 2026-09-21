package com.ckedw.webify

import android.os.Bundle
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  // Exposes the lock screen bridge to the web app as window.WebifyNative
  // (see LockScreenBridge.kt and src/lockscreen/nativeBridge.ts).
  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    webView.addJavascriptInterface(LockScreenBridge(applicationContext), "WebifyNative")
  }
}
