package com.nexretail.catchchallenge

/**
 * Kiosk configuration.
 *
 * The web game itself is unchanged: this app hosts it and feeds it a USB camera.
 */
object Config {

    /**
     * When true the game is loaded from the APK's own assets over the
     * `https://appassets.androidplatform.net` origin provided by WebViewAssetLoader.
     *
     * The https origin matters: `getUserMedia` and the MediaPipe WASM runtime both
     * require a secure context, and `file://` is not one.
     */
    const val USE_BUNDLED_SITE = true

    /** Which edition to open. Point at `/assets/web/index.html` for the edition-select page. */
    const val BUNDLED_URL = "https://appassets.androidplatform.net/assets/web/claude/index.html"

    /** Used when USE_BUNDLED_SITE is false. */
    const val REMOTE_URL = "https://scsonic.github.io/playball/claude/"

    /** Requested capture size. The closest size the camera actually offers is used. */
    const val CAPTURE_WIDTH = 1280
    const val CAPTURE_HEIGHT = 720

    /**
     * Frames handed to the WebView per second. Hand tracking needs 24–30 FPS; going
     * higher only costs JPEG encoding time and bridge traffic.
     */
    const val TARGET_FPS = 24

    /** JPEG quality for the bridge frames. 55–70 is the sweet spot for tracking. */
    const val JPEG_QUALITY = 62

    /**
     * Prefer libuvc (com.herohan:UVCAndroid) for USB cameras.
     *
     * This is the reliable path: it works even when the device's camera HAL never
     * exposes external cameras, at the cost of one system permission dialog for the
     * USB device. Set to false to force the Camera2 path.
     */
    const val PREFER_UVC = true

    /** Prefer an external (USB) camera over the built-in ones. */
    const val PREFER_EXTERNAL_CAMERA = true

    /** Fall back to a built-in camera when no USB camera is connected. */
    const val ALLOW_BUILTIN_FALLBACK = true
}
