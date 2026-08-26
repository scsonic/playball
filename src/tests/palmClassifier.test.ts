import { describe, it, expect } from 'vitest';
import { PalmClassifier } from '../vision/PalmClassifier';
import { HandLandmark } from '../types/game';

describe('PalmClassifier', () => {
  it('computes stable palm center from wrist and MCP landmarks', () => {
    // Generate mock landmarks
    const mockLandmarks: HandLandmark[] = Array.from({ length: 21 }, (_, i) => ({
      x: 0.5 + (i % 5) * 0.02,
      y: 0.5 + Math.floor(i / 5) * 0.02,
      z: 0
    }));

    const center = PalmClassifier.computePalmCenter(mockLandmarks);
    expect(center.x).toBeGreaterThan(0.4);
    expect(center.x).toBeLessThan(0.6);
    expect(center.y).toBeGreaterThan(0.4);
    expect(center.y).toBeLessThan(0.6);
  });

  it('correctly classifies extended fingers as open palm', () => {
    const openHandLandmarks: HandLandmark[] = Array.from({ length: 21 }, () => ({
      x: 0.5,
      y: 0.5,
      z: 0
    }));

    // Wrist at (0.5, 0.8)
    openHandLandmarks[0] = { x: 0.5, y: 0.8, z: 0 };

    // MCPs at y = 0.55
    [1, 5, 9, 13, 17].forEach((idx) => {
      openHandLandmarks[idx] = { x: 0.5, y: 0.55, z: 0 };
    });

    // Tips extended far forward at y = 0.15
    [4, 8, 12, 16, 20].forEach((idx) => {
      openHandLandmarks[idx] = { x: 0.5, y: 0.15, z: 0 };
    });

    const result = PalmClassifier.isOpenPalm(openHandLandmarks);
    expect(result.isOpen).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.7);
  });
});
