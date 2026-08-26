package com.nexretail.catchchallenge.camera

import android.content.Context
import android.util.Log
import com.nexretail.catchchallenge.Config

/**
 * Chooses how to reach the camera and keeps that choice honest at runtime.
 *
 * Order of preference:
 *  1. **UVC over libuvc** — works on essentially any device with USB host support, at
 *     the cost of one system permission dialog for the device.
 *  2. **Camera2 external** — no extra dialog, but only on devices whose HAL exposes
 *     USB cameras.
 *  3. **Camera2 built-in** — so the kiosk (and development on a laptop-class tablet)
 *     still has a camera when no USB device is present.
 */
class CameraCoordinator(
    context: Context,
    private val sink: FrameSink,
) : FrameSink {

    private val uvc = UvcCameraSource(context, this)
    private val camera2 = Camera2CameraSource(context, this)

    private var active: CameraSource? = null
    private var lastState: CameraState = CameraState.IDLE

    val transport: String get() = active?.transport ?: "none"

    fun start() {
        val preferred = choose()
        if (active !== preferred) {
            active?.stop()
            active = preferred
        }
        Log.i(TAG, "starting camera via ${preferred.transport}")
        preferred.start()
    }

    /**
     * Triggered by the game's own "Enable camera" button through the JS bridge, so the
     * USB permission dialog appears as a direct consequence of a player action.
     */
    fun requestPermission() {
        val source = active ?: choose().also { active = it }
        source.requestPermission()
    }

    fun restart() {
        active?.stop()
        active = null
        start()
    }

    fun stop() {
        uvc.stop()
        camera2.release()
        active = null
    }

    fun isStreaming(): Boolean = active?.isStreaming() == true

    fun state(): CameraState = lastState

    /** Re-evaluates the transport, e.g. after a device is plugged in. */
    fun onUsbTopologyChanged() {
        val preferred = choose()
        if (active !== preferred || active?.isStreaming() != true) {
            restart()
        }
    }

    private fun choose(): CameraSource {
        if (Config.PREFER_UVC && uvc.isAvailable()) return uvc
        if (camera2.hasExternalCamera()) return camera2
        if (uvc.isAvailable()) return uvc
        return camera2
    }

    // Pass-through: the coordinator is itself a sink so it can watch state changes.
    override fun onCameraOpen(width: Int, height: Int, label: String, transport: String) =
        sink.onCameraOpen(width, height, label, transport)

    override fun onFrame(jpegBase64: String) = sink.onFrame(jpegBase64)

    override fun onCameraClose(reason: String) = sink.onCameraClose(reason)

    override fun onCameraState(state: CameraState, detail: String) {
        lastState = state
        sink.onCameraState(state, detail)
    }

    companion object {
        private const val TAG = "CameraCoordinator"
    }
}
