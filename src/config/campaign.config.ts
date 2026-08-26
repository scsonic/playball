import { CampaignConfig } from '../types/game';

export const DEFAULT_CAMPAIGN_CONFIG: CampaignConfig = {
  totalPitches: 5,
  requiredCatches: 3,
  pitchIntervalMs: 3200,
  pitchTravelDurationMs: 2200,
  dwellClickDurationMs: 2000,
  cursorSmoothing: 0.75,
  palmCatchRadiusPx: 140, // Forgiving hitbox for trade show
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
  targetHand: 'left',
  apiUrl: import.meta.env.VITE_API_URL || 'https://campaign.example.com'
};

export const DIFFICULTY_PRESETS = {
  easy: {
    pitchTravelDurationMs: 2600,
    palmCatchRadiusPx: 160,
    allowedTrajectories: ['fastball_center', 'high_left', 'high_right', 'low_left', 'low_right']
  },
  normal: {
    pitchTravelDurationMs: 2200,
    palmCatchRadiusPx: 140,
    allowedTrajectories: ['fastball_center', 'high_left', 'high_right', 'low_left', 'low_right', 'curve_left', 'curve_right']
  },
  challenge: {
    pitchTravelDurationMs: 1800,
    palmCatchRadiusPx: 110,
    allowedTrajectories: ['fastball_center', 'high_left', 'high_right', 'low_left', 'low_right', 'curve_left', 'curve_right']
  }
};
