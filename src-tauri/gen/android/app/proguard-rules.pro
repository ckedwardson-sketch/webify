# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Lock screen list: methods the web app calls through
# window.WebifyNative must survive release-build minification.
-keepattributes JavascriptInterface
-keep class com.ckedw.webify.LockScreenBridge { *; }
-keepclassmembers class com.ckedw.webify.LockScreenBridge {
    @android.webkit.JavascriptInterface <methods>;
}

# Quick Settings tile service + prefs keys used from the bridge.
-keep class com.ckedw.webify.ChecklistTileService { *; }
