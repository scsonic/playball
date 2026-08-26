import { describe, it, expect } from 'vitest';
import { TrajectoryGenerator } from '../game/TrajectoryGenerator';
import { CatchDetector } from '../game/CatchDetector';
import { TrackingFrame } from '../types/game';

describe('TrajectoryGenerator & CatchDetector', () => {
  it('computes 2.5D trajectory depth properly from mound to camera', () => {
    const pointStart = TrajectoryGenerator.calculatePoint('fastball_center', 0.0);
    const pointMid = TrajectoryGenerator.calculatePoint('fastball_center', 0.5);
    const pointEnd = TrajectoryGenerator.calculatePoint('fastball_center', 1.0);

    expect(pointStart.z).toBeCloseTo(1.0, 1);
    expect(pointEnd.z).toBeCloseTo(0.0, 1);
    expect(pointStart.scale).toBeLessThan(pointMid.scale);
    expect(pointMid.scale).toBeLessThan(pointEnd.scale);
  });

  it('detects successful collision when palm is open and in catch zone', () => {
    const arrivalPoint = TrajectoryGenerator.calculatePoint('fastball_center', 0.95);
    const screenWidth = 1920;
    const screenHeight = 1080;

    const trackingFrame: TrackingFrame = {
      timestamp: 1000,
      personDetected: true,
      handDetected: true,
      isLeftHand: true,
      palmOpen: true,
      confidence: 0.95,
      rawPalmCenter: { x: arrivalPoint.x, y: arrivalPoint.y },
      smoothedPalmCenter: { x: arrivalPoint.x, y: arrivalPoint.y },
      screenPos: { x: arrivalPoint.x * screenWidth, y: arrivalPoint.y * screenHeight },
      velocity: 10,
      lightingQuality: 'good'
    };

    const result = CatchDetector.checkCollision(
      arrivalPoint,
      screenWidth,
      screenHeight,
      trackingFrame,
      140
    );

    expect(result.isCatch).toBe(true);
    expect(result.inDepthWindow).toBe(true);
    expect(result.palmValid).toBe(true);
  });

  it('rejects catch if palm is closed or out of depth window', () => {
    const earlyPoint = TrajectoryGenerator.calculatePoint('fastball_center', 0.2); // Z ~ 0.85
    const trackingFrame: TrackingFrame = {
      timestamp: 1000,
      personDetected: true,
      handDetected: true,
      isLeftHand: true,
      palmOpen: false, // Closed fist
      confidence: 0.95,
      rawPalmCenter: { x: 0.5, y: 0.5 },
      smoothedPalmCenter: { x: 0.5, y: 0.5 },
      screenPos: { x: 960, y: 540 },
      velocity: 10,
      lightingQuality: 'good'
    };

    const result = CatchDetector.checkCollision(
      earlyPoint,
      1920,
      1080,
      trackingFrame,
      140
    );

    expect(result.isCatch).toBe(false);
    expect(result.inDepthWindow).toBe(false);
  });
});
