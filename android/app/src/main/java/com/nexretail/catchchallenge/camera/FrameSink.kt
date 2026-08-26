package com.nexretail.catchchallenge.camera

/** How a camera source reports itself to the rest of the app. */
enum class CameraState { IDLE, WAITING_PERMISSION, OPENING, STREAMING, NO_CAMERA, NO_PERMISSION, ERROR, DISCONNECTED }

/**
 * Where camera frames go.
 *
 * Sources know nothing about WebViews, and the WebView side knows nothing about
 * UVC or Camera2 — this is the only thing between them.
 */
interface FrameSink {
    /** A camera became available at this resolution. */
    fun onCameraOpen(width: Int, height: Int, label: String, transport: String)

    /** One frame, JPEG encoded and base64'd, ready to hand to the page. */
    fun onFrame(jpegBase64: String)

    /** The camera went away. [reason] is passed through to the page. */
    fun onCameraClose(reason: String)

    /** Status for the operator banner and logs. */
    fun onCameraState(state: CameraState, detail: String)
}

/** A camera implementation: UVC over USB, or the platform's Camera2. */
interface CameraSource {
    val transport: String

    /** True when this source can work on this device right now. */
    fun isAvailable(): Boolean

    /** Begin: enumerate, open if already permitted, otherwise wait for permission. */
    fun start()

    /** Show the system permission dialog for the device, if one is needed. */
    fun requestPermission()

    fun stop()

    fun isStreaming(): Boolean
}
