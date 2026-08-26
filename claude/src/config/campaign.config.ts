import type { Difficulty, HandMode, Locale } from '../types';

export interface CampaignConfig {
  totalPitches: number;
  requiredCatches: number;
  pitchIntervalMs: number;
  pitchTravelDurationMs: number;
  dwellClickDurationMs: number;
  cursorSmoothing: number;
  /** Base catch radius at a 1080p-tall display; scaled responsively at runtime. */
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

  // --- Extended, prototype-specific options -------------------------------
  difficulty: Difficulty;
  handMode: HandMode;
  reducedMotion: boolean;
  highContrast: boolean;
  /** Minimum hand confidence for the catch zone to count. */
  trackingConfidenceThreshold: number;
  /** Palm speed (px/s) above which dwell progress pauses. */
  dwellVelocityPausePx: number;
  /** Cooldown after a dwell click, prevents double fires. */
  dwellCooldownMs: number;
  /** Normalised depth window in which a pitch can be caught (0 = release, 1 = plate). */
  catchWindow: [number, number];
  couponBaseUrl: string;
  campaignUrl: string;
  apiBaseUrl: string;
  /** Keyboard shortcut (with Ctrl+Alt) that opens the admin panel. */
  adminShortcutKey: string;
  /** Small live camera monitor in the bottom-left corner. */
  showCameraMonitor: boolean;
  cameraWidth: number;
  cameraHeight: number;
}

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

export const DEFAULT_CONFIG: CampaignConfig = {
  totalPitches: 5,
  requiredCatches: 3,
  pitchIntervalMs: 3200,
  pitchTravelDurationMs: 2200,
  dwellClickDurationMs: 2000,
  cursorSmoothing: 0.75,
  palmCatchRadiusPx: 140,
  cameraMirrored: true,
  inactivityResetSeconds: 30,
  couponExpirationMinutes: 15,
  demoMode: true,
  locale: 'ja',
  supportedLocales: ['ja', 'en', 'zh-TW'],
  enableAudio: true,
  enableVoiceInstructions: false,
  enablePoseDetection: true,
  enableHandDetection: true,
  enableDebugOverlay: false,
  useLicensedAthleteAssets: false,
  useLicensedBrandAssets: false,

  difficulty: 'normal',
  handMode: 'left',
  reducedMotion: false,
  highContrast: false,
  trackingConfidenceThreshold: 0.4,
  dwellVelocityPausePx: 320,
  dwellCooldownMs: 800,
  catchWindow: [0.74, 1.0],
  couponBaseUrl: env.VITE_COUPON_BASE_URL || 'https://campaign.example.com/claim',
  campaignUrl: env.VITE_CAMPAIGN_URL || 'https://campaign.example.com/itoen-catch',
  apiBaseUrl: env.VITE_API_URL || '',
  adminShortcutKey: 'd',
  showCameraMonitor: true,
  cameraWidth: 1280,
  cameraHeight: 720,
};

export interface DifficultyPreset {
  pitchTravelDurationMs: number;
  pitchIntervalMs: number;
  catchRadiusScale: number;
  catchWindow: [number, number];
  /** Lateral spread multiplier applied to trajectory offsets. */
  spread: number;
}

export const DIFFICULTY_PRESETS: Record<Difficulty, DifficultyPreset> = {
  easy: {
    pitchTravelDurationMs: 2700,
    pitchIntervalMs: 3400,
    catchRadiusScale: 1.25,
    catchWindow: [0.66, 1.0],
    spread: 0.62,
  },
  normal: {
    pitchTravelDurationMs: 2200,
    pitchIntervalMs: 3200,
    catchRadiusScale: 1.0,
    catchWindow: [0.74, 1.0],
    spread: 1.0,
  },
  challenge: {
    pitchTravelDurationMs: 1750,
    pitchIntervalMs: 2800,
    catchRadiusScale: 0.82,
    catchWindow: [0.8, 1.0],
    spread: 1.25,
  },
};

/** Applies a difficulty preset on top of a base config. */
export function withDifficulty(config: CampaignConfig, difficulty: Difficulty): CampaignConfig {
  const preset = DIFFICULTY_PRESETS[difficulty];
  return {
    ...config,
    difficulty,
    pitchTravelDurationMs: preset.pitchTravelDurationMs,
    pitchIntervalMs: preset.pitchIntervalMs,
    catchWindow: preset.catchWindow,
  };
}
