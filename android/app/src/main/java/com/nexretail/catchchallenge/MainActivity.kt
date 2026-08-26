package com.nexretail.catchchallenge

import android.Manifest
import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Color
import android.hardware.usb.UsbManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.nexretail.catchchallenge.camera.CameraCoordinator
import com.nexretail.catchchallenge.camera.CameraState
import com.nexretail.catchchallenge.camera.FrameSink
import org.json.JSONObject

/**
 * Kiosk host for the Catch Challenge web game.
 *
 * Two jobs:
 *  1. Serve the bundled game over an https origin so it runs in a secure context.
 *  2. Capture the USB camera natively and inject it as a normal MediaStream.
 *
 * The web game is used unmodified — the same build that runs on the signage browser.
 */
class MainActivity : AppCompatActivity(), FrameSink, WebCameraBridge.Host {

    private lateinit var webView: WebView
    private lateinit var statusView: TextView
    private lateinit var cameraCoordinator: CameraCoordinator
    private lateinit var bridge: WebCameraBridge

    private val main = Handler(Looper.getMainLooper())
    private var shimScript: String = ""
    private var pendingCameraPermission = false

    /** True once the page has registered this app as its camera host (push mode). */
    @Volatile
    private var hostReady = false

    // Camera status, mirrored here so the bridge can answer synchronously.
    @Volatile private var cameraLabel = ""
    @Volatile private var cameraWidth = 0
    @Volatile private var cameraHeight = 0
    @Volatile private var streaming = false
    @Volatile private var framesSent = 0L

    // Legacy pull-mode buffer, used only by pages without the host API.
    @Volatile private var latestFrame: String? = null
    @Volatile private var latestFrameId = 0L

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            pendingCameraPermission = false
            if (granted) {
                cameraCoordinator.start()
            } else {
                // Not a dead end: the game itself offers a mouse/touch demo mode.
                setStatus("Camera permission denied — touch controls still work")
            }
        }

    /** A USB camera can appear or vanish at any moment on a kiosk. */
    private val usbReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                UsbManager.ACTION_USB_DEVICE_ATTACHED -> {
                    Log.i(TAG, "USB device attached")
                    // The USB stack needs a moment to enumerate the new device.
                    main.postDelayed({ cameraCoordinator.onUsbTopologyChanged() }, 1200)
                }
                UsbManager.ACTION_USB_DEVICE_DETACHED -> {
                    Log.i(TAG, "USB device detached")
                    setStatus("USB camera unplugged")
                    main.postDelayed({ cameraCoordinator.onUsbTopologyChanged() }, 800)
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window, false)

        shimScript = assets.open("camera-shim.js").bufferedReader().use { it.readText() }

        cameraCoordinator = CameraCoordinator(this, this)
        bridge = WebCameraBridge(this)

        setContentView(buildUi())
        configureWebView()

        registerUsbReceiver()
        requestCameraIfNeeded()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                // Kiosk: never leave the app by accident.
                if (webView.canGoBack()) webView.goBack()
            }
        })

        webView.loadUrl(if (Config.USE_BUNDLED_SITE) Config.BUNDLED_URL else Config.REMOTE_URL)
    }

    // ------------------------------------------------------------------------ ui

    private fun buildUi(): View {
        val root = FrameLayout(this).apply { setBackgroundColor(Color.parseColor("#061428")) }

        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
            setBackgroundColor(Color.parseColor("#061428"))
        }
        root.addView(webView)

        statusView = TextView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM or Gravity.START,
            ).apply { setMargins(24, 24, 24, 24) }
            setTextColor(Color.parseColor("#B0F7F7F2"))
            textSize = 12f
            setPadding(24, 12, 24, 12)
            setBackgroundColor(Color.parseColor("#66000000"))
            visibility = View.GONE
        }
        root.addView(statusView)
        return root
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            // The game starts its own audio/video after a user gesture anyway; this
            // stops the WebView from blocking the camera stream and sound effects.
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = true
            loadWithOverviewMode = true
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            allowFileAccess = false
            allowContentAccess = false
            textZoom = 100
        }

        WebView.setWebContentsDebuggingEnabled(true)
        webView.addJavascriptInterface(bridge, WebCameraBridge.NAME)

        // Serving the bundled build from https://appassets.androidplatform.net gives the
        // page a secure origin, which getUserMedia and the MediaPipe WASM runtime require.
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest,
            ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)

            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                // A reload drops the page's registration; it re-registers via the shim.
                hostReady = false
                // Fallback for WebView builds without DOCUMENT_START_SCRIPT: still runs
                // before the app bundle executes on virtually every page load.
                if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                    view.evaluateJavascript(shimScript, null)
                }
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: android.webkit.WebResourceError,
            ) {
                if (request.isForMainFrame) setStatus("Load failed: ${error.description}")
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                // Only ever grant camera, and only when the user already granted it to the app.
                val wants = request.resources.filter { it == PermissionRequest.RESOURCE_VIDEO_CAPTURE }
                if (wants.isNotEmpty() && hasCameraPermission()) {
                    runOnUiThread { request.grant(wants.toTypedArray()) }
                } else {
                    runOnUiThread { request.deny() }
                }
            }

            override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                // INFO, not DEBUG: on locked-down signage builds debug logs are dropped,
                // and the page's console is the only window into a kiosk in the field.
                Log.i(TAG, "web[${message.messageLevel()}]: ${message.message()} @${message.lineNumber()}")
                return true
            }
        }

        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            // Origin rules must be concrete origins (wildcards are only allowed in the
            // host part), so the remote origin is derived from the configured URL.
            val origins = mutableSetOf("https://appassets.androidplatform.net")
            if (!Config.USE_BUNDLED_SITE) {
                runCatching { android.net.Uri.parse(Config.REMOTE_URL) }.getOrNull()?.let { uri ->
                    val scheme = uri.scheme
                    val host = uri.host
                    if (scheme != null && host != null) origins += "$scheme://$host"
                }
            }
            WebViewCompat.addDocumentStartJavaScript(webView, shimScript, origins)
        }
    }

    // -------------------------------------------------------------------- camera

    private fun hasCameraPermission() =
        ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED

    private fun requestCameraIfNeeded() {
        if (hasCameraPermission()) {
            cameraCoordinator.start()
        } else if (!pendingCameraPermission) {
            pendingCameraPermission = true
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    private fun registerUsbReceiver() {
        val filter = IntentFilter().apply {
            addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED)
            addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
        }
        ContextCompat.registerReceiver(this, usbReceiver, filter, ContextCompat.RECEIVER_EXPORTED)
    }

    // ------------------------------------------------------------- FrameSink

    override fun onCameraOpen(width: Int, height: Int, label: String, transport: String) {
        cameraWidth = width
        cameraHeight = height
        cameraLabel = label
        streaming = true
        // Tell the page a camera is live, using its own documented API.
        callPage(
            "window.CatchChallenge.camera.open({width:$width,height:$height," +
                "label:${label.toJsString()},transport:${transport.toJsString()}})",
        )
    }

    override fun onFrame(jpegBase64: String) {
        latestFrameId++
        latestFrame = jpegBase64
        if (!hostReady) return // page has no host API: it will pull instead
        framesSent++
        // Push straight into the page's camera API. evaluateJavascript must run on the
        // UI thread, so frames hop from the encode thread to main here and nowhere else.
        callPage("window.CatchChallenge.camera.pushFrame('$jpegBase64')")
    }

    override fun onCameraClose(reason: String) {
        streaming = false
        latestFrame = null
        callPage("window.CatchChallenge.camera.close(${reason.toJsString()})")
    }

    override fun onCameraState(state: CameraState, detail: String) {
        // Terminal failures are reported to the page as well, so the game shows its own
        // recoverable camera screen immediately instead of waiting out its timeout.
        when (state) {
            CameraState.NO_CAMERA -> failPage("no_camera")
            CameraState.NO_PERMISSION -> failPage("permission_denied")
            CameraState.ERROR -> failPage("camera_error")
            else -> Unit
        }

        runOnUiThread {
            when (state) {
                CameraState.STREAMING -> setStatus(detail)
                CameraState.WAITING_PERMISSION -> setStatus("Waiting for USB permission — tap Allow")
                CameraState.NO_CAMERA -> setStatus("No USB camera found — plug one in, then retry")
                CameraState.NO_PERMISSION -> setStatus("USB permission denied — retry to show the dialog again")
                CameraState.DISCONNECTED -> setStatus("USB camera disconnected")
                CameraState.ERROR -> setStatus("Camera error: $detail")
                else -> Unit
            }
        }
    }

    private fun failPage(reason: String) {
        streaming = false
        callPage("window.CatchChallenge.camera.fail('$reason')")
    }

    // --------------------------------------------------- WebCameraBridge.Host

    override fun onHostReady() {
        hostReady = true
        // If a camera is already live, re-announce it: the page may have reloaded.
        if (streaming) {
            onCameraOpen(cameraWidth, cameraHeight, cameraLabel, cameraCoordinator.transport)
        }
    }

    override fun onPermissionRequested() {
        // Comes from the game's own "Enable camera" button, so the system USB dialog
        // appears as a direct result of a player action.
        runOnUiThread {
            if (!hasCameraPermission()) {
                requestCameraIfNeeded()
            } else {
                cameraCoordinator.requestPermission()
            }
        }
    }

    override fun onRestartRequested() {
        runOnUiThread { cameraCoordinator.restart() }
    }

    override fun takeFrame(sinceId: Long): Pair<Long, String>? {
        val id = latestFrameId
        if (id == sinceId) return null
        val frame = latestFrame ?: return null
        return id to frame
    }

    override fun statusJson(): JSONObject = JSONObject()
        .put("transport", cameraCoordinator.transport)
        .put("state", cameraCoordinator.state().name)
        .put("streaming", streaming)
        .put("label", cameraLabel)
        .put("width", cameraWidth)
        .put("height", cameraHeight)
        .put("hostReady", hostReady)
        .put("framesSent", framesSent)

    /** Runs a snippet in the page, guarding against a page that has no host API yet. */
    private fun callPage(script: String) {
        main.post {
            webView.evaluateJavascript(
                "try{if(window.CatchChallenge&&window.CatchChallenge.camera){$script}}catch(e){}",
                null,
            )
        }
    }

    /**
     * Operator hint, always transient: the player-facing game must never end up with a
     * native banner parked on top of it.
     */
    private fun setStatus(text: String) {
        statusView.text = text
        statusView.visibility = View.VISIBLE
        statusView.removeCallbacks(hideStatus)
        statusView.postDelayed(hideStatus, 6000)
    }

    private val hideStatus = Runnable { statusView.visibility = View.GONE }

    // ----------------------------------------------------------------- lifecycle

    override fun onResume() {
        super.onResume()
        enterImmersiveMode()
        if (hasCameraPermission() && !cameraCoordinator.isStreaming()) {
            cameraCoordinator.start()
        }
        webView.onResume()
    }

    override fun onPause() {
        webView.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        try {
            unregisterReceiver(usbReceiver)
        } catch (e: IllegalArgumentException) {
            /* never registered */
        }
        cameraCoordinator.stop()
        main.removeCallbacksAndMessages(null)
        webView.loadUrl("about:blank")
        webView.destroy()
        super.onDestroy()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) enterImmersiveMode()
    }

    private fun enterImmersiveMode() {
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }
    }

    companion object {
        private const val TAG = "CatchChallenge"
    }
}


/** Quotes a string for embedding in a JavaScript snippet. */
private fun String.toJsString(): String =
    "'" + replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ") + "'"
