export type CameraErrorCode =
  | 'not_supported'
  | 'permission_denied'
  | 'no_device'
  | 'in_use'
  | 'insecure_context'
  | 'unknown';

export interface CameraStartResult {
  ok: boolean;
  code?: CameraErrorCode;
  message?: string;
}

/**
 * Owns the webcam stream and the hidden <video> element used for inference.
 * Frames never leave the browser: the element is not attached to any recorder,
 * canvas upload or network call.
 */
export class Camera {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private onLostCallback: ((code: CameraErrorCode) => void) | null = null;

  isSecure(): boolean {
    if (typeof window === 'undefined') return false;
    return window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  }

  async start(width = 1280, height = 720): Promise<CameraStartResult> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return { ok: false, code: 'not_supported', message: 'getUserMedia is unavailable in this browser.' };
    }
    if (!this.isSecure()) {
      return { ok: false, code: 'insecure_context', message: 'Camera access requires HTTPS or localhost.' };
    }

    this.stop();

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
      this.stop();
      return { ok: false, code: 'unknown', message: (err as Error).message };
    }

    // A yanked USB camera or an OS-level privacy switch ends the track.
    this.stream.getVideoTracks().forEach((track) => {
      track.onended = () => this.onLostCallback?.('no_device');
    });

    return { ok: true };
  }

  onLost(cb: (code: CameraErrorCode) => void) {
    this.onLostCallback = cb;
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

  getVideo(): HTMLVideoElement | null {
    return this.video;
  }

  isLive(): boolean {
    const v = this.video;
    return !!v && !!this.stream && v.readyState >= 2 && !v.paused && this.stream.active;
  }

  getResolution(): { width: number; height: number } {
    return { width: this.video?.videoWidth ?? 0, height: this.video?.videoHeight ?? 0 };
  }

  stop() {
    this.stream?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    this.stream = null;
    if (this.video) this.video.srcObject = null;
  }

  /** Full teardown, including the DOM node — used by the kiosk reset path. */
  dispose() {
    this.stop();
    if (this.video?.parentElement) this.video.parentElement.removeChild(this.video);
    this.video = null;
    this.onLostCallback = null;
  }
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
