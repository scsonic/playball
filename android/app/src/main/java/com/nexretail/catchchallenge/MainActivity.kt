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

/**
 * Kiosk host for the Catch Challenge web game.
 *
 * Two jobs:
 *  1. Serve the bundled game over an https origin so it runs in a secure context.
 *  2. Capture the USB camera natively and inject it as a normal MediaStream.
 *
 * The web game is used unmodified — the same build that runs on the signage browser.
 */
class MainActivity : AppCompatActivity(), UsbCameraSource.Listener {

    private lateinit var webView: WebView
    private lateinit var statusView: TextView
    private lateinit var cameraSource: UsbCameraSource
    private lateinit var bridge: WebCameraBridge

    private val main = Handler(Looper.getMainLooper())
    private var shimScript: String = ""
    private var pendingCameraPermission = false

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            pendingCameraPermission = false
            if (granted) {
                cameraSource.start()
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
                    // The camera HAL needs a moment to enumerate the new device.
                    main.postDelayed({ cameraSource.start() }, 1200)
                }
                UsbManager.ACTION_USB_DEVICE_DETACHED -> {
                    Log.i(TAG, "USB device detached")
                    setStatus("USB camera unplugged")
                    main.postDelayed({ cameraSource.start() }, 600)
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window, false)

        shimScript = assets.open("camera-shim.js").bufferedReader().use { it.readText() }

        cameraSource = UsbCameraSource(this).also { it.listener = this }
        bridge = WebCameraBridge(cameraSource)

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
                Log.d(TAG, "web: ${message.message()} @${message.lineNumber()}")
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
            cameraSource.start()
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

    override fun onCameraState(state: UsbCameraSource.State, detail: String) {
        runOnUiThread {
            when (state) {
                UsbCameraSource.State.STREAMING -> setStatus(detail)
                UsbCameraSource.State.NO_CAMERA -> setStatus("No camera found — plug in a USB camera")
                UsbCameraSource.State.NO_PERMISSION -> setStatus("Camera permission required")
                UsbCameraSource.State.DISCONNECTED -> setStatus("USB camera disconnected")
                UsbCameraSource.State.ERROR -> setStatus("Camera error: $detail")
                else -> Unit
            }
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
        if (hasCameraPermission() && cameraSource.state != UsbCameraSource.State.STREAMING) {
            cameraSource.start()
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
        cameraSource.listener = null
        cameraSource.stop()
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
