import type { CampaignConfig } from '../config/campaign.config';
import type { Coupon } from '../types';
import type { CouponService, GameResultPayload } from './CouponService';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 — read aloud safely

export function randomToken(length = 20): string {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function formatCouponCode(token: string): string {
  return `DEMO-${token.slice(0, 4)}-${token.slice(4, 8)}-${token.slice(8, 12)}`;
}

/**
 * Local, offline coupon generator for demos and trade-show prototypes.
 *
 * Every code it produces is clearly marked as a demo and is **not redeemable**.
 * Real campaigns must swap in `HttpCouponService`: a browser can never be the
 * authority on who won, so production tokens are minted server-side only.
 */
export class DemoCouponService implements CouponService {
  readonly mode = 'demo' as const;
  private issued = new Map<string, Coupon>();

  constructor(private config: CampaignConfig) {}

  setConfig(config: CampaignConfig) {
    this.config = config;
  }

  async createSession(): Promise<{ sessionId: string }> {
    return { sessionId: randomToken(16) };
  }

  async submitResult(): Promise<{ accepted: boolean }> {
    return { accepted: true };
  }

  async issueCoupon(payload: GameResultPayload): Promise<Coupon> {
    if (!payload.won) {
      throw new Error('coupon_requires_win');
    }
    const token = randomToken(24);
    const now = Date.now();
    const coupon: Coupon = {
      code: formatCouponCode(token),
      token,
      issuedAt: now,
      expiresAt: now + this.config.couponExpirationMinutes * 60_000,
      // Only anonymous, non-identifying parameters travel in the QR URL.
      claimUrl:
        `${this.config.couponBaseUrl}/${token}` +
        `?demo=1&score=${payload.catches}/${payload.totalPitches}&sid=${encodeURIComponent(payload.sessionId)}`,
      demo: true,
      rewardLabel: 'ITO EN Green Tea (concept reward)',
    };
    this.issued.set(coupon.code, coupon);
    return coupon;
  }

  async getCoupon(code: string): Promise<Coupon | null> {
    return this.issued.get(code) ?? null;
  }

  async redeemCoupon(code: string): Promise<{ redeemed: boolean; reason?: string }> {
    const coupon = this.issued.get(code);
    if (!coupon) return { redeemed: false, reason: 'not_found' };
    if (Date.now() > coupon.expiresAt) return { redeemed: false, reason: 'expired' };
    // Demo coupons are single-use locally too, so the flow matches production.
    this.issued.delete(code);
    return { redeemed: false, reason: 'demo_not_redeemable' };
  }
}
