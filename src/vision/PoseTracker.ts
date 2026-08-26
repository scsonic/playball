import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

export interface PosePresenceResult {
  personPresent: boolean;
  upperBodyVisible: boolean;
  distanceAdequate: boolean;
  leftWristPos?: { x: number; y: number };
}

export class PoseTracker {
  private poseLandmarker: PoseLandmarker | null = null;
  private isLoaded: boolean = false;
  private isLoading: boolean = false;

  public async initialize(): Promise<boolean> {
    if (this.isLoaded) return true;
    if (this.isLoading) return false;

    this.isLoading = true;
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );

      this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numPoses: 1
      });

      this.isLoaded = true;
      this.isLoading = false;
      return true;
    } catch (err) {
      console.warn('[PoseTracker] Optional pose model initialization skipped:', err);
      this.isLoading = false;
      return false;
    }
  }

  public detectPresence(video: HTMLVideoElement, timestamp: number = performance.now()): PosePresenceResult {
    if (!this.isLoaded || !this.poseLandmarker) {
      return { personPresent: true, upperBodyVisible: true, distanceAdequate: true };
    }

    try {
      const results = this.poseLandmarker.detectForVideo(video, timestamp);
      if (!results || !results.landmarks || results.landmarks.length === 0) {
        return { personPresent: false, upperBodyVisible: false, distanceAdequate: false };
      }

      const pose = results.landmarks[0];
      // 11: left shoulder, 12: right shoulder, 15: left wrist, 16: right wrist, 0: nose
      const nose = pose[0];
      const leftShoulder = pose[11];
      const rightShoulder = pose[12];
      const leftWrist = pose[15];

      const upperBodyVisible = !!(nose && leftShoulder && rightShoulder);
      const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);

      // Shoulder width: too close if > 0.6, too far if < 0.1
      const distanceAdequate = shoulderWidth >= 0.1 && shoulderWidth <= 0.65;

      return {
        personPresent: true,
        upperBodyVisible,
        distanceAdequate,
        leftWristPos: leftWrist ? { x: leftWrist.x, y: leftWrist.y } : undefined
      };
    } catch {
      return { personPresent: true, upperBodyVisible: true, distanceAdequate: true };
    }
  }
}

export const poseTracker = new PoseTracker();
