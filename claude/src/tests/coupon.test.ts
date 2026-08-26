import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../config/campaign.config';
import { DemoCouponService, formatCouponCode, randomToken } from '../coupon/DemoCouponService';
import type { GameResultPayload } from '../coupon/CouponService';

const winPayload: GameResultPayload = {
  sessionId: 'session-1',
  catches: 4,
  totalPitches: 5,
  requiredCatches: 3,
  won: true,
  difficulty: 'normal',
  durationMs: 42_000,
};

describe('demo coupon generation', () => {
  it('produces unambiguous, unique tokens', () => {
    const tokens = new Set(Array.from({ length: 500 }, () => randomToken(20)));
    expect(tokens.size).toBe(500);
    tokens.forEach((token) => {
      expect(token).toHaveLength(20);
      expect(token).toMatch(/^[A-HJ-NP-Z2-9]+$/); // no I, O, 0, 1
    });
  });

  it('marks every demo code as a demo', () => {
    expect(formatCouponCode(randomToken(24)).startsWith('DEMO-')).toBe(true);
  });

  it('issues a coupon with an expiry and a QR claim URL after a win', async () => {
    const service = new DemoCouponService(DEFAULT_CONFIG);
    const coupon = await service.issueCoupon(winPayload);

    expect(coupon.demo).toBe(true);
    expect(coupon.code).toMatch(/^DEMO-/);
    expect(coupon.expiresAt - coupon.issuedAt).toBe(DEFAULT_CONFIG.couponExpirationMinutes * 60_000);
    expect(coupon.claimUrl).toContain(coupon.token);
    expect(coupon.claimUrl).toContain('score=4/5');
  });

  it('carries no personal data in the QR URL', async () => {
    const service = new DemoCouponService(DEFAULT_CONFIG);
    const coupon = await service.issueCoupon(winPayload);
    const params = new URL(coupon.claimUrl).searchParams;
    expect([...params.keys()].sort()).toEqual(['demo', 'score', 'sid']);
  });

  it('refuses to issue a coupon for a loss', async () => {
    const service = new DemoCouponService(DEFAULT_CONFIG);
    await expect(service.issueCoupon({ ...winPayload, won: false, catches: 2 })).rejects.toThrow('coupon_requires_win');
  });

  it('is single use and never redeemable in demo mode', async () => {
    const service = new DemoCouponService(DEFAULT_CONFIG);
    const coupon = await service.issueCoupon(winPayload);

    expect(await service.getCoupon(coupon.code)).not.toBeNull();
    const first = await service.redeemCoupon(coupon.code);
    expect(first).toEqual({ redeemed: false, reason: 'demo_not_redeemable' });

    const second = await service.redeemCoupon(coupon.code);
    expect(second.reason).toBe('not_found');
    expect(await service.getCoupon(coupon.code)).toBeNull();
  });

  it('reports an expired coupon rather than silently accepting it', async () => {
    const service = new DemoCouponService({ ...DEFAULT_CONFIG, couponExpirationMinutes: -1 });
    const coupon = await service.issueCoupon(winPayload);
    expect((await service.redeemCoupon(coupon.code)).reason).toBe('expired');
  });
});
