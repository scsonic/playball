import { externalCamera } from './ExternalCamera';

export type CameraErrorCode =
  | 'not_supported'
  | 'permission_denied'
  | 'no_device'
  | 'in_use'
  | 'insecure_context'
  | 'host_timeout'
  | 'unknown';

export type CameraTransport = 'webcam' | 'host';

/** Anything MediaPipe can run inference on directly. */
export type FrameSource = HTMLVideoElement | HTMLCanvasElement;

export interface CameraStartResult {
  ok: boolean;
  transport?: CameraTransport;
  code?: CameraErrorCode;
  message?: string;
}

/**
 * Owns the camera feed, whichever way it arrives.
 *
 * Two transports, one interface:
 *  - **webcam** — `getUserMedia`, the normal browser path.
 *  - **host** — frames pushed in by a native shell through
 *    `window.CatchChallenge.camera` (see `ExternalCamera`). This is how a USB/UVC
 *    camera reaches the game on Android, where the WebView usually cannot open one.
 *
 * A registered host wins, because a host only registers when it has a camera the
 * page cannot reach by itself. Either way frames never leave the device: no
 * recorder, no upload, no storage.
 */
export class Camera {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private transport: CameraTransport = 'webcam';
  private onLostCallback: ((code: CameraErrorCode) => void) | null = null;
  private hostWatchdog: number | null = null;

  isSecure(): boolean {
    if (typeof window === 'undefined') return false;
    return window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  }

  /** True when a native shell has published a camera host. */
  hasHost(): boolean {
    return externalCamera.hasHost();
  }

  async start(width = 1280, height = 720, hostTimeoutMs = 9000): Promise<CameraStartResult> {
    if (externalCamera.hasHost()) {
      const result = await this.startHost(hostTimeoutMs);
      if (result.ok) return result;
      // Host failed (denied, unplugged, no device): fall through to the webcam.
    }
    return this.startWebcam(width, height);
  }

  private async startHost(timeoutMs: number): Promise<CameraStartResult> {
    if (!externalCamera.isActive()) {
      // Triggers the host's own permission flow — on Android, the system
      // "Allow this app to access the USB device?" dialog.
      externalCamera.requestHostPermission();
    }

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (externalCamera.isActive()) {
        this.transport = 'host';
        this.startHostWatchdog();
        return { ok: true, transport: 'host' };
      }
      await delay(120);
    }
    return { ok: false, code: 'host_timeout', message: 'The host camera did not deliver any frames.' };
  }

  private async startWebcam(width: number, height: number): Promise<CameraStartResult> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return { ok: false, code: 'not_supported', message: 'getUserMedia is unavailable in this browser.' };
    }
    if (!this.isSecure()) {
      return { ok: false, code: 'insecure_context', message: 'Camera access requires HTTPS or localhost.' };
    }

    this.stopWebcam();

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: width },
          height: { ideal: height },
          frameRate: { ideal: 30, max: 60 },
          facingMode: 'user',
        },
        audio: false,
      });
    } catch (err) {
      return { ok: false, ...mapError(err) };
    }

    const video = this.ensureVideo();
    video.srcObject = this.stream;

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('camera_timeout')), 10000);
        video.onloadedmetadata = () => {
          clearTimeout(timeout);
          video.play().then(resolve).catch(reject);
        };
        video.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('video_error'));
        };
      });
    } catch (err) {
      this.stopWebcam();
      return { ok: false, code: 'unknown', message: (err as Error).message };
    }

    // A yanked USB camera or an OS-level privacy switch ends the track.
    this.stream.getVideoTracks().forEach((track) => {
      track.onended = () => this.onLostCallback?.('no_device');
    });

    this.transport = 'webcam';
    return { ok: true, transport: 'webcam' };
  }

  /** Notices when a host stops delivering frames (cable pulled, app backgrounded). */
  private startHostWatchdog() {
    if (this.hostWatchdog !== null) return;
    this.hostWatchdog = window.setInterval(() => {
      if (this.transport !== 'host') return;
      if (!externalCamera.isActive()) {
        this.stopHostWatchdog();
        this.onLostCallback?.('no_device');
      }
    }, 1000);
  }

  private stopHostWatchdog() {
    if (this.hostWatchdog !== null) {
      window.clearInterval(this.hostWatchdog);
      this.hostWatchdog = null;
    }
  }

  onLost(cb: (code: CameraErrorCode) => void) {
    this.onLostCallback = cb;
  }

  getTransport(): CameraTransport {
    return this.transport;
  }

  /** The surface inference should read from. */
  getSource(): FrameSource | null {
    if (this.transport === 'host') return externalCamera.getSource();
    return this.video;
  }

  /** Changes whenever a new frame is available, so inference can skip duplicates. */
  getFrameId(): number {
    if (this.transport === 'host') return externalCamera.getFrameId();
    return this.video?.currentTime ?? -1;
  }

  /** A MediaStream suitable for a preview <video>, whatever the transport. */
  getPreviewStream(): MediaStream | null {
    if (this.transport === 'host') return externalCamera.getPreviewStream();
    return this.stream;
  }

  isLive(): boolean {
    if (this.transport === 'host') return externalCamera.isActive();
    const v = this.video;
    return !!v && !!this.stream && v.readyState >= 2 && !v.paused && this.stream.active;
  }

  getResolution(): { width: number; height: number } {
    if (this.transport === 'host') return externalCamera.getResolution();
    return { width: this.video?.videoWidth ?? 0, height: this.video?.videoHeight ?? 0 };
  }

  getLabel(): string {
    if (this.transport === 'host') return externalCamera.status().label ?? 'Host camera';
    return this.stream?.getVideoTracks()[0]?.label ?? 'Webcam';
  }

  private ensureVideo(): HTMLVideoElement {
    if (!this.video) {
      const video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.setAttribute('aria-hidden', 'true');
      video.style.position = 'fixed';
      video.style.width = '1px';
      video.style.height = '1px';
      video.style.opacity = '0';
      video.style.pointerEvents = 'none';
      video.style.left = '-10px';
      document.body.appendChild(video);
      this.video = video;
    }
    return this.video;
  }

  private stopWebcam() {
    this.stream?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    this.stream = null;
    if (this.video) this.video.srcObject = null;
  }

  stop() {
    this.stopHostWatchdog();
    this.stopWebcam();
  }

  /** Full teardown, including the DOM node — used by the kiosk reset path. */
  dispose() {
    this.stop();
    if (this.video?.parentElement) this.video.parentElement.removeChild(this.video);
    this.video = null;
    this.onLostCallback = null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapError(err: unknown): { code: CameraErrorCode; message: string } {
  const e = err as { name?: string; message?: string };
  switch (e?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return { code: 'permission_denied', message: 'Camera permission was denied.' };
    case 'NotFoundError':
    case 'OverconstrainedError':
      return { code: 'no_device', message: 'No camera device was found.' };
    case 'NotReadableError':
    case 'AbortError':
      return { code: 'in_use', message: 'The camera is already in use by another application.' };
    default:
      return { code: 'unknown', message: e?.message ?? 'Unknown camera error.' };
  }
}

export const camera = new Camera();
