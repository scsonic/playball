import { CouponData } from '../types/game';

export interface ICouponService {
  issueCoupon(params: {
    sessionId: string;
    catches: number;
    totalPitches: number;
    difficulty: string;
  }): Promise<CouponData>;
  validateCoupon(token: string): Promise<boolean>;
}

export class DemoCouponService implements ICouponService {
  private issuedTokens: Set<string> = new Set();
  private expirationMinutes: number = 15;
  private baseUrl: string = 'https://campaign.example.com/claim';

  constructor(expirationMinutes: number = 15, baseUrl: string = 'https://campaign.example.com/claim') {
    this.expirationMinutes = expirationMinutes;
    this.baseUrl = baseUrl;
  }

  public async issueCoupon(params: {
    sessionId: string;
    catches: number;
    totalPitches: number;
    difficulty: string;
  }): Promise<CouponData> {
    const now = Date.now();
    const expiresAt = now + this.expirationMinutes * 60 * 1000;

    // Cryptographically random token
    const randomArray = new Uint8Array(8);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(randomArray);
    } else {
      for (let i = 0; i < 8; i++) randomArray[i] = Math.floor(Math.random() * 256);
    }
    const hexToken = Array.from(randomArray)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const token = `DEMO_${hexToken}`;
    const code = `ITOEN-TEA-${hexToken.substring(0, 4).toUpperCase()}-${hexToken.substring(4, 8).toUpperCase()}`;
    const qrUrl = `${this.baseUrl}/${token}?score=${params.catches}_${params.totalPitches}&diff=${params.difficulty}&demo=1`;

    this.issuedTokens.add(token);

    return {
      token,
      code,
      qrUrl,
      issuedAt: now,
      expiresAt,
      isDemo: true,
      catches: params.catches,
      totalPitches: params.totalPitches,
      sessionId: params.sessionId
    };
  }

  public async validateCoupon(token: string): Promise<boolean> {
    return this.issuedTokens.has(token);
  }
}

export const demoCouponService = new DemoCouponService(15);
