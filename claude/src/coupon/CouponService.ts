import type { Coupon } from '../types';

export interface GameResultPayload {
  sessionId: string;
  catches: number;
  totalPitches: number;
  requiredCatches: number;
  won: boolean;
  difficulty: string;
  durationMs: number;
}

export interface CouponService {
  readonly mode: 'demo' | 'production';
  /**
   * Opens a server-side session. In production this is what makes a coupon
   * unforgeable: the result is validated against a session the server issued.
   */
  createSession(): Promise<{ sessionId: string }>;
  submitResult(payload: GameResultPayload): Promise<{ accepted: boolean }>;
  issueCoupon(payload: GameResultPayload): Promise<Coupon>;
  getCoupon(code: string): Promise<Coupon | null>;
  redeemCoupon(code: string): Promise<{ redeemed: boolean; reason?: string }>;
}

/**
 * Production API contract (implemented by `HttpCouponService`):
 *
 *   POST /api/game/session          → { sessionId }
 *   POST /api/game/result           → { accepted }
 *   POST /api/coupon/issue          → Coupon
 *   GET  /api/coupon/:code          → Coupon | 404
 *   POST /api/coupon/:code/redeem   → { redeemed }
 *
 * Server-side rules the backend MUST enforce (documented in the README):
 *  - coupon tokens are generated server-side with a CSPRNG, never in the browser
 *  - single use, with an expiry timestamp
 *  - the win result is re-validated against the recorded session
 *  - issuance is rate-limited per session/IP/device and capped per campaign day
 *  - issue + redemption timestamps are recorded for reconciliation
 *  - no personal data is collected without explicit consent
 */
export const COUPON_ENDPOINTS = {
  session: '/api/game/session',
  result: '/api/game/result',
  issue: '/api/coupon/issue',
  detail: (code: string) => `/api/coupon/${encodeURIComponent(code)}`,
  redeem: (code: string) => `/api/coupon/${encodeURIComponent(code)}/redeem`,
} as const;
