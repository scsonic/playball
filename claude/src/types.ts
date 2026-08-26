/** Shared domain types for the Claude edition. */

export type Locale = 'ja' | 'en' | 'zh-TW';
export type Difficulty = 'easy' | 'normal' | 'challenge';
export type HandMode = 'left' | 'right';
export type InputSource = 'hand' | 'mouse' | 'touch' | 'keyboard' | 'none';
export type PitchOutcome = 'catch' | 'miss';

/** Explicit application state machine states. */
export type AppState =
  | 'BOOT'
  | 'CAMERA_PERMISSION'
  | 'CAMERA_CALIBRATION'
  | 'ATTRACT_MODE'
  | 'READY'
  | 'COUNTDOWN'
  | 'PITCHING'
  | 'PITCH_RESULT'
  | 'GAME_RESULT'
  | 'COUPON'
  | 'RESETTING'
  | 'CAMERA_ERROR';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

/**
 * A single unified pointer sample.
 *
 * Every input source (hand tracking, mouse, touch, keyboard) is normalised into
 * this shape, so the dwell engine, the cursor renderer and the catch detector
 * never need to know how the player is actually controlling the experience.
 */
export interface CursorSample {
  /** performance.now() timestamp of the sample. */
  t: number;
  /** False when tracking is lost — the cursor fades instead of jumping. */
  present: boolean;
  source: InputSource;
  /** Screen position in CSS pixels. */
  x: number;
  y: number;
  /** Velocity in CSS px/s. */
  vx: number;
  vy: number;
  speed: number;
  /** 0..1 tracking confidence (1 for mouse/touch). */
  confidence: number;
  palmOpen: boolean;
  /** Measured palm radius projected to screen pixels. */
  palmRadiusPx: number;
  /** Anatomical handedness of the tracked hand, mirror-normalised. */
  handLabel: HandMode | null;
  /** 0..1 render opacity — fades out on tracking loss instead of jumping. */
  visibility: number;
}

export type LightingQuality = 'low' | 'fair' | 'good';
export type DistanceQuality = 'too_close' | 'ok' | 'too_far' | 'unknown';

/** Diagnostics surfaced by calibration and the admin panel. */
export interface TrackingDiagnostics {
  personDetected: boolean;
  upperBodyVisible: boolean;
  handDetected: boolean;
  correctHand: boolean;
  palmOpen: boolean;
  confidence: number;
  lighting: LightingQuality;
  distance: DistanceQuality;
  inferenceMs: number;
  landmarks: Landmark[] | null;
  poseLandmarks: Landmark[] | null;
}

export interface DwellStatus {
  targetId: string | null;
  progress: number; // 0..1
  paused: boolean;
}

export interface Coupon {
  code: string;
  token: string;
  issuedAt: number;
  expiresAt: number;
  claimUrl: string;
  demo: boolean;
  rewardLabel: string;
}
