# Catch Challenge — Android kiosk (USB camera)

Wraps the web game in a full-screen kiosk app and feeds it a **USB (UVC) camera**.

The web build is used unmodified. The app's job is to solve the two things a browser
alone cannot on Android signage hardware:

1. **A secure origin.** The bundled game is served from
   `https://appassets.androidplatform.net` via `WebViewAssetLoader`. `getUserMedia` and the
   MediaPipe WASM runtime both refuse to run from `file://`.
2. **A USB camera the WebView can actually use.** Most Android builds never offer an
   external camera to `getUserMedia`, and many camera HALs do not expose one to Camera2
   either. The app opens the device over **libuvc** (`com.herohan:UVCAndroid`), which needs
   the user to approve that specific USB device once — the familiar
   *"Allow the app to access the USB device?"* dialog.

```
USB camera → libuvc (UVCAndroid) → NV21 → JPEG → base64
          → webView.evaluateJavascript(...)
          → window.CatchChallenge.camera.pushFrame(frame)   ← the game's own API
          → <canvas> → MediaPipe hand tracking
```

Frames exist only in memory. Nothing is written to storage and nothing is uploaded —
the same privacy promise the web game makes on screen.

## The page's camera API

The web game publishes a documented contract that any native shell can drive
(`claude/src/vision/ExternalCamera.ts`), so the host never has to monkey-patch
`getUserMedia`:

```js
window.CatchChallenge.camera.registerHost({ name, requestPermission, restart })
window.CatchChallenge.camera.open({ width, height, label, transport })
window.CatchChallenge.camera.pushFrame(base64Jpeg)   // per frame
window.CatchChallenge.camera.close('unplugged')
window.CatchChallenge.camera.isActive()
window.CatchChallenge.camera.status()
```

A host camera outranks `getUserMedia`, because a host only registers when it has a camera
the page cannot reach by itself. The page decodes frames into a canvas, feeds that canvas
straight to MediaPipe, and exposes the same canvas as a `MediaStream` for its preview
surfaces — so calibration, the operator panel and the game itself cannot tell the
difference between a USB camera and a webcam.

**The permission dialog is triggered by the game's own button.** When the player selects
「カメラを有効にする」, `Camera.start()` sees a registered host and calls
`requestPermission()`, which reaches `CameraCoordinator.requestPermission()` and finally
`ICameraHelper.selectDevice(device)` — the call that raises the Android USB dialog. The
game then waits (up to 9 s) for the first pushed frame before continuing to calibration.

Pages that do **not** implement this API — the Gemini edition, for instance — are still
supported: the injected shim falls back to patching `getUserMedia` and *pulling* frames
through the bridge into a canvas.

## Build and install

```bash
# from the repository root
npm install
npm run android:build      # builds the web game, syncs it into assets, assembles the APK
npm run android:install    # …and installs it on the connected device

# or, in Android Studio: open the `android/` folder
```

Requires JDK 17 and Android SDK 35. `android/local.properties` must point at your SDK
(`sdk.dir=/path/to/Android/sdk`); Android Studio writes it for you.

Artifact: `android/app/build/outputs/apk/debug/app-debug.apk` (~3.4 MB, includes both
game editions).

## Configuration

`app/src/main/java/com/nexretail/catchchallenge/Config.kt`:

| Key | Meaning |
|---|---|
| `USE_BUNDLED_SITE` | `true` = play the APK's own copy, `false` = load `REMOTE_URL` |
| `BUNDLED_URL` | Which edition opens — point at `/assets/web/index.html` for the edition-select page |
| `REMOTE_URL` | Hosted build, e.g. the GitHub Pages deployment |
| `CAPTURE_WIDTH` / `CAPTURE_HEIGHT` | Requested capture size; the closest supported size is used |
| `TARGET_FPS` | Frames handed to the page (24 is plenty for hand tracking) |
| `JPEG_QUALITY` | Bridge frame quality; 55–70 is the sweet spot |
| `PREFER_EXTERNAL_CAMERA` | Prefer USB over built-in cameras |
| `ALLOW_BUILTIN_FALLBACK` | Use the front/built-in camera when no USB camera is present |

## How the camera path works

- `UvcCameraSource` (primary) uses `com.herohan:UVCAndroid` 1.0.13:
  `CameraHelper()` → `selectDevice()` (permission dialog) → `onDeviceOpen` → `openCamera()`
  → `onCameraOpen` → `setPreviewSize()` + `setFrameCallback(cb, PIXEL_FORMAT_NV21)` +
  `startPreview()`. libuvc wants a preview target, so an off-screen `SurfaceTexture` keeps
  the pipeline alive without putting a second camera view on the kiosk screen.
- `Camera2CameraSource` (fallback) uses the platform API, preferring
  `LENS_FACING_EXTERNAL` and falling back to the front camera, so the kiosk still works on
  devices that do expose UVC to Camera2 and during development on hardware with a built-in
  camera.
- `CameraCoordinator` picks between them, re-evaluates when USB devices come and go, and is
  the single entry point for start / requestPermission / restart.
- Frames are JPEG-encoded off the main thread and dropped rather than queued when encoding
  falls behind: the newest frame is the only one worth having, and an unbounded queue would
  grow whenever inference briefly stalls. The page applies the same rule when decoding.
- Unplugging is handled end to end: `onDetach` → `camera.close('unplugged')` in the page →
  the game's own recoverable camera-error screen. Re-plugging restarts capture
  automatically (`USB_DEVICE_ATTACHED`).

## Kiosk behaviour

Immersive full screen, screen kept on, `singleTask` launch, back button confined to the
WebView, and an auto-launch `USB_DEVICE_ATTACHED` intent filter so plugging in the camera
brings the app to the front. A small operator banner reports camera state and always
auto-hides after six seconds so it can never sit on top of the player-facing UI.

## Verified

- **Web side, in a real browser**: the end-to-end suite registers a fake host, pushes
  synthetic JPEG frames and asserts the game accepts them — `transport === 'host'`, the feed
  reports live, and the app proceeds past the camera screen with no webcam present
  (`npm run e2e`, 19/19).
- **Android build**: AGP 8.9 / Gradle 8.11.1 / Kotlin 2.0.21, SDK 35, UVCAndroid 1.0.13
  packaged with its native libraries (arm64-v8a, armeabi-v7a, x86, x86_64).
- **On hardware**: an earlier build of this app was installed and run on an Android 13
  signage device at 1920×1080 — the bundled game loaded over the https asset origin, the
  shim installed, touch control worked and a full five-pitch game played through. That
  device had **no camera attached**, so it exercised the "no camera found" path.
- **Not yet run on hardware**: the UVC capture path itself (permission dialog → frames), as
  no device with a USB camera has been connected. Everything downstream of `pushFrame` is
  covered by the browser tests above.

## Troubleshooting

| Symptom | Check |
|---|---|
| "No camera found" with a camera plugged in | Check `adb logcat -s UvcCameraSource CameraCoordinator`. If the device never appears, confirm the OS reports it: `adb shell lsusb` or `dumpsys usb`. `Config.PREFER_UVC = false` forces the Camera2 path |
| Permission dialog never appears | It is raised by the game's "Enable camera" button. Watch for `WAITING_PERMISSION` in logcat; `onCancel` means the user (or a kiosk policy) dismissed it |
| Black or green frames | Usually a stride bug in a custom build of the YUV conversion; the shipped conversion handles row/pixel strides |
| Game loads but tracking never starts | Check `adb logcat -s WebGame` for "USB camera shim installed", then `window.__androidUsbCamera.status()` in `chrome://inspect` |
| Nothing loads | Run `npm run android:sync` — the APK ships the web build from `app/src/main/assets/web/`, which is generated, not committed |

Inspect the running page from a desktop Chrome at `chrome://inspect` (web contents
debugging is enabled in the debug build).
