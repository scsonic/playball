export class CameraManager {
  private videoElement: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private isMirrored: boolean = true;
  private isInitialized: boolean = false;

  constructor(mirrored: boolean = true) {
    this.isMirrored = mirrored;
  }

  public async initialize(
    videoElement?: HTMLVideoElement,
    preferredWidth: number = 1280,
    preferredHeight: number = 720
  ): Promise<boolean> {
    try {
      if (this.stream) {
        this.stop();
      }

      if (videoElement) {
        this.videoElement = videoElement;
      } else if (!this.videoElement) {
        this.videoElement = document.createElement('video');
        this.videoElement.autoplay = true;
        this.videoElement.playsInline = true;
        this.videoElement.muted = true;
      }

      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: preferredWidth },
          height: { ideal: preferredHeight },
          facingMode: 'user',
          frameRate: { ideal: 30, max: 60 }
        },
        audio: false
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement.srcObject = this.stream;

      await new Promise<void>((resolve, reject) => {
        if (!this.videoElement) return reject(new Error('No video element'));
        this.videoElement.onloadedmetadata = () => {
          this.videoElement?.play()
            .then(() => resolve())
            .catch(reject);
        };
        this.videoElement.onerror = (e) => reject(e);
      });

      this.isInitialized = true;
      return true;
    } catch (err) {
      console.warn('[CameraManager] Failed to access webcam:', err);
      this.isInitialized = false;
      return false;
    }
  }

  public getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }

  public isReady(): boolean {
    return (
      this.isInitialized &&
      !!this.videoElement &&
      this.videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      !this.videoElement.paused
    );
  }

  public setMirrored(mirrored: boolean) {
    this.isMirrored = mirrored;
  }

  public getMirrored(): boolean {
    return this.isMirrored;
  }

  public stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
    this.isInitialized = false;
  }
}

export const cameraManager = new CameraManager(true);
