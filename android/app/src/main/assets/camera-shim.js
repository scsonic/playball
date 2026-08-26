/**
 * Native camera shim — injected before any page script runs.
 *
 * Preferred path: the page publishes `window.CatchChallenge.camera` (the Claude
 * edition does). We register this app as its camera host and the app *pushes*
 * frames straight in. The game then treats the USB camera as a first-class source,
 * and its own "Enable camera" button triggers the Android USB permission dialog
 * through `requestPermission` below.
 *
 * Fallback path: for a page without that API (the Gemini edition, or any third-party
 * page), we patch `getUserMedia` and pull frames through the bridge into a canvas,
 * exposing it with `captureStream()`.
 */
(function () {
  'use strict';

  var bridge = window.AndroidUsbCamera;
  if (!bridge) return;

  var TARGET_FPS = 24;
  var registered = false;

  // ---------------------------------------------------------------- push mode

  function tryRegisterHost() {
    if (registered) return true;
    var api = window.CatchChallenge && window.CatchChallenge.camera;
    if (!api || typeof api.registerHost !== 'function') return false;

    api.registerHost({
      name: 'android-usb-camera',
      requestPermission: function () {
        // Shows the system "Allow access to the USB device?" dialog when needed.
        try { bridge.requestPermission(); } catch (e) { bridge.log('requestPermission failed: ' + e); }
      },
      restart: function () {
        try { bridge.restart(); } catch (e) { bridge.log('restart failed: ' + e); }
      },
    });

    registered = true;
    try { bridge.onHostReady(); } catch (e) { /* older host build */ }
    bridge.log('registered as native camera host (push mode)');
    return true;
  }

  if (!tryRegisterHost()) {
    // The page installs its API during startup; poll briefly rather than racing it.
    var attempts = 0;
    var poll = setInterval(function () {
      attempts++;
      if (tryRegisterHost() || attempts > 200) clearInterval(poll);
    }, 100);
  }

  // ---------------------------------------------------------------- pull mode

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

  function sizeTo(w, h) {
    if (w && h && (canvas.width !== w || canvas.height !== h)) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function drawWithImage(base64) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        sizeTo(img.width, img.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        framesDrawn++;
        resolve();
      };
      img.onerror = resolve;
      img.src = 'data:image/jpeg;base64,' + base64;
    });
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
        await new Promise(function (r) { setTimeout(r, 8); });
        continue;
      }

      try {
        if (typeof createImageBitmap === 'function') {
          var bitmap = await createImageBitmap(base64ToBlob(base64));
          sizeTo(bitmap.width, bitmap.height);
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          bitmap.close();
          framesDrawn++;
        } else {
          await drawWithImage(base64);
        }
        lastFrameAt = Date.now();
      } catch (err) {
        bridge.log('frame decode failed: ' + err);
      }

      await new Promise(function (r) { setTimeout(r, Math.max(0, 1000 / TARGET_FPS - 6)); });
    }
  }

  function startPullStream() {
    if (!stream) {
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
  if (!navigator.mediaDevices) navigator.mediaDevices = {};

  navigator.mediaDevices.getUserMedia = function (constraints) {
    // In push mode the page already has the frames; never shadow its own pipeline.
    if (!registered && constraints && constraints.video && bridge.isReady()) {
      try {
        return Promise.resolve(startPullStream());
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

  // Pull mode watchdog: if the camera goes away, end the injected track so the page's
  // own camera-loss handling runs instead of freezing on the last frame.
  setInterval(function () {
    if (!stream || registered) return;
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
    mode: function () { return registered ? 'push' : 'pull'; },
    status: function () { return JSON.parse(bridge.getStatus()); },
    framesDrawn: function () { return framesDrawn; },
    canvas: canvas,
    restart: function () { bridge.restart(); },
    requestPermission: function () { bridge.requestPermission(); },
  };

  bridge.log('USB camera shim installed');
})();
