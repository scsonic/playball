import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { HandLandmark, TrackingFrame } from '../types/game';
import { PalmClassifier } from './PalmClassifier';
import { CoordinateMapper } from './CoordinateMapper';
import { CursorSmoother } from './CursorSmoother';

export class HandTracker {
  private handLandmarker: HandLandmarker | null = null;
  private isLoaded: boolean = false;
  private isLoading: boolean = false;
  private coordinateMapper: CoordinateMapper;
  private cursorSmoother: CursorSmoother;
  private targetHand: 'left' | 'right' = 'left';
  private lastTrackingFrame: TrackingFrame | null = null;
  private lastVideoTime: number = -1;

  constructor(targetHand: 'left' | 'right' = 'left') {
    this.targetHand = targetHand;
    this.coordinateMapper = new CoordinateMapper(true);
    this.cursorSmoother = new CursorSmoother(0.75);
  }

  public async initialize(): Promise<boolean> {
    if (this.isLoaded) return true;
    if (this.isLoading) return false;

    this.isLoading = true;
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );

      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      this.isLoaded = true;
      this.isLoading = false;
      return true;
    } catch (err) {
      console.warn('[HandTracker] Failed to load MediaPipe HandLandmarker:', err);
      this.isLoading = false;
      return false;
    }
  }

  public setTargetHand(hand: 'left' | 'right') {
    this.targetHand = hand;
  }

  public getTargetHand(): 'left' | 'right' {
    return this.targetHand;
  }

  public setCursorSmoothing(alpha: number) {
    this.cursorSmoother.setAlpha(alpha);
  }

  public setMirrored(mirrored: boolean) {
    this.coordinateMapper.setMirrored(mirrored);
  }

  public updateScreenDimensions(w: number, h: number) {
    this.coordinateMapper.updateScreenDimensions(w, h);
  }

  public processVideoFrame(video: HTMLVideoElement, timestamp: number = performance.now()): TrackingFrame {
    if (!this.isLoaded || !this.handLandmarker || video.currentTime === this.lastVideoTime) {
      if (this.lastTrackingFrame) {
        return this.lastTrackingFrame;
      }
      return this.getEmptyFrame(timestamp);
    }

    this.lastVideoTime = video.currentTime;

    try {
      const results = this.handLandmarker.detectForVideo(video, timestamp);

      if (!results || !results.landmarks || results.landmarks.length === 0) {
        const empty = this.getEmptyFrame(timestamp);
        this.lastTrackingFrame = empty;
        return empty;
      }

      // Find the targeted hand (default: Left hand)
      // Note: In mirrored webcam mode, user's physical Left hand appears on user's left side (image right/left).
      // MediaPipe handedness categories: 'Left' / 'Right'.
      let selectedHandIndex = 0;
      if (results.handedness && results.handedness.length > 0) {
        for (let i = 0; i < results.handedness.length; i++) {
          const categoryName = results.handedness[i][0]?.categoryName?.toLowerCase();
          // Anatomical vs mirrored check:
          if (this.targetHand === 'left' && (categoryName === 'left' || results.handedness.length === 1)) {
            selectedHandIndex = i;
            break;
          } else if (this.targetHand === 'right' && categoryName === 'right') {
            selectedHandIndex = i;
            break;
          }
        }
      }

      const landmarks: HandLandmark[] = results.landmarks[selectedHandIndex].map((l) => ({
        x: l.x,
        y: l.y,
        z: l.z
      }));

      const rawPalmCenter = PalmClassifier.computePalmCenter(landmarks);
      const { isOpen, confidence } = PalmClassifier.isOpenPalm(landmarks);

      const rawScreenPos = this.coordinateMapper.mapToScreen(rawPalmCenter.x, rawPalmCenter.y);
      const smoothed = this.cursorSmoother.update(
        rawPalmCenter.x,
        rawPalmCenter.y,
        rawScreenPos.x,
        rawScreenPos.y,
        timestamp
      );

      const frame: TrackingFrame = {
        timestamp,
        personDetected: true,
        handDetected: true,
        isLeftHand: this.targetHand === 'left',
        palmOpen: isOpen,
        confidence,
        rawPalmCenter,
        smoothedPalmCenter: smoothed.norm,
        screenPos: smoothed.screen,
        velocity: smoothed.velocity,
        landmarks,
        lightingQuality: 'good'
      };

      this.lastTrackingFrame = frame;
      return frame;
    } catch (err) {
      console.warn('[HandTracker] Video detection error:', err);
      const empty = this.getEmptyFrame(timestamp);
      this.lastTrackingFrame = empty;
      return empty;
    }
  }

  private getEmptyFrame(timestamp: number): TrackingFrame {
    return {
      timestamp,
      personDetected: false,
      handDetected: false,
      isLeftHand: this.targetHand === 'left',
      palmOpen: false,
      confidence: 0,
      rawPalmCenter: { x: 0.5, y: 0.5 },
      smoothedPalmCenter: { x: 0.5, y: 0.5 },
      screenPos: { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 },
      velocity: 0,
      lightingQuality: 'fair'
    };
  }

  public isReady(): boolean {
    return this.isLoaded;
  }
}

export const handTracker = new HandTracker('left');
