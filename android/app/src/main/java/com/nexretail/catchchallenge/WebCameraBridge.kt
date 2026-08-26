package com.nexretail.catchchallenge

import android.util.Log
import android.webkit.JavascriptInterface
import org.json.JSONObject

/**
 * The JavaScript ⇄ native bridge.
 *
 * The page *pulls* frames instead of native pushing them. Pulling gives the web side
 * natural back-pressure: if the browser is busy running MediaPipe, it simply asks for
 * the next frame later, and native drops the ones in between rather than queueing
 * work nobody will use.
 */
class WebCameraBridge(private val source: UsbCameraSource) {

    /** Frame id the page has already received, so we never send the same JPEG twice. */
    @Volatile
    private var lastDeliveredId: Long = -1

    @JavascriptInterface
    fun isReady(): Boolean = source.state == UsbCameraSource.State.STREAMING

    @JavascriptInterface
    fun isExternal(): Boolean = source.isExternal

    @JavascriptInterface
    fun getLabel(): String = source.cameraLabel.ifEmpty { "USB camera" }

    @JavascriptInterface
    fun getWidth(): Int = source.frameWidth

    @JavascriptInterface
    fun getHeight(): Int = source.frameHeight

    /** Newest JPEG as base64, or "" when there is nothing new since the last call. */
    @JavascriptInterface
    fun grabFrame(): String {
        val frame = source.takeFrameBase64(lastDeliveredId) ?: return ""
        lastDeliveredId = frame.first
        return frame.second
    }

    @JavascriptInterface
    fun getStatus(): String = JSONObject()
        .put("state", source.state.name)
        .put("label", source.cameraLabel)
        .put("external", source.isExternal)
        .put("width", source.frameWidth)
        .put("height", source.frameHeight)
        .put("frames", source.frameCounter())
        .toString()

    /** Lets the page ask for a re-open, e.g. after the operator re-seats the cable. */
    @JavascriptInterface
    fun restart() {
        source.start()
    }

    @JavascriptInterface
    fun log(message: String) {
        Log.i("WebGame", message)
    }

    companion object {
        /** Name the shim looks for on `window`. */
        const val NAME = "AndroidUsbCamera"
    }
}
