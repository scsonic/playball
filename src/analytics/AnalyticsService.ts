export type AnalyticsEventType =
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
  | 'camera_error';

export interface AnalyticsPayload {
  eventType: AnalyticsEventType;
  timestamp: number;
  sessionId: string;
  screenMode?: string;
  difficulty?: string;
  pitchNumber?: number;
  catchCount?: number;
  fpsBucket?: string;
  errorCode?: string;
  [key: string]: unknown;
}

export class AnalyticsService {
  private logs: AnalyticsPayload[] = [];
  private maxLogs: number = 200;

  public logEvent(eventType: AnalyticsEventType, data: Partial<AnalyticsPayload> = {}) {
    const payload: AnalyticsPayload = {
      eventType,
      timestamp: Date.now(),
      sessionId: data.sessionId || 'anonymous',
      difficulty: data.difficulty,
      pitchNumber: data.pitchNumber,
      catchCount: data.catchCount,
      screenMode: data.screenMode,
      errorCode: data.errorCode
    };

    this.logs.push(payload);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // In production, batch or forward to configured analytics endpoint
    if (import.meta.env.DEV) {
      // console.log(`[Analytics] ${eventType}`, payload);
    }
  }

  public getExportableLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  public clear() {
    this.logs = [];
  }
}

export const analyticsService = new AnalyticsService();
