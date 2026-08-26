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

    @Volatile
    private var streaming = false

    @Volatile
    private var frameWidth = 0

    @Volatile
    private var frameHeight = 0

    @Volatile
    private var encoding = false

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
        if (helper != null) return
        ensureEncodeThread()

        helper = CameraHelper().apply {
            setStateCallback(stateCallback)
        }

        val devices = helper?.deviceList.orEmpty()
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
        selectFirstDevice()
    }

    private fun selectFirstDevice() {
        val target = helper?.deviceList?.firstOrNull { it.isVideoDevice() } ?: helper?.deviceList?.firstOrNull()
        if (target == null) {
            sink.onCameraState(CameraState.NO_CAMERA, "no UVC device attached")
            return
        }
        device = target
        sink.onCameraState(CameraState.WAITING_PERMISSION, "requesting access to ${target.productName ?: target.deviceName}")
        try {
            // Shows the system USB permission dialog when the device is not yet approved.
            helper?.selectDevice(target)
        } catch (e: Exception) {
            sink.onCameraState(CameraState.ERROR, "selectDevice: ${e.message}")
        }
    }

    override fun stop() {
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
            Log.i(TAG, "onDeviceOpen firstOpen=$isFirstOpen")
            sink.onCameraState(CameraState.OPENING, "opening ${opened.productName ?: "USB camera"}")
            try {
                helper?.openCamera()
            } catch (e: Exception) {
                sink.onCameraState(CameraState.ERROR, "openCamera: ${e.message}")
            }
        }

        override fun onCameraOpen(opened: UsbDevice) {
            val h = helper ?: return
            try {
                pickSize(h)?.let { h.previewSize = it }

                // libuvc wants a preview target; an off-screen SurfaceTexture keeps the
                // pipeline alive without putting a second camera view on the kiosk screen.
                val size = h.previewSize
                frameWidth = size?.width ?: UVCCamera.DEFAULT_PREVIEW_WIDTH
                frameHeight = size?.height ?: UVCCamera.DEFAULT_PREVIEW_HEIGHT
                attachOffscreenSurface(h, frameWidth, frameHeight)

                h.setFrameCallback(frameCallback, UVCCamera.PIXEL_FORMAT_NV21)
                h.startPreview()

                streaming = true
                val label = opened.productName ?: "USB camera"
                sink.onCameraOpen(frameWidth, frameHeight, label, transport)
                sink.onCameraState(CameraState.STREAMING, "$label ${frameWidth}x$frameHeight")
            } catch (e: Exception) {
                sink.onCameraState(CameraState.ERROR, "startPreview: ${e.message}")
            }
        }

        override fun onCameraClose(closed: UsbDevice) {
            streaming = false
            try {
                helper?.setFrameCallback(null, 0)
            } catch (e: Exception) {
                /* already torn down */
            }
            sink.onCameraClose("camera_closed")
        }

        override fun onDeviceClose(closed: UsbDevice) {
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
            streaming = false
            sink.onCameraState(CameraState.NO_PERMISSION, "USB permission denied")
        }

        override fun onError(errored: UsbDevice, e: CameraException) {
            streaming = false
            sink.onCameraState(CameraState.ERROR, e.message ?: "camera exception")
        }
    }

    private val frameCallback = IFrameCallback { buffer: ByteBuffer ->
        if (!streaming) return@IFrameCallback
        val now = System.currentTimeMillis()
        if (now - lastFrameAt < frameIntervalMs) return@IFrameCallback
        // Drop instead of queueing: the newest frame is the only one worth having,
        // and an unbounded queue would grow whenever encoding falls behind.
        if (encoding) return@IFrameCallback
        lastFrameAt = now

        val width = frameWidth
        val height = frameHeight
        val expected = width * height * 3 / 2
        if (width <= 0 || height <= 0 || buffer.remaining() < expected) return@IFrameCallback

        val nv21 = ByteArray(expected)
        buffer.get(nv21, 0, expected)
        encoding = true

        encodeHandler?.post {
            try {
                val jpeg = nv21ToJpeg(nv21, width, height, Config.JPEG_QUALITY)
                if (jpeg != null) sink.onFrame(Base64.encodeToString(jpeg, Base64.NO_WRAP))
            } catch (e: Exception) {
                Log.w(TAG, "encode failed", e)
            } finally {
                encoding = false
            }
        } ?: run { encoding = false }
    }

    // ---------------------------------------------------------------- internals

    private fun pickSize(h: ICameraHelper): Size? {
        val sizes = try {
            h.supportedSizeList
        } catch (e: Exception) {
            null
        } ?: return null
        if (sizes.isEmpty()) return null

        val target = Config.CAPTURE_WIDTH * Config.CAPTURE_HEIGHT
        return sizes.minByOrNull { size ->
            kotlin.math.abs(size.width * size.height - target)
        }
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
