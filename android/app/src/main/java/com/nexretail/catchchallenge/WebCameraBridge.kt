package com.nexretail.catchchallenge

import android.util.Log
import android.webkit.JavascriptInterface
import org.json.JSONObject

/**
 * The JavaScript ⇄ native bridge.
 *
 * The web game publishes `window.CatchChallenge.camera` (see
 * `claude/src/vision/ExternalCamera.ts`); the injected shim registers this app as its
 * camera host and calls back through here. Two directions:
 *
 *  - **page → native**: `onHostReady`, `requestPermission`, `restart`
 *  - **native → page**: frames pushed with `evaluateJavascript`, handled by [Host]
 *
 * `grabFrame` remains for pages that do *not* implement the host API (the Gemini
 * edition), where the shim falls back to patching `getUserMedia` and pulling frames.
 */
class WebCameraBridge(private val host: Host) {

    interface Host {
        /** The page implements the host API and has registered this app. */
        fun onHostReady()

        /** The page asked for the camera — show the USB permission dialog if needed. */
        fun onPermissionRequested()

        fun onRestartRequested()

        /** Legacy pull mode: newest frame as base64, or "" when nothing is new. */
        fun takeFrame(sinceId: Long): Pair<Long, String>?

        fun statusJson(): JSONObject
    }

    @Volatile
    private var lastDeliveredId: Long = -1

    @JavascriptInterface
    fun onHostReady() {
        Log.i(TAG, "page registered the native camera host")
        host.onHostReady()
    }

    @JavascriptInterface
    fun requestPermission() {
        host.onPermissionRequested()
    }

    @JavascriptInterface
    fun restart() {
        host.onRestartRequested()
    }

    @JavascriptInterface
    fun getStatus(): String = host.statusJson().toString()

    @JavascriptInterface
    fun isReady(): Boolean = host.statusJson().optBoolean("streaming", false)

    @JavascriptInterface
    fun getLabel(): String = host.statusJson().optString("label", "USB camera")

    @JavascriptInterface
    fun getWidth(): Int = host.statusJson().optInt("width", 0)

    @JavascriptInterface
    fun getHeight(): Int = host.statusJson().optInt("height", 0)

    /** Legacy pull mode. Returns "" when there is nothing new since the last call. */
    @JavascriptInterface
    fun grabFrame(): String {
        val frame = host.takeFrame(lastDeliveredId) ?: return ""
        lastDeliveredId = frame.first
        return frame.second
    }

    @JavascriptInterface
    fun log(message: String) {
        Log.i("WebGame", message)
    }

    companion object {
        private const val TAG = "WebCameraBridge"

        /** Name the shim looks for on `window`. */
        const val NAME = "AndroidUsbCamera"
    }
}
