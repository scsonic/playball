package com.nexretail.catchchallenge

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import android.hardware.camera2.CameraAccessException
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CameraMetadata
import android.hardware.camera2.CaptureRequest
import android.hardware.camera2.params.StreamConfigurationMap
import android.media.Image
import android.media.ImageReader
import android.os.Handler
import android.os.HandlerThread
import android.util.Base64
import android.util.Log
import android.util.Size
import androidx.core.content.ContextCompat
import java.io.ByteArrayOutputStream
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Camera2 capture with an external (USB / UVC) camera preferred.
 *
 * Android's Camera2 HAL reports UVC cameras as `LENS_FACING_EXTERNAL` on devices whose
 * vendor enables external camera support (common on Android 9+ tablets, sticks and
 * signage boxes). We open that camera here, natively, and push JPEG frames to the
 * WebView — which means the web game does not care where the pixels came from, and
 * works even on WebView builds that would not surface a USB camera to `getUserMedia`.
 *
 * Frames live only in memory: nothing is written to storage and nothing is uploaded.
 */
class UsbCameraSource(private val context: Context) {

    interface Listener {
        fun onCameraState(state: State, detail: String)
    }

    enum class State { IDLE, OPENING, STREAMING, NO_CAMERA, NO_PERMISSION, ERROR, DISCONNECTED }

    @Volatile
    var state: State = State.IDLE
        private set

    @Volatile
    var cameraLabel: String = ""
        private set

    @Volatile
    var frameWidth: Int = 0
        private set

    @Volatile
    var frameHeight: Int = 0
        private set

    /** True when the currently open camera is a USB/external device. */
    @Volatile
    var isExternal: Boolean = false
        private set

    var listener: Listener? = null

    private val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
    private var thread: HandlerThread? = null
    private var handler: Handler? = null
    private var device: CameraDevice? = null
    private var session: CameraCaptureSession? = null
    private var reader: ImageReader? = null

    private val starting = AtomicBoolean(false)
    private val frameIntervalMs = 1000L / Config.TARGET_FPS
    private var lastEncodedAt = 0L

    /** Latest JPEG frame, replaced in place. Only the newest frame is ever kept. */
    @Volatile
    private var latestJpeg: ByteArray? = null

    @Volatile
    private var frameId: Long = 0

    fun frameCounter(): Long = frameId

    /** Returns the newest frame as base64, or null if nothing new since [sinceId]. */
    fun takeFrameBase64(sinceId: Long): Pair<Long, String>? {
        val id = frameId
        if (id == sinceId) return null
        val jpeg = latestJpeg ?: return null
        return id to Base64.encodeToString(jpeg, Base64.NO_WRAP)
    }

    fun start() {
        if (!starting.compareAndSet(false, true)) return
        try {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED
            ) {
                update(State.NO_PERMISSION, "camera permission not granted")
                return
            }

            stopInternal()
            ensureThread()

            val cameraId = pickCamera()
            if (cameraId == null) {
                update(State.NO_CAMERA, "no usable camera")
                return
            }

            val characteristics = manager.getCameraCharacteristics(cameraId)
            val facing = characteristics.get(CameraCharacteristics.LENS_FACING)
            isExternal = facing == CameraMetadata.LENS_FACING_EXTERNAL
            cameraLabel = (if (isExternal) "USB camera " else "Built-in camera ") + cameraId

            val size = pickSize(characteristics)
            frameWidth = size.width
            frameHeight = size.height

            reader = ImageReader.newInstance(size.width, size.height, ImageFormat.YUV_420_888, 3).apply {
                setOnImageAvailableListener({ r -> onImage(r) }, handler)
            }

            update(State.OPENING, cameraLabel)
            manager.openCamera(cameraId, stateCallback, handler)
        } catch (e: CameraAccessException) {
            update(State.ERROR, "camera access: ${e.message}")
        } catch (e: SecurityException) {
            update(State.NO_PERMISSION, e.message ?: "permission denied")
        } catch (e: Exception) {
            update(State.ERROR, e.message ?: "unknown error")
        } finally {
            starting.set(false)
        }
    }

    fun stop() {
        stopInternal()
        thread?.quitSafely()
        thread = null
        handler = null
        update(State.IDLE, "stopped")
    }

    /** True when at least one external camera is currently enumerated. */
    fun hasExternalCamera(): Boolean = try {
        manager.cameraIdList.any {
            manager.getCameraCharacteristics(it).get(CameraCharacteristics.LENS_FACING) ==
                CameraMetadata.LENS_FACING_EXTERNAL
        }
    } catch (e: Exception) {
        false
    }

    // ------------------------------------------------------------------ internals

    private fun ensureThread() {
        if (thread == null) {
            thread = HandlerThread("usb-camera").also { it.start() }
            handler = Handler(thread!!.looper)
        }
    }

    private fun pickCamera(): String? {
        val ids = manager.cameraIdList
        if (ids.isEmpty()) return null

        if (Config.PREFER_EXTERNAL_CAMERA) {
            ids.firstOrNull {
                manager.getCameraCharacteristics(it).get(CameraCharacteristics.LENS_FACING) ==
                    CameraMetadata.LENS_FACING_EXTERNAL
            }?.let { return it }
        }
        if (!Config.ALLOW_BUILTIN_FALLBACK) return null

        // A player stands in front of the display, so the front camera is the better
        // fallback; some signage boxes only expose a back camera.
        return ids.firstOrNull {
            manager.getCameraCharacteristics(it).get(CameraCharacteristics.LENS_FACING) ==
                CameraMetadata.LENS_FACING_FRONT
        } ?: ids.first()
    }

    private fun pickSize(characteristics: CameraCharacteristics): Size {
        val map: StreamConfigurationMap =
            characteristics.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
                ?: return Size(640, 480)
        val sizes = map.getOutputSizes(ImageFormat.YUV_420_888)
            ?: return Size(640, 480)

        val target = Config.CAPTURE_WIDTH * Config.CAPTURE_HEIGHT
        return sizes.minByOrNull { size ->
            val area = size.width * size.height
            // Prefer 16:9-ish sizes close to the requested area.
            val ratioPenalty = kotlin.math.abs(size.width.toFloat() / size.height - 16f / 9f) * target * 0.25f
            kotlin.math.abs(area - target) + ratioPenalty.toInt()
        } ?: Size(640, 480)
    }

    private val stateCallback = object : CameraDevice.StateCallback() {
        override fun onOpened(camera: CameraDevice) {
            device = camera
            createSession(camera)
        }

        override fun onDisconnected(camera: CameraDevice) {
            // This is the USB unplug path.
            camera.close()
            device = null
            update(State.DISCONNECTED, "camera disconnected")
        }

        override fun onError(camera: CameraDevice, error: Int) {
            camera.close()
            device = null
            update(State.ERROR, "camera error $error")
        }
    }

    @Suppress("DEPRECATION")
    private fun createSession(camera: CameraDevice) {
        val surface = reader?.surface ?: return
        try {
            camera.createCaptureSession(
                listOf(surface),
                object : CameraCaptureSession.StateCallback() {
                    override fun onConfigured(configured: CameraCaptureSession) {
                        session = configured
                        val request = camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
                            addTarget(surface)
                            set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_VIDEO)
                            set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON)
                        }
                        try {
                            configured.setRepeatingRequest(request.build(), null, handler)
                            update(State.STREAMING, "$cameraLabel ${frameWidth}x$frameHeight")
                        } catch (e: Exception) {
                            update(State.ERROR, "repeating request: ${e.message}")
                        }
                    }

                    override fun onConfigureFailed(configured: CameraCaptureSession) {
                        update(State.ERROR, "capture session configuration failed")
                    }
                },
                handler,
            )
        } catch (e: Exception) {
            update(State.ERROR, "create session: ${e.message}")
        }
    }

    private fun onImage(imageReader: ImageReader) {
        val image = try {
            imageReader.acquireLatestImage()
        } catch (e: Exception) {
            null
        } ?: return

        try {
            val now = System.currentTimeMillis()
            if (now - lastEncodedAt < frameIntervalMs) return // drop, keep latency low
            lastEncodedAt = now

            val jpeg = image.toJpeg(Config.JPEG_QUALITY) ?: return
            latestJpeg = jpeg
            frameId++
        } catch (e: Exception) {
            Log.w(TAG, "frame encode failed", e)
        } finally {
            image.close()
        }
    }

    private fun stopInternal() {
        try {
            session?.stopRepeating()
        } catch (e: Exception) {
            /* session already gone */
        }
        session?.close()
        session = null
        device?.close()
        device = null
        reader?.close()
        reader = null
        latestJpeg = null
    }

    private fun update(next: State, detail: String) {
        state = next
        Log.i(TAG, "camera state=$next detail=$detail")
        listener?.onCameraState(next, detail)
    }

    companion object {
        private const val TAG = "UsbCameraSource"
    }
}

/**
 * YUV_420_888 → NV21 → JPEG.
 *
 * Handles row and pixel strides properly: UVC cameras routinely hand back padded
 * buffers, and ignoring the strides is what produces the classic green-skew image.
 */
private fun Image.toJpeg(quality: Int): ByteArray? {
    if (format != ImageFormat.YUV_420_888) return null

    val width = width
    val height = height
    val nv21 = ByteArray(width * height * 3 / 2)

    val yPlane = planes[0]
    val uPlane = planes[1]
    val vPlane = planes[2]

    // Y
    var outputOffset = 0
    val yBuffer = yPlane.buffer
    val yRowStride = yPlane.rowStride
    val yPixelStride = yPlane.pixelStride
    val rowBuffer = ByteArray(yRowStride)
    for (row in 0 until height) {
        yBuffer.position(row * yRowStride)
        if (yPixelStride == 1) {
            val length = minOf(width, yBuffer.remaining())
            yBuffer.get(nv21, outputOffset, length)
            outputOffset += width
        } else {
            val length = minOf(yRowStride, yBuffer.remaining())
            yBuffer.get(rowBuffer, 0, length)
            for (col in 0 until width) nv21[outputOffset++] = rowBuffer[col * yPixelStride]
        }
    }

    // Interleaved VU for NV21
    val chromaHeight = height / 2
    val chromaWidth = width / 2
    val uBuffer = uPlane.buffer
    val vBuffer = vPlane.buffer
    val uRowStride = uPlane.rowStride
    val vRowStride = vPlane.rowStride
    val uPixelStride = uPlane.pixelStride
    val vPixelStride = vPlane.pixelStride

    for (row in 0 until chromaHeight) {
        for (col in 0 until chromaWidth) {
            val vIndex = row * vRowStride + col * vPixelStride
            val uIndex = row * uRowStride + col * uPixelStride
            if (vIndex >= vBuffer.limit() || uIndex >= uBuffer.limit()) continue
            nv21[outputOffset++] = vBuffer.get(vIndex)
            nv21[outputOffset++] = uBuffer.get(uIndex)
        }
    }

    val out = ByteArrayOutputStream(width * height / 4)
    return if (YuvImage(nv21, ImageFormat.NV21, width, height, null)
            .compressToJpeg(Rect(0, 0, width, height), quality, out)
    ) {
        out.toByteArray()
    } else {
        null
    }
}
