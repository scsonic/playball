export type GameState =
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

export type Locale = 'ja' | 'en' | 'zh-TW';

export type Difficulty = 'easy' | 'normal' | 'challenge';

export interface CampaignConfig {
  totalPitches: number;
  requiredCatches: number;
  pitchIntervalMs: number;
  pitchTravelDurationMs: number;
  dwellClickDurationMs: number;
  cursorSmoothing: number;
  palmCatchRadiusPx: number;
  cameraMirrored: boolean;
  inactivityResetSeconds: number;
  couponExpirationMinutes: number;
  demoMode: boolean;
  locale: Locale;
  supportedLocales: Locale[];
  enableAudio: boolean;
  enableVoiceInstructions: boolean;
  enablePoseDetection: boolean;
  enableHandDetection: boolean;
  enableDebugOverlay: boolean;
  useLicensedAthleteAssets: boolean;
  useLicensedBrandAssets: boolean;
  targetHand: 'left' | 'right';
  apiUrl: string;
}

export type TrajectoryType =
  | 'fastball_center'
  | 'high_left'
  | 'high_right'
  | 'low_left'
  | 'low_right'
  | 'curve_left'
  | 'curve_right';

export interface PitchTrajectoryPoint {
  x: number; // Normalized 0..1 (screen space)
  y: number; // Normalized 0..1 (screen space)
  z: number; // Depth 1.0 (mound) -> 0.0 (home plate / player)
  scale: number; // Scale factor for ball radius
  shadowX: number;
  shadowY: number;
  shadowAlpha: number;
}

export interface PitchData {
  id: number;
  type: TrajectoryType;
  startTime: number;
  durationMs: number;
  targetX: number; // Final arrival X in normalized coords
  targetY: number; // Final arrival Y in normalized coords
  resolved: boolean;
  result: 'caught' | 'missed' | null;
  caughtTime?: number;
  caughtPosition?: { x: number; y: number };
}

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface TrackingFrame {
  timestamp: number;
  personDetected: boolean;
  handDetected: boolean;
  isLeftHand: boolean;
  palmOpen: boolean;
  confidence: number;
  rawPalmCenter: { x: number; y: number }; // normalized 0..1
  smoothedPalmCenter: { x: number; y: number }; // normalized 0..1
  screenPos: { x: number; y: number }; // pixel coords
  velocity: number; // pixels per second
  landmarks?: HandLandmark[];
  lightingQuality: 'good' | 'fair' | 'poor';
}

export interface CouponData {
  token: string;
  code: string;
  qrUrl: string;
  issuedAt: number;
  expiresAt: number;
  isDemo: boolean;
  catches: number;
  totalPitches: number;
  sessionId: string;
}
