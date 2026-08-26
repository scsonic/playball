import type { CampaignConfig } from '../config/campaign.config';
import type { Coupon } from '../types';
import { COUPON_ENDPOINTS, type CouponService, type GameResultPayload } from './CouponService';

/**
 * Production coupon client.
 *
 * Deliberately thin: it carries no secrets, does no signing, and cannot mint a
 * coupon. It posts a game result and asks the campaign backend for a token. All
 * validation, rate limiting, replay protection and single-use enforcement live
 * on the server (see the contract in `CouponService.ts`).
 */
export class HttpCouponService implements CouponService {
  readonly mode = 'production' as const;
  private sessionId: string | null = null;

  constructor(private config: CampaignConfig) {}

  setConfig(config: CampaignConfig) {
    this.config = config;
  }

  private url(path: string) {
    return `${this.config.apiBaseUrl.replace(/\/$/, '')}${path}`;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(this.url(path), {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      credentials: 'omit',
    });
    if (!res.ok) throw new Error(`coupon_api_${res.status}`);
    return (await res.json()) as T;
  }

  async createSession(): Promise<{ sessionId: string }> {
    const result = await this.request<{ sessionId: string }>(COUPON_ENDPOINTS.session, { method: 'POST' });
    this.sessionId = result.sessionId;
    return result;
  }

  async submitResult(payload: GameResultPayload): Promise<{ accepted: boolean }> {
    return this.request<{ accepted: boolean }>(COUPON_ENDPOINTS.result, {
      method: 'POST',
      body: JSON.stringify({ ...payload, sessionId: this.sessionId ?? payload.sessionId }),
    });
  }

  async issueCoupon(payload: GameResultPayload): Promise<Coupon> {
    return this.request<Coupon>(COUPON_ENDPOINTS.issue, {
      method: 'POST',
      body: JSON.stringify({ sessionId: this.sessionId ?? payload.sessionId }),
    });
  }

  async getCoupon(code: string): Promise<Coupon | null> {
    try {
      return await this.request<Coupon>(COUPON_ENDPOINTS.detail(code));
    } catch {
      return null;
    }
  }

  async redeemCoupon(code: string): Promise<{ redeemed: boolean; reason?: string }> {
    return this.request<{ redeemed: boolean; reason?: string }>(COUPON_ENDPOINTS.redeem(code), { method: 'POST' });
  }
}

/** Picks the demo or production implementation from config. */
export async function createCouponService(config: CampaignConfig): Promise<CouponService> {
  if (!config.demoMode && config.apiBaseUrl) {
    return new HttpCouponService(config);
  }
  const { DemoCouponService } = await import('./DemoCouponService');
  return new DemoCouponService(config);
}
