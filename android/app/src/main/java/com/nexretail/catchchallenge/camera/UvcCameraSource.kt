package com.nexretail.catchchallenge.camera

import android.content.Context
import android.graphics.SurfaceTexture
import android.hardware.usb.UsbDevice
import android.os.Handler
import android.os.HandlerThread
import android.util.Base64
import android.util.Log
import android.view.Surface
import com.herohan.uvcapp.CameraException
import com.herohan.uvcapp.CameraHelper
import com.herohan.uvcapp.ICameraHelper
import com.nexretail.catchchallenge.Config
import com.serenegiant.usb.IFrameCallback
import com.serenegiant.usb.Size
import com.serenegiant.usb.UVCCamera
import java.nio.ByteBuffer

/**
 * USB camera capture through libuvc (com.herohan:UVCAndroid).
 *
 * This is the path that actually works on most Android hardware. Camera2 only sees a
 * UVC device when the vendor's HAL chooses to expose external cameras, which many
 * signage boxes and tablets do not. libuvc talks to the device directly over the USB
 * host API — the trade-off being that Android must ask the user to approve access to
 * that specific device first ("Allow the app to access the USB device?"), which is
 * exactly what [requestPermission] triggers via `selectDevice`.
 *
 * Frames arrive as NV21 on a native callback thread, are JPEG-encoded on a worker
 * thread, and are handed to the sink. Nothing is written to disk.
 */
class UvcCameraSource(
    private val context: Context,
    private val sink: FrameSink,
) : CameraSource {

    override val transport = "uvc"

    private var helper: ICameraHelper? = null
    private var device: UsbDevice? = null
    private var previewSurface: Surface? = null
    private var surfaceTexture: SurfaceTexture? = null

    private var encodeThread: HandlerThread? = null
    private var encodeHandler: Handler? = null
    private val mainHandler = Handler(android.os.Looper.getMainLooper())
    private var openAttempts = 0

    @Volatile
    private var streaming = false

    @Volatile
    private var frameWidth = 0

    @Volatile
    private var frameHeight = 0

    @Volatile
    private var cameraLabel = "USB camera"

    @Volatile
    private var encoding = false

    @Volatile
    private var framesEncoded = 0L

    @Volatile
    private var framesReceived = 0L

    @Volatile
    private var supportedSizes: List<Size> = emptyList()

    private var lastFrameAt = 0L
    private val frameIntervalMs = 1000L / Config.TARGET_FPS

    override fun isAvailable(): Boolean = try {
        // The helper is not up yet at probe time, so ask the USB service directly.
        val manager = context.getSystemService(Context.USB_SERVICE) as android.hardware.usb.UsbManager
        manager.deviceList.values.any { it.isVideoDevice() }
    } catch (e: Exception) {
        false
    }

    override fun start() {
        if (helper != null) {
            Log.i(TAG, "start() ignored: helper already created")
            return
        }
        ensureEncodeThread()

        helper = CameraHelper().apply {
            setStateCallback(stateCallback)
        }

        val devices = helper?.deviceList.orEmpty()
        Log.i(TAG, "UVC devices visible to the helper: ${devices.size}")
        devices.forEach {
            Log.i(
                TAG,
                "  ${it.deviceName} vid=${it.vendorId} pid=${it.productId} " +
                    "class=${it.deviceClass} interfaces=${it.interfaceCount} video=${it.isVideoDevice()}",
            )
        }
        if (devices.isEmpty()) {
            sink.onCameraState(CameraState.NO_CAMERA, "no UVC device attached")
            return
        }
        // Opening a device the user already approved does not re-prompt; a new one does.
        selectFirstDevice()
    }

    override fun requestPermission() {
        if (helper == null) {
            start()
            return
        }
        if (streaming) {
            // Already live. Re-selecting the device here would tear down a working
            // camera and reopen it — which is exactly what happens when the player
            // presses "Enable camera" after the kiosk has already found the device.
            Log.i(TAG, "requestPermission ignored: already streaming")
            sink.onCameraOpen(frameWidth, frameHeight, cameraLabel, transport)
            sink.onCameraState(CameraState.STREAMING, "$cameraLabel ${frameWidth}x$frameHeight")
            return
        }
        selectFirstDevice()
    }

    private fun selectFirstDevice() {
        val target = helper?.deviceList?.firstOrNull { it.isVideoDevice() } ?: helper?.deviceList?.firstOrNull()
        if (target == null) {
            sink.onCameraState(CameraState.NO_CAMERA, "no UVC device attached")
            return
        }
        device = target
        Log.i(TAG, "selectDevice ${target.deviceName} (${target.productName})")
        sink.onCameraState(CameraState.WAITING_PERMISSION, "requesting access to ${target.productName ?: target.deviceName}")
        try {
            // Shows the system USB permission dialog when the device is not yet approved.
            helper?.selectDevice(target)
        } catch (e: Exception) {
            Log.e(TAG, "selectDevice failed", e)
            sink.onCameraState(CameraState.ERROR, "selectDevice: ${e.message}")
        }
    }

    /**
     * Opens the camera, with retries.
     *
     * libuvc can answer BUSY when it claims the interface immediately after the USB
     * device is opened — the service is still settling, or a previous handle has not
     * been released yet. Backing off and retrying is far more reliable than opening
     * once and giving up.
     */
    private fun openCameraSoon(delayMs: Long) {
        mainHandler.removeCallbacks(openRetry)
        mainHandler.postDelayed(openRetry, delayMs)
    }

    private val openRetry = Runnable {
        val h = helper ?: return@Runnable
        openAttempts++
        try {
            Log.i(TAG, "openCamera attempt $openAttempts")
            h.openCamera()
        } catch (e: Exception) {
            Log.e(TAG, "openCamera threw", e)
        }
        // onCameraOpen clears this; if it never arrives, back off and try again.
        if (openAttempts < MAX_OPEN_ATTEMPTS) {
            mainHandler.postDelayed(openWatchdog, 1500)
        } else {
            sink.onCameraState(CameraState.ERROR, "could not open the USB camera after $openAttempts attempts")
        }
    }

    private val openWatchdog = Runnable {
        if (streaming) return@Runnable
        Log.w(TAG, "no onCameraOpen after attempt $openAttempts — closing and retrying")
        try {
            helper?.closeCamera()
        } catch (e: Exception) {
            Log.w(TAG, "closeCamera before retry failed", e)
        }
        openCameraSoon(600)
    }

    override fun stop() {
        mainHandler.removeCallbacks(openRetry)
        mainHandler.removeCallbacks(openWatchdog)
        openAttempts = 0
        streaming = false
        try {
            helper?.setFrameCallback(null, 0)
            helper?.closeCamera()
            helper?.release()
        } catch (e: Exception) {
            Log.w(TAG, "stop failed", e)
        }
        helper = null
        device = null
        releaseSurface()
        encodeThread?.quitSafely()
        encodeThread = null
        encodeHandler = null
    }

    override fun isStreaming(): Boolean = streaming

    // ---------------------------------------------------------------- callbacks

    private val stateCallback = object : ICameraHelper.StateCallback {
        override fun onAttach(attached: UsbDevice) {
            Log.i(TAG, "onAttach ${attached.deviceName}")
            if (device == null && attached.isVideoDevice()) {
                device = attached
                sink.onCameraState(CameraState.WAITING_PERMISSION, "USB camera attached")
                helper?.selectDevice(attached)
            }
        }

        override fun onDeviceOpen(opened: UsbDevice, isFirstOpen: Boolean) {
            Log.i(TAG, "onDeviceOpen ${opened.deviceName} firstOpen=$isFirstOpen")
            sink.onCameraState(CameraState.OPENING, "opening ${opened.productName ?: "USB camera"}")
            openCameraSoon(0)
        }

        override fun onCameraOpen(opened: UsbDevice) {
            Log.i(TAG, "onCameraOpen ${opened.deviceName}")
            openAttempts = 0
            mainHandler.removeCallbacks(openRetry)
            val h = helper ?: return
            try {
                val picked = pickSize(h)
                picked?.let {
                    try {
                        h.previewSize = it
                    } catch (e: Exception) {
                        Log.w(TAG, "setPreviewSize failed, keeping the default", e)
                    }
                }

                // Trust the size we asked for, not the read-back: `previewSize` still
                // reports the previous value at this point on some builds, and a wrong
                // frame size means every incoming buffer looks truncated and is dropped.
                // `frameCallback` corrects it from the real buffer length anyway.
                supportedSizes = runCatching { h.supportedSizeList }.getOrNull().orEmpty()
                val size = picked ?: h.previewSize
                frameWidth = size?.width ?: UVCCamera.DEFAULT_PREVIEW_WIDTH
                frameHeight = size?.height ?: UVCCamera.DEFAULT_PREVIEW_HEIGHT

                // libuvc wants a preview target; an off-screen SurfaceTexture keeps the
                // pipeline alive without putting a second camera view on the kiosk screen.
                attachOffscreenSurface(h, frameWidth, frameHeight)

                h.startPreview()
                // Callback after startPreview: some builds drop a callback registered
                // while the stream is still being negotiated.
                h.setFrameCallback(frameCallback, UVCCamera.PIXEL_FORMAT_NV21)

                streaming = true
                cameraLabel = opened.productName ?: "USB camera"
                Log.i(TAG, "streaming ${frameWidth}x$frameHeight from $cameraLabel")
                sink.onCameraOpen(frameWidth, frameHeight, cameraLabel, transport)
                sink.onCameraState(CameraState.STREAMING, "$cameraLabel ${frameWidth}x$frameHeight")
            } catch (e: Exception) {
                sink.onCameraState(CameraState.ERROR, "startPreview: ${e.message}")
            }
        }

        override fun onCameraClose(closed: UsbDevice) {
            Log.i(TAG, "onCameraClose ${closed.deviceName}")
            streaming = false
            try {
                helper?.setFrameCallback(null, 0)
            } catch (e: Exception) {
                /* already torn down */
            }
            sink.onCameraClose("camera_closed")
        }

        override fun onDeviceClose(closed: UsbDevice) {
            Log.i(TAG, "onDeviceClose ${closed.deviceName}")
            streaming = false
        }

        override fun onDetach(detached: UsbDevice) {
            Log.i(TAG, "onDetach")
            streaming = false
            device = null
            releaseSurface()
            sink.onCameraClose("unplugged")
            sink.onCameraState(CameraState.DISCONNECTED, "USB camera unplugged")
        }

        override fun onCancel(cancelled: UsbDevice) {
            // The user dismissed or denied the USB permission dialog.
            Log.w(TAG, "onCancel ${cancelled.deviceName} — permission dialog dismissed")
            streaming = false
            sink.onCameraState(CameraState.NO_PERMISSION, "USB permission denied")
        }

        override fun onError(errored: UsbDevice, e: CameraException) {
            Log.e(TAG, "onError ${errored.deviceName}: ${e.message}", e)
            streaming = false
            sink.onCameraState(CameraState.ERROR, e.message ?: "camera exception")
        }
    }

    private val frameCallback = IFrameCallback { buffer: ByteBuffer ->
        framesReceived++
        if (framesReceived <= 3L || framesReceived % 240L == 0L) {
            Log.i(
                TAG,
                "frame callback #$framesReceived bytes=${buffer.remaining()} " +
                    "expected=${frameWidth * frameHeight * 3 / 2} (${frameWidth}x$frameHeight)",
            )
        }
        if (!streaming) return@IFrameCallback
        val now = System.currentTimeMillis()
        if (now - lastFrameAt < frameIntervalMs) return@IFrameCallback
        // Drop instead of queueing: the newest frame is the only one worth having,
        // and an unbounded queue would grow whenever encoding falls behind.
        if (encoding) return@IFrameCallback
        lastFrameAt = now

        var width = frameWidth
        var height = frameHeight
        var expected = width * height * 3 / 2
        if (width <= 0 || height <= 0) return@IFrameCallback

        if (buffer.remaining() < expected) {
            // The stream is not the size we think it is. Recover by matching the buffer
            // length against the sizes this camera advertises, rather than dropping
            // every frame forever.
            val actual = sizeForNv21Length(buffer.remaining())
            if (actual == null) {
                if (framesReceived <= 3L) {
                    Log.w(TAG, "unrecognised frame length ${buffer.remaining()} (expected $expected) — dropping")
                }
                return@IFrameCallback
            }
            Log.i(TAG, "frame size corrected: ${width}x$height → ${actual.width}x${actual.height}")
            frameWidth = actual.width
            frameHeight = actual.height
            width = actual.width
            height = actual.height
            expected = width * height * 3 / 2
            // Tell the page about the real resolution so its canvas matches.
            sink.onCameraOpen(width, height, cameraLabel, transport)
        }

        val nv21 = ByteArray(expected)
        buffer.get(nv21, 0, expected)
        encoding = true

        encodeHandler?.post {
            try {
                val jpeg = nv21ToJpeg(nv21, width, height, Config.JPEG_QUALITY)
                if (jpeg != null) {
                    framesEncoded++
                    // First frame and then a heartbeat: enough to prove the pipeline is
                    // alive in a field log without flooding it.
                    if (framesEncoded == 1L || framesEncoded % 120L == 0L) {
                        Log.i(TAG, "frame #$framesEncoded ${width}x$height ${jpeg.size / 1024}KB")
                    }
                    sink.onFrame(Base64.encodeToString(jpeg, Base64.NO_WRAP))
                }
            } catch (e: Exception) {
                Log.w(TAG, "encode failed", e)
            } finally {
                encoding = false
            }
        } ?: run { encoding = false }
    }

    // ---------------------------------------------------------------- internals

    /** Finds the advertised size whose NV21 frame is exactly [length] bytes. */
    private fun sizeForNv21Length(length: Int): Size? =
        supportedSizes.firstOrNull { it.width * it.height * 3 / 2 == length }

    private fun pickSize(h: ICameraHelper): Size? {
        val sizes = try {
            h.supportedSizeList
        } catch (e: Exception) {
            Log.w(TAG, "supportedSizeList failed", e)
            null
        } ?: return null
        if (sizes.isEmpty()) return null

        Log.i(TAG, "supported sizes: " + sizes.joinToString { "${it.width}x${it.height}@${it.fps}(type=${it.type})" })

        val target = Config.CAPTURE_WIDTH * Config.CAPTURE_HEIGHT
        val picked = sizes.minByOrNull { size -> kotlin.math.abs(size.width * size.height - target) }
        Log.i(TAG, "picked size ${picked?.width}x${picked?.height}")
        return picked
    }

    private fun attachOffscreenSurface(h: ICameraHelper, width: Int, height: Int) {
        releaseSurface()
        val texture = SurfaceTexture(SURFACE_TEXTURE_NAME).apply {
            setDefaultBufferSize(width, height)
        }
        val surface = Surface(texture)
        surfaceTexture = texture
        previewSurface = surface
        try {
            h.addSurface(surface, false)
        } catch (e: Exception) {
            Log.w(TAG, "addSurface failed; relying on the frame callback alone", e)
        }
    }

    private fun releaseSurface() {
        try {
            previewSurface?.let { helper?.removeSurface(it) }
        } catch (e: Exception) {
            /* helper may already be gone */
        }
        previewSurface?.release()
        surfaceTexture?.release()
        previewSurface = null
        surfaceTexture = null
    }

    private fun ensureEncodeThread() {
        if (encodeThread == null) {
            encodeThread = HandlerThread("uvc-encode").also { it.start() }
            encodeHandler = Handler(encodeThread!!.looper)
        }
    }

    companion object {
        private const val TAG = "UvcCameraSource"
        private const val SURFACE_TEXTURE_NAME = 10
        private const val MAX_OPEN_ATTEMPTS = 4
    }
}

/** USB Video Class: base class 0x0E, or a misc/IAD composite device that contains one. */
fun UsbDevice.isVideoDevice(): Boolean {
    if (deviceClass == 14) return true
    for (i in 0 until interfaceCount) {
        if (getInterface(i).interfaceClass == 14) return true
    }
    return deviceClass == 239 // Miscellaneous / IAD, used by many webcams
}
