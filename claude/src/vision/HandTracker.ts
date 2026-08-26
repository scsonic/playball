import { FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { HandMode, Landmark } from '../types';
import { anatomicalHand, classifyPalm, type PalmReading } from './PalmModel';

const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const HAND_MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const POSE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export interface HandFrame {
  detected: boolean;
  /** True when the detected hand is the one we asked for. */
  correctHand: boolean;
  hand: HandMode | null;
  landmarks: Landmark[] | null;
  palm: PalmReading | null;
  confidence: number;
  inferenceMs: number;
}

export interface PoseFrame {
  personDetected: boolean;
  upperBodyVisible: boolean;
  /** Rough distance estimate from shoulder width in the frame. */
  distance: 'too_close' | 'ok' | 'too_far' | 'unknown';
  wrist: { x: number; y: number } | null;
  landmarks: Landmark[] | null;
}

const EMPTY_HAND: HandFrame = {
  detected: false,
  correctHand: false,
  hand: null,
  landmarks: null,
  palm: null,
  confidence: 0,
  inferenceMs: 0,
};

const EMPTY_POSE: PoseFrame = {
  personDetected: false,
  upperBodyVisible: false,
  distance: 'unknown',
  wrist: null,
  landmarks: null,
};

/**
 * MediaPipe Tasks Vision wrapper.
 *
 * Runs entirely in the browser (WASM + GPU delegate). Models are lazy-loaded on
 * first use so the boot screen paints immediately. Pose is optional and runs at a
 * lower cadence than hands, because presence detection does not need 60 Hz.
 */
export class HandTracker {
  private hands: HandLandmarker | null = null;
  private pose: PoseLandmarker | null = null;
  private loading: Promise<boolean> | null = null;
  private lastVideoTime = -1;
  private lastHand: HandFrame = EMPTY_HAND;
  private lastPose: PoseFrame = EMPTY_POSE;
  private poseAccumulator = 0;
  private inputMirrored = false;

  constructor(
    private targetHand: HandMode = 'left',
    private usePose = true,
  ) {}

  setTargetHand(hand: HandMode) {
    this.targetHand = hand;
  }

  setUsePose(enabled: boolean) {
    this.usePose = enabled;
  }

  isReady(): boolean {
    return !!this.hands;
  }

  async load(): Promise<boolean> {
    if (this.hands) return true;
    if (this.loading) return this.loading;

    this.loading = (async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks(WASM_ROOT);
        this.hands = await HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: HAND_MODEL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.45,
          minHandPresenceConfidence: 0.45,
          minTrackingConfidence: 0.45,
        });

        if (this.usePose) {
          // Pose failure must never block hand tracking.
          try {
            this.pose = await PoseLandmarker.createFromOptions(fileset, {
              baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'GPU' },
              runningMode: 'VIDEO',
              numPoses: 1,
              minPoseDetectionConfidence: 0.5,
            });
          } catch (err) {
            console.warn('[vision] pose landmarker unavailable, continuing without it', err);
            this.pose = null;
          }
        }
        return true;
      } catch (err) {
        console.error('[vision] failed to load MediaPipe', err);
        this.hands = null;
        return false;
      } finally {
        this.loading = null;
      }
    })();

    return this.loading;
  }

  /** Runs inference for one video frame. Returns cached results between frames. */
  detect(video: HTMLVideoElement, now: number, dt: number): { hand: HandFrame; pose: PoseFrame } {
    if (!this.hands || video.readyState < 2) {
      return { hand: this.lastHand, pose: this.lastPose };
    }
    if (video.currentTime === this.lastVideoTime) {
      // No new camera frame yet — do not burn GPU on a duplicate inference.
      return { hand: this.lastHand, pose: this.lastPose };
    }
    this.lastVideoTime = video.currentTime;

    const started = performance.now();
    try {
      const result = this.hands.detectForVideo(video, now);
      this.lastHand = this.selectHand(result, performance.now() - started);
    } catch (err) {
      console.warn('[vision] hand inference error', err);
      this.lastHand = { ...EMPTY_HAND, inferenceMs: performance.now() - started };
    }

    this.poseAccumulator += dt;
    if (this.pose && this.poseAccumulator >= 0.2) {
      this.poseAccumulator = 0;
      try {
        this.lastPose = readPose(this.pose.detectForVideo(video, now), this.targetHand, this.inputMirrored);
      } catch {
        this.lastPose = EMPTY_POSE;
      }
    } else if (!this.pose) {
      // Without pose, infer presence from the hand itself.
      this.lastPose = {
        ...EMPTY_POSE,
        personDetected: this.lastHand.detected,
        upperBodyVisible: this.lastHand.detected,
      };
    }

    return { hand: this.lastHand, pose: this.lastPose };
  }

  private selectHand(
    result: { landmarks?: Landmark[][]; handedness?: Array<Array<{ categoryName: string; score: number }>> },
    inferenceMs: number,
  ): HandFrame {
    const sets = result?.landmarks ?? [];
    if (sets.length === 0) return { ...EMPTY_HAND, inferenceMs };

    let bestIndex = -1;
    let bestScore = -1;
    let bestHand: HandMode | null = null;

    for (let i = 0; i < sets.length; i++) {
      const category = result.handedness?.[i]?.[0];
      const hand = category ? anatomicalHand(category.categoryName, this.inputMirrored) : null;
      const score = category?.score ?? 0.5;
      const matches = hand === this.targetHand;
      // Prefer the requested hand; fall back to the most confident other hand so
      // a right-handed visitor is never left with a dead cursor.
      const weighted = (matches ? 1 : 0) * 10 + score;
      if (weighted > bestScore) {
        bestScore = weighted;
        bestIndex = i;
        bestHand = hand;
      }
    }

    if (bestIndex < 0) return { ...EMPTY_HAND, inferenceMs };

    const landmarks = sets[bestIndex].map((l) => ({ x: l.x, y: l.y, z: l.z }));
    const palm = classifyPalm(landmarks);
    const category = result.handedness?.[bestIndex]?.[0];

    return {
      detected: true,
      correctHand: bestHand === this.targetHand,
      hand: bestHand,
      landmarks,
      palm,
      confidence: Math.min(1, (category?.score ?? 0.6) * 0.5 + palm.openness * 0.5 + 0.2),
      inferenceMs,
    };
  }

  dispose() {
    this.hands?.close();
    this.pose?.close();
    this.hands = null;
    this.pose = null;
    this.lastHand = EMPTY_HAND;
    this.lastPose = EMPTY_POSE;
    this.lastVideoTime = -1;
  }
}

function readPose(
  result: { landmarks?: Landmark[][] },
  targetHand: HandMode,
  inputMirrored: boolean,
): PoseFrame {
  const lm = result?.landmarks?.[0];
  if (!lm || lm.length < 25) return EMPTY_POSE;

  // Pose landmark indices: 11/12 shoulders, 15/16 wrists.
  const leftShoulder = lm[11];
  const rightShoulder = lm[12];
  const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);

  // Pose landmarks use the same mirroring convention as the raw image.
  const wantLeft = inputMirrored ? targetHand === 'left' : targetHand === 'right';
  const wrist = wantLeft ? lm[15] : lm[16];

  const distance: PoseFrame['distance'] =
    shoulderWidth > 0.45 ? 'too_close' : shoulderWidth < 0.12 ? 'too_far' : 'ok';

  return {
    personDetected: true,
    upperBodyVisible: leftShoulder.y > 0.02 && rightShoulder.y > 0.02 && shoulderWidth > 0.06,
    distance,
    wrist: wrist ? { x: wrist.x, y: wrist.y } : null,
    landmarks: lm.map((l) => ({ x: l.x, y: l.y, z: l.z })),
  };
}

export const handTracker = new HandTracker('left', true);
