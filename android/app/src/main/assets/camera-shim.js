/**
 * USB camera shim.
 *
 * Injected before any page script runs. It presents the native USB camera feed as a
 * completely ordinary MediaStream, so the web game keeps calling
 * `navigator.mediaDevices.getUserMedia()` and has no idea anything unusual happened.
 *
 * native Camera2 (UVC) → JPEG → bridge → <canvas> → canvas.captureStream()
 *
 * Why not let the WebView open the camera itself? On many Android builds a USB camera
 * is simply not offered to `getUserMedia`, even when Camera2 can see it. Capturing
 * natively and injecting the stream makes the game work on both kinds of device, and
 * still keeps every frame on-device.
 */
(function () {
  'use strict';

  var bridge = window.AndroidUsbCamera;
  if (!bridge) return;

  var TARGET_FPS = 24;
  var canvas = document.createElement('canvas');
  canvas.width = bridge.getWidth() || 1280;
  canvas.height = bridge.getHeight() || 720;
  var ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

  var stream = null;
  var pumping = false;
  var framesDrawn = 0;
  var lastFrameAt = 0;

  function base64ToBlob(base64) {
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: 'image/jpeg' });
  }

  function drawFallback(base64, resolve) {
    var img = new Image();
    img.onload = function () {
      sizeTo(img.width, img.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      framesDrawn++;
      resolve();
    };
    img.onerror = resolve;
    img.src = 'data:image/jpeg;base64,' + base64;
  }

  function sizeTo(w, h) {
    if (w && h && (canvas.width !== w || canvas.height !== h)) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  async function pump() {
    while (pumping) {
      var base64 = '';
      try {
        base64 = bridge.grabFrame();
      } catch (err) {
        base64 = '';
      }

      if (!base64) {
        // No new frame yet — yield briefly instead of spinning.
        await new Promise(function (r) { setTimeout(r, 6); });
        continue;
      }

      try {
        if (typeof createImageBitmap === 'function') {
          // Off-main-thread JPEG decode keeps the game's own rAF loop smooth.
          var bitmap = await createImageBitmap(base64ToBlob(base64));
          sizeTo(bitmap.width, bitmap.height);
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          bitmap.close();
          framesDrawn++;
        } else {
          await new Promise(function (resolve) { drawFallback(base64, resolve); });
        }
        lastFrameAt = Date.now();
      } catch (err) {
        bridge.log('frame decode failed: ' + err);
      }

      await new Promise(function (r) { setTimeout(r, Math.max(0, 1000 / TARGET_FPS - 6)); });
    }
  }

  function startStream() {
    if (!stream) {
      // Paint one neutral frame so the first getUserMedia consumer never sees a
      // zero-sized track.
      ctx.fillStyle = '#061428';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      stream = canvas.captureStream(TARGET_FPS);
    }
    if (!pumping) {
      pumping = true;
      pump();
    }
    return stream;
  }

  var nativeGetUserMedia = null;
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    nativeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  }

  if (!navigator.mediaDevices) {
    navigator.mediaDevices = {};
  }

  navigator.mediaDevices.getUserMedia = function (constraints) {
    if (constraints && constraints.video && bridge.isReady()) {
      try {
        return Promise.resolve(startStream());
      } catch (err) {
        bridge.log('captureStream failed, falling back: ' + err);
      }
    }
    if (nativeGetUserMedia) return nativeGetUserMedia(constraints);
    return Promise.reject(new DOMException('No camera available', 'NotFoundError'));
  };

  var nativeEnumerate = navigator.mediaDevices.enumerateDevices
    ? navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices)
    : null;

  navigator.mediaDevices.enumerateDevices = function () {
    var usb = [{
      deviceId: 'android-usb-camera',
      groupId: 'android-usb-camera',
      kind: 'videoinput',
      label: bridge.getLabel(),
      toJSON: function () { return this; },
    }];
    if (!nativeEnumerate) return Promise.resolve(usb);
    return nativeEnumerate().then(function (devices) {
      return bridge.isReady() ? usb.concat(devices) : devices;
    });
  };

  // Watchdog: if the USB camera is unplugged, end the injected track so the game's
  // own camera-loss handling takes over instead of freezing on the last frame.
  setInterval(function () {
    if (!stream) return;
    var live = bridge.isReady() && (Date.now() - lastFrameAt < 3000);
    if (!live) {
      stream.getVideoTracks().forEach(function (track) {
        if (track.readyState === 'live') {
          track.stop();
          track.dispatchEvent(new Event('ended'));
        }
      });
      pumping = false;
      stream = null;
    }
  }, 1500);

  window.__androidUsbCamera = {
    status: function () { return JSON.parse(bridge.getStatus()); },
    framesDrawn: function () { return framesDrawn; },
    canvas: canvas,
    restart: function () { bridge.restart(); },
  };

  bridge.log('USB camera shim installed');
})();
