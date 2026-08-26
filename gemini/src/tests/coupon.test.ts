import { describe, it, expect } from 'vitest';
import { DemoCouponService } from '../coupon/DemoCouponService';

describe('DemoCouponService', () => {
  it('generates single-use cryptographic demo coupon with 15m expiration', async () => {
    const service = new DemoCouponService(15);
    const coupon = await service.issueCoupon({
      sessionId: 'test_session_123',
      catches: 4,
      totalPitches: 5,
      difficulty: 'normal'
    });

    expect(coupon.isDemo).toBe(true);
    expect(coupon.token.startsWith('DEMO_')).toBe(true);
    expect(coupon.code.startsWith('ITOEN-TEA-')).toBe(true);
    expect(coupon.qrUrl).toContain('DEMO_');
    expect(coupon.expiresAt).toBeGreaterThan(coupon.issuedAt);
    expect(coupon.expiresAt - coupon.issuedAt).toBe(15 * 60 * 1000);

    // Validation check
    const isValid = await service.validateCoupon(coupon.token);
    expect(isValid).toBe(true);

    const isFakeValid = await service.validateCoupon('DEMO_non_existent');
    expect(isFakeValid).toBe(false);
  });
});
