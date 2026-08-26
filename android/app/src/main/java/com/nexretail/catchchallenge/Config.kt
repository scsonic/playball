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

    /**
     * Requested capture size. The closest size the camera actually offers is used.
     *
     * VGA on purpose: hand tracking does not benefit from more pixels, while every
     * extra pixel costs NV21→JPEG encoding time on the device and bytes across the
     * JavaScript bridge. 640×480 keeps a 1080p signage kiosk responsive.
     */
    const val CAPTURE_WIDTH = 640
    const val CAPTURE_HEIGHT = 480

    /**
     * Frames handed to the WebView per second.
     *
     * 10 is plenty for palm tracking: the cursor is smoothed and rendered at display
     * rate regardless, so the extra frames mostly buy encoding cost. Raise it if the
     * hardware has headroom.
     */
    const val TARGET_FPS = 10

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
