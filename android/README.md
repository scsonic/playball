# Catch Challenge — Android kiosk (USB camera)

Wraps the web game in a full-screen kiosk app and feeds it a **USB (UVC) camera**.

The web build is used unmodified. The app's job is to solve the two things a browser
alone cannot on Android signage hardware:

1. **A secure origin.** The bundled game is served from
   `https://appassets.androidplatform.net` via `WebViewAssetLoader`. `getUserMedia` and the
   MediaPipe WASM runtime both refuse to run from `file://`.
2. **A USB camera the WebView can actually use.** Many Android builds never offer an
   external camera to `getUserMedia`, even when the platform can see it. The app captures
   natively with Camera2 and injects the feed as an ordinary `MediaStream`.

```
USB camera → Camera2 (LENS_FACING_EXTERNAL) → YUV_420_888 → NV21 → JPEG
          → JS bridge (pull) → <canvas> → canvas.captureStream()
          → navigator.mediaDevices.getUserMedia()  ← the game calls this, unchanged
```

Frames exist only in memory. Nothing is written to storage and nothing is uploaded —
the same privacy promise the web game makes on screen.

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

- `UsbCameraSource` enumerates Camera2 devices and prefers `LENS_FACING_EXTERNAL` (the USB
  camera), falling back to the front camera. It converts each frame to JPEG, honouring row
  and pixel strides — UVC cameras routinely return padded buffers, and ignoring the strides
  is what produces the classic green-skewed image.
- `WebCameraBridge` exposes the newest frame to JavaScript. The page **pulls** frames rather
  than native pushing them, which gives natural back-pressure: while MediaPipe is busy the
  page simply asks later and native drops the frames in between.
- `assets/camera-shim.js` is injected before any page script
  (`WebViewCompat.addDocumentStartJavaScript`, with an `onPageStarted` fallback). It decodes
  frames into a canvas, wraps it with `captureStream()`, and patches `getUserMedia` and
  `enumerateDevices`. If the native camera is not streaming it delegates to the real
  `getUserMedia`, so devices that *do* expose USB cameras to the WebView keep working.
- Unplugging is handled end to end: Camera2 reports `onDisconnected`, the shim's watchdog
  ends the injected track, and the game shows its own recoverable camera-error screen.
  Re-plugging restarts capture automatically (`USB_DEVICE_ATTACHED`).

## Kiosk behaviour

Immersive full screen, screen kept on, `singleTask` launch, back button confined to the
WebView, and an auto-launch `USB_DEVICE_ATTACHED` intent filter so plugging in the camera
brings the app to the front. A small operator banner reports camera state and always
auto-hides after six seconds so it can never sit on top of the player-facing UI.

## Verified

- Built with AGP 8.9 / Gradle 8.11.1 / Kotlin 2.0.21 against SDK 35.
- Installed and run on an Android 13 (API 33) signage device at 1920×1080: the bundled game
  loads over the https asset origin, the shim installs, touch control works, and a full
  five-pitch game plays through. That device has **no camera attached**, so it exercised the
  "no camera found" path — the USB capture path itself still needs a run with a UVC camera
  connected.

## Troubleshooting

| Symptom | Check |
|---|---|
| "No camera found" with a camera plugged in | `adb shell dumpsys media.camera \| grep -i external` — if the device's HAL does not expose external cameras, Camera2 cannot reach it and a UVC/libusb library would be required |
| Black or green frames | Usually a stride bug in a custom build of the YUV conversion; the shipped conversion handles row/pixel strides |
| Game loads but tracking never starts | Check `adb logcat -s WebGame` for "USB camera shim installed", then `window.__androidUsbCamera.status()` in `chrome://inspect` |
| Nothing loads | Run `npm run android:sync` — the APK ships the web build from `app/src/main/assets/web/`, which is generated, not committed |

Inspect the running page from a desktop Chrome at `chrome://inspect` (web contents
debugging is enabled in the debug build).
