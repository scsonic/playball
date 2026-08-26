/**
 * Host camera API — `window.CatchChallenge.camera`.
 *
 * A native shell (the Android kiosk app, an Electron wrapper, a signage player…)
 * often has access to a camera the browser itself cannot open: a USB/UVC device
 * behind a system permission dialog is the common case on Android, where the
 * WebView's `getUserMedia` frequently never sees external cameras at all.
 *
 * Rather than have the host monkey-patch `getUserMedia`, the game publishes this
 * small, documented contract and treats a host camera as a first-class source:
 *
 *   window.CatchChallenge.camera.registerHost({ name, requestPermission, restart })
 *   window.CatchChallenge.camera.open({ width, height, label })
 *   window.CatchChallenge.camera.pushFrame(base64Jpeg)   // called per frame
 *   window.CatchChallenge.camera.close('unplugged')
 *
 * Frames are decoded into an offscreen canvas which is fed straight to MediaPipe,
 * and exposed as a MediaStream (via `captureStream`) for the preview surfaces —
 * so the rest of the app cannot tell a host camera from a webcam.
 *
 * Frames stay in the page. Nothing here uploads, stores or forwards them.
 */

export interface HostCameraInfo {
  width: number;
  height: number;
  label?: string;
  /** Informational: the host's own transport, e.g. 'uvc' or 'camera2'. */
  transport?: string;
}

export interface HostRegistration {
  name: string;
  /** Asks the host to (re)request device permission — the "tap Allow" dialog. */
  requestPermission?: () => void;
  /** Asks the host to reopen the camera after a failure or unplug. */
  restart?: () => void;
}

type Listener = () => void;

/** How long without a frame before the feed counts as dead. */
const STALE_MS = 2500;

class ExternalCamera {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private stream: MediaStream | null = null;
  private host: HostRegistration | null = null;
  private info: HostCameraInfo | null = null;

  private opened = false;
  private decoding = false;
  private frames = 0;
  private lastFrameAt = 0;
  private droppedFrames = 0;
  private closeReason: string | null = null;
  private listeners = new Set<Listener>();

  // ------------------------------------------------------------ host-facing API

  registerHost(host: HostRegistration) {
    this.host = host;
    this.emit();
  }

  hasHost(): boolean {
    return this.host !== null;
  }

  getHostName(): string | null {
    return this.host?.name ?? null;
  }

  /** Asks the native host to show its permission dialog / open the device. */
  requestHostPermission(): boolean {
    if (!this.host?.requestPermission) return false;
    try {
      this.host.requestPermission();
      return true;
    } catch (err) {
      console.warn('[external-camera] host permission request failed', err);
      return false;
    }
  }

  restartHost(): boolean {
    if (!this.host?.restart) return false;
    try {
      this.host.restart();
      return true;
    } catch {
      return false;
    }
  }

  /** The host announces a live camera. Safe to call again on resolution changes. */
  open(info: HostCameraInfo) {
    this.info = {
      width: Math.max(1, Math.round(info.width || 640)),
      height: Math.max(1, Math.round(info.height || 480)),
      label: info.label || 'Host camera',
      transport: info.transport,
    };
    this.ensureCanvas(this.info.width, this.info.height);
    this.opened = true;
    this.closeReason = null;
    this.emit();
  }

  /**
   * One frame, as base64-encoded JPEG (a `data:` URL is accepted too).
   *
   * Decoding is asynchronous, so a frame that arrives while the previous one is
   * still decoding is dropped on purpose: showing the newest frame late is worse
   * than skipping it, and an unbounded queue would grow without limit whenever
   * inference briefly falls behind.
   */
  pushFrame(data: string) {
    if (!data) return;
    if (!this.opened) this.open(this.info ?? { width: 640, height: 480 });
    if (this.decoding) {
      this.droppedFrames++;
      return;
    }
    this.decoding = true;
    void this.decode(data).finally(() => {
      this.decoding = false;
    });
  }

  close(reason = 'closed') {
    this.opened = false;
    this.closeReason = reason;
    this.stream?.getVideoTracks().forEach((track) => {
      if (track.readyState === 'live') track.stop();
    });
    this.stream = null;
    this.emit();
  }

  // ------------------------------------------------------------- app-facing API

  isActive(): boolean {
    return this.opened && this.frames > 0 && Date.now() - this.lastFrameAt < STALE_MS;
  }

  /** True once the host has announced a camera, even before the first frame. */
  isOpening(): boolean {
    return this.opened && this.frames === 0;
  }

  /** The inference source. MediaPipe accepts a canvas directly. */
  getSource(): HTMLCanvasElement | null {
    return this.opened ? this.canvas : null;
  }

  /** Monotonic frame counter, used to skip duplicate inference. */
  getFrameId(): number {
    return this.frames;
  }

  getResolution(): { width: number; height: number } {
    return { width: this.canvas?.width ?? 0, height: this.canvas?.height ?? 0 };
  }

  /** A MediaStream of the same canvas, for preview <video> elements. */
  getPreviewStream(): MediaStream | null {
    if (!this.canvas) return null;
    if (!this.stream || this.stream.getVideoTracks().every((t) => t.readyState === 'ended')) {
      this.stream = this.canvas.captureStream(24);
    }
    return this.stream;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  status() {
    return {
      host: this.host?.name ?? null,
      opened: this.opened,
      active: this.isActive(),
      label: this.info?.label ?? null,
      transport: this.info?.transport ?? null,
      width: this.canvas?.width ?? 0,
      height: this.canvas?.height ?? 0,
      frames: this.frames,
      dropped: this.droppedFrames,
      msSinceFrame: this.lastFrameAt ? Date.now() - this.lastFrameAt : null,
      closeReason: this.closeReason,
    };
  }

  /** Test seam: lets the suite feed frames without a native host. */
  reset() {
    this.close('reset');
    this.host = null;
    this.info = null;
    this.frames = 0;
    this.droppedFrames = 0;
    this.lastFrameAt = 0;
  }

  // ------------------------------------------------------------------ internals

  private ensureCanvas(width: number, height: number) {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d', { alpha: false, desynchronized: true });
    }
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      // A captured stream is bound to the old size; drop it so it is rebuilt.
      this.stream = null;
    }
  }

  private async decode(data: string) {
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!canvas || !ctx) return;

    try {
      const bitmap = await decodeJpeg(data);
      this.ensureCanvas(bitmap.width, bitmap.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      if ('close' in bitmap) bitmap.close();

      const wasActive = this.frames > 0;
      this.frames++;
      this.lastFrameAt = Date.now();
      if (!wasActive) this.emit(); // first frame flips the camera to "live"
    } catch (err) {
      console.warn('[external-camera] frame decode failed', err);
    }
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }
}

async function decodeJpeg(data: string): Promise<ImageBitmap | HTMLImageElement> {
  const url = data.startsWith('data:') ? data : `data:image/jpeg;base64,${data}`;

  if (typeof createImageBitmap === 'function' && typeof fetch === 'function') {
    // Off-main-thread decode keeps the game's own frame loop smooth.
    const blob = await (await fetch(url)).blob();
    return createImageBitmap(blob);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('jpeg decode failed'));
    img.src = url;
  });
}

export const externalCamera = new ExternalCamera();

/**
 * Publishes the contract on `window` as early as possible, so a native host can
 * register and start pushing frames before React has mounted.
 */
export function installHostApi() {
  if (typeof window === 'undefined') return;
  const globalAny = window as unknown as { CatchChallenge?: Record<string, unknown> };
  const existing = globalAny.CatchChallenge ?? {};
  globalAny.CatchChallenge = {
    ...existing,
    version: 1,
    camera: {
      registerHost: (host: HostRegistration) => externalCamera.registerHost(host),
      open: (info: HostCameraInfo) => externalCamera.open(info),
      pushFrame: (data: string) => externalCamera.pushFrame(data),
      close: (reason?: string) => externalCamera.close(reason),
      isActive: () => externalCamera.isActive(),
      status: () => externalCamera.status(),
    },
  };
}
