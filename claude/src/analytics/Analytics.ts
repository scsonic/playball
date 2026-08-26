/**
 * Provider-independent analytics.
 *
 * Emits anonymous, aggregate events only: no video, no images, no landmarks, no
 * names, no biometric identifiers. The session id is a random value minted in the
 * browser and never linked to a person. Swap `setProvider()` for GA4, Segment,
 * an internal endpoint or nothing at all.
 */
export type AnalyticsEventName =
  | 'game_session_started'
  | 'camera_permission_granted'
  | 'camera_permission_denied'
  | 'calibration_completed'
  | 'game_started'
  | 'pitch_released'
  | 'pitch_caught'
  | 'pitch_missed'
  | 'game_won'
  | 'game_lost'
  | 'coupon_issued'
  | 'coupon_qr_displayed'
  | 'coupon_claim_clicked'
  | 'play_again_clicked'
  | 'auto_reset'
  | 'tracking_lost'
  | 'camera_error'
  | 'language_changed'
  | 'difficulty_changed';

export interface AnalyticsContext {
  sessionId: string;
  screenMode: 'landscape' | 'portrait';
  difficulty: string;
  locale: string;
  inputMode: string;
}

export interface AnalyticsEvent extends Partial<AnalyticsContext> {
  name: AnalyticsEventName;
  timestamp: number;
  pitchNumber?: number;
  catchCount?: number;
  fpsBucket?: string;
  errorCode?: string;
}

export type AnalyticsProvider = (event: AnalyticsEvent) => void;

const consoleProvider: AnalyticsProvider = (event) => {
  if (import.meta.env?.DEV) console.debug('[analytics]', event.name, event);
};

class AnalyticsService {
  private provider: AnalyticsProvider = consoleProvider;
  private context: AnalyticsContext = {
    sessionId: 'unset',
    screenMode: 'landscape',
    difficulty: 'normal',
    locale: 'ja',
    inputMode: 'camera',
  };
  private buffer: AnalyticsEvent[] = [];

  setProvider(provider: AnalyticsProvider) {
    this.provider = provider;
  }

  setContext(patch: Partial<AnalyticsContext>) {
    this.context = { ...this.context, ...patch };
  }

  track(name: AnalyticsEventName, data: Omit<Partial<AnalyticsEvent>, 'name' | 'timestamp'> = {}) {
    const event: AnalyticsEvent = {
      ...this.context,
      ...data,
      name,
      timestamp: Date.now(),
    };
    this.buffer.push(event);
    if (this.buffer.length > 500) this.buffer.shift();
    try {
      this.provider(event);
    } catch {
      /* analytics must never break the experience */
    }
  }

  /** Anonymous diagnostic log for the admin panel export. */
  exportLog(): AnalyticsEvent[] {
    return [...this.buffer];
  }

  clear() {
    this.buffer = [];
  }
}

export const analytics = new AnalyticsService();

export function fpsBucket(fps: number): string {
  if (fps >= 55) return '55+';
  if (fps >= 40) return '40-54';
  if (fps >= 25) return '25-39';
  return '<25';
}
