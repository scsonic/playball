import { PitchTrajectoryPoint, TrackingFrame } from '../types/game';

export interface CatchCheckResult {
  isCatch: boolean;
  distancePx: number;
  thresholdPx: number;
  inDepthWindow: boolean;
  palmValid: boolean;
  reason?: string;
}

export class CatchDetector {
  /**
   * Catch depth window: ball must be close to the player's plane (Z <= 0.22)
   */
  public static readonly CATCH_WINDOW_MAX_Z = 0.22;
  public static readonly CATCH_WINDOW_MIN_Z = -0.05;

  /**
   * Evaluates if an active pitch collides with the player's tracked palm
   */
  public static checkCollision(
    ballPoint: PitchTrajectoryPoint,
    screenWidth: number,
    screenHeight: number,
    trackingFrame: TrackingFrame,
    palmCatchRadiusPx: number = 140
  ): CatchCheckResult {
    // 1. Depth window check
    const inDepthWindow =
      ballPoint.z <= this.CATCH_WINDOW_MAX_Z && ballPoint.z >= this.CATCH_WINDOW_MIN_Z;

    if (!inDepthWindow) {
      return {
        isCatch: false,
        distancePx: 999,
        thresholdPx: palmCatchRadiusPx,
        inDepthWindow: false,
        palmValid: trackingFrame.palmOpen,
        reason: 'Out of depth window'
      };
    }

    // 2. Open palm & confidence check
    const palmValid =
      trackingFrame.handDetected &&
      trackingFrame.palmOpen &&
      trackingFrame.confidence >= 0.4;

    if (!palmValid) {
      return {
        isCatch: false,
        distancePx: 999,
        thresholdPx: palmCatchRadiusPx,
        inDepthWindow: true,
        palmValid: false,
        reason: 'Palm not open or tracking lost'
      };
    }

    // 3. Pixel distance calculation
    const ballScreenX = ballPoint.x * screenWidth;
    const ballScreenY = ballPoint.y * screenHeight;

    const palmScreenX = trackingFrame.screenPos.x;
    const palmScreenY = trackingFrame.screenPos.y;

    const distancePx = Math.hypot(ballScreenX - palmScreenX, ballScreenY - palmScreenY);

    // Ball radius scales with Z
    const baseBallRadius = 16;
    const currentBallRadius = (baseBallRadius + (1.0 - ballPoint.z) * 65) * ballPoint.scale;
    const combinedThresholdPx = currentBallRadius + palmCatchRadiusPx;

    const isCatch = distancePx <= combinedThresholdPx;

    return {
      isCatch,
      distancePx,
      thresholdPx: combinedThresholdPx,
      inDepthWindow: true,
      palmValid: true,
      reason: isCatch ? 'Success' : 'Distance too large'
    };
  }
}
