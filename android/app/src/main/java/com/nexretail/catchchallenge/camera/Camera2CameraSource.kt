package com.nexretail.catchchallenge.camera

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.ImageFormat
import android.hardware.camera2.CameraAccessException
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CameraMetadata
import android.hardware.camera2.CaptureRequest
import android.hardware.camera2.params.StreamConfigurationMap
import android.media.ImageReader
import android.os.Handler
import android.os.HandlerThread
import android.util.Base64
import android.util.Log
import android.util.Size
import androidx.core.content.ContextCompat
import com.nexretail.catchchallenge.Config

/**
 * Platform Camera2 capture, used as the fallback path.
 *
 * Some devices *do* expose a UVC camera as `LENS_FACING_EXTERNAL`, and every device
 * with a built-in camera can be developed and demoed against. When neither the UVC
 * path nor an external Camera2 device exists, this still gives the kiosk a working
 * camera (front-facing by default, since the player stands in front of the display).
 */
class Camera2CameraSource(
    private val context: Context,
    private val sink: FrameSink,
) : CameraSource {

    override val transport = "camera2"

    private val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
    private var thread: HandlerThread? = null
    private var handler: Handler? = null
    private var device: CameraDevice? = null
    private var session: CameraCaptureSession? = null
    private var reader: ImageReader? = null

    @Volatile
    private var streaming = false

    @Volatile
    private var encoding = false

    private var lastFrameAt = 0L
    private val frameIntervalMs = 1000L / Config.TARGET_FPS
    private var label = "Camera"

    override fun isAvailable(): Boolean = try {
        manager.cameraIdList.isNotEmpty()
    } catch (e: Exception) {
        false
    }

    /** True when this device exposes a USB camera through Camera2. */
    fun hasExternalCamera(): Boolean = try {
        manager.cameraIdList.any { facingOf(it) == CameraMetadata.LENS_FACING_EXTERNAL }
    } catch (e: Exception) {
        false
    }

    override fun requestPermission() {
        // Camera2 needs only the app-level CAMERA permission, requested by the activity.
        start()
    }

    override fun start() {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED
        ) {
            sink.onCameraState(CameraState.NO_PERMISSION, "camera permission not granted")
            return
        }

        stop()
        ensureThread()

        try {
            val cameraId = pickCamera()
            if (cameraId == null) {
                sink.onCameraState(CameraState.NO_CAMERA, "no usable camera")
                return
            }

            val characteristics = manager.getCameraCharacteristics(cameraId)
            val external = facingOf(cameraId) == CameraMetadata.LENS_FACING_EXTERNAL
            label = (if (external) "USB camera " else "Built-in camera ") + cameraId

            val size = pickSize(characteristics)
            reader = ImageReader.newInstance(size.width, size.height, ImageFormat.YUV_420_888, 3).apply {
                setOnImageAvailableListener({ onImage(it, size) }, handler)
            }

            sink.onCameraState(CameraState.OPENING, label)
            manager.openCamera(cameraId, stateCallback, handler)
        } catch (e: CameraAccessException) {
            sink.onCameraState(CameraState.ERROR, "camera access: ${e.message}")
        } catch (e: SecurityException) {
            sink.onCameraState(CameraState.NO_PERMISSION, e.message ?: "permission denied")
        } catch (e: Exception) {
            sink.onCameraState(CameraState.ERROR, e.message ?: "unknown error")
        }
    }

    override fun stop() {
        streaming = false
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
    }

    override fun isStreaming(): Boolean = streaming

    fun release() {
        stop()
        thread?.quitSafely()
        thread = null
        handler = null
    }

    // ---------------------------------------------------------------- internals

    private fun facingOf(id: String): Int? =
        manager.getCameraCharacteristics(id).get(CameraCharacteristics.LENS_FACING)

    private fun ensureThread() {
        if (thread == null) {
            thread = HandlerThread("camera2-source").also { it.start() }
            handler = Handler(thread!!.looper)
        }
    }

    private fun pickCamera(): String? {
        val ids = manager.cameraIdList
        if (ids.isEmpty()) return null
        if (Config.PREFER_EXTERNAL_CAMERA) {
            ids.firstOrNull { facingOf(it) == CameraMetadata.LENS_FACING_EXTERNAL }?.let { return it }
        }
        if (!Config.ALLOW_BUILTIN_FALLBACK) return null
        return ids.firstOrNull { facingOf(it) == CameraMetadata.LENS_FACING_FRONT } ?: ids.first()
    }

    private fun pickSize(characteristics: CameraCharacteristics): Size {
        val map: StreamConfigurationMap =
            characteristics.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
                ?: return Size(640, 480)
        val sizes = map.getOutputSizes(ImageFormat.YUV_420_888) ?: return Size(640, 480)
        val target = Config.CAPTURE_WIDTH * Config.CAPTURE_HEIGHT
        return sizes.minByOrNull { kotlin.math.abs(it.width * it.height - target) } ?: Size(640, 480)
    }

    private val stateCallback = object : CameraDevice.StateCallback() {
        override fun onOpened(camera: CameraDevice) {
            device = camera
            createSession(camera)
        }

        override fun onDisconnected(camera: CameraDevice) {
            camera.close()
            device = null
            streaming = false
            sink.onCameraClose("disconnected")
            sink.onCameraState(CameraState.DISCONNECTED, "camera disconnected")
        }

        override fun onError(camera: CameraDevice, error: Int) {
            camera.close()
            device = null
            streaming = false
            sink.onCameraState(CameraState.ERROR, "camera error $error")
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
                            streaming = true
                            val size = reader?.let { Size(it.width, it.height) } ?: Size(0, 0)
                            sink.onCameraOpen(size.width, size.height, label, transport)
                            sink.onCameraState(CameraState.STREAMING, "$label ${size.width}x${size.height}")
                        } catch (e: Exception) {
                            sink.onCameraState(CameraState.ERROR, "repeating request: ${e.message}")
                        }
                    }

                    override fun onConfigureFailed(configured: CameraCaptureSession) {
                        sink.onCameraState(CameraState.ERROR, "capture session configuration failed")
                    }
                },
                handler,
            )
        } catch (e: Exception) {
            sink.onCameraState(CameraState.ERROR, "create session: ${e.message}")
        }
    }

    private fun onImage(imageReader: ImageReader, size: Size) {
        val image = try {
            imageReader.acquireLatestImage()
        } catch (e: Exception) {
            null
        } ?: return

        try {
            val now = System.currentTimeMillis()
            if (now - lastFrameAt < frameIntervalMs || encoding) return
            lastFrameAt = now

            val nv21 = image.toNv21() ?: return
            encoding = true
            val jpeg = nv21ToJpeg(nv21, size.width, size.height, Config.JPEG_QUALITY)
            if (jpeg != null) sink.onFrame(Base64.encodeToString(jpeg, Base64.NO_WRAP))
        } catch (e: Exception) {
            Log.w(TAG, "frame encode failed", e)
        } finally {
            encoding = false
            image.close()
        }
    }

    companion object {
        private const val TAG = "Camera2Source"
    }
}
