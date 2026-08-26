import { describe, expect, it } from 'vitest';
import { anatomicalHand, classifyPalm, palmCenter, palmWidth } from '../vision/PalmModel';
import { Mapper } from '../vision/Mapper';
import { Smoother } from '../vision/Smoother';
import type { Landmark } from '../types';

/**
 * Builds a synthetic right-side-up hand.
 * @param curl 0 = fully open palm, 1 = closed fist
 */
function makeHand(curl: number, cx = 0.5, cy = 0.5): Landmark[] {
  const lm: Landmark[] = new Array(21).fill(null).map(() => ({ x: cx, y: cy, z: 0 }));
  const spread = 0.05;
  const reach = 0.12 * (1 - curl) + 0.03;

  lm[0] = { x: cx, y: cy + 0.09, z: 0 }; // wrist

  const fingers = [
    { mcp: 5, pip: 6, dip: 7, tip: 8, offset: -1.5 },
    { mcp: 9, pip: 10, dip: 11, tip: 12, offset: -0.5 },
    { mcp: 13, pip: 14, dip: 15, tip: 16, offset: 0.5 },
    { mcp: 17, pip: 18, dip: 19, tip: 20, offset: 1.5 },
  ];

  for (const f of fingers) {
    const x = cx + f.offset * spread;
    lm[f.mcp] = { x, y: cy, z: 0 };
    // Curled fingers bend back towards the palm instead of extending upwards.
    lm[f.pip] = { x, y: cy - reach * 0.45, z: 0 };
    lm[f.dip] = { x: x + curl * 0.02, y: cy - reach * 0.7 + curl * 0.05, z: 0 };
    lm[f.tip] = { x: x + curl * 0.03, y: cy - reach + curl * 0.13, z: 0 };
  }

  lm[1] = { x: cx - 2.2 * spread, y: cy + 0.05, z: 0 };
  lm[2] = { x: cx - 2.6 * spread, y: cy + 0.02, z: 0 };
  lm[3] = { x: cx - 2.9 * spread, y: cy - 0.01, z: 0 };
  lm[4] = { x: cx - 3.1 * spread * (1 - curl * 0.75), y: cy - 0.03, z: 0 };
  return lm;
}

describe('palm geometry', () => {
  it('computes a stable palm centre from wrist and knuckles', () => {
    const hand = makeHand(0);
    const center = palmCenter(hand);
    expect(center.x).toBeCloseTo(0.5, 2);
    expect(center.y).toBeGreaterThan(0.49);
    expect(center.y).toBeLessThan(0.54);
  });

  it('is not dragged around by a single fingertip', () => {
    const hand = makeHand(0);
    const before = palmCenter(hand);
    hand[8] = { x: 0.9, y: 0.1, z: 0 }; // index tip flies off
    const after = palmCenter(hand);
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(1e-9);
  });

  it('measures palm width across the knuckles', () => {
    expect(palmWidth(makeHand(0))).toBeCloseTo(0.15, 2);
  });

  it('degrades safely on malformed input', () => {
    expect(palmCenter([])).toEqual({ x: 0.5, y: 0.5 });
    expect(classifyPalm([]).isOpen).toBe(false);
  });
});

describe('open palm classifier', () => {
  it('recognises an open palm', () => {
    const reading = classifyPalm(makeHand(0));
    expect(reading.isOpen).toBe(true);
    expect(reading.openness).toBeGreaterThan(0.7);
    expect(reading.extendedFingers).toBeGreaterThanOrEqual(4);
  });

  it('rejects a closed fist', () => {
    const reading = classifyPalm(makeHand(1));
    expect(reading.isOpen).toBe(false);
    expect(reading.openness).toBeLessThan(0.5);
  });

  it('is scale invariant — same verdict near and far from the camera', () => {
    const near = classifyPalm(makeHand(0, 0.5, 0.5));
    const far = classifyPalm(makeHand(0, 0.2, 0.3));
    expect(near.isOpen).toBe(far.isOpen);
  });
});

describe('handedness normalisation', () => {
  it('flips MediaPipe labels for raw (un-mirrored) camera frames', () => {
    // MediaPipe assumes a mirrored selfie image; getUserMedia gives raw frames.
    expect(anatomicalHand('Left', false)).toBe('right');
    expect(anatomicalHand('Right', false)).toBe('left');
  });

  it('keeps labels when the input image was already mirrored', () => {
    expect(anatomicalHand('Left', true)).toBe('left');
    expect(anatomicalHand('Right', true)).toBe('right');
  });
});

describe('coordinate mapping', () => {
  it('mirrors the x axis exactly once', () => {
    const mirrored = new Mapper(true, 0, 0);
    mirrored.setScreen(1000, 500);
    expect(mirrored.toScreen(0.25, 0.5).x).toBeCloseTo(750);

    const direct = new Mapper(false, 0, 0);
    direct.setScreen(1000, 500);
    expect(direct.toScreen(0.25, 0.5).x).toBeCloseTo(250);
  });

  it('expands the comfortable camera box to fill the screen', () => {
    const mapper = new Mapper(false, 0.2, 0.1);
    mapper.setScreen(1000, 500);
    expect(mapper.toScreen(0.2, 0.1).x).toBeCloseTo(0);
    expect(mapper.toScreen(0.8, 0.9).x).toBeCloseTo(1000);
    expect(mapper.toScreen(0.5, 0.5).x).toBeCloseTo(500);
  });

  it('clamps out-of-range input to the screen edges', () => {
    const mapper = new Mapper(false, 0.2, 0.1);
    mapper.setScreen(1000, 500);
    expect(mapper.toScreen(-1, -1)).toEqual({ x: 0, y: 0 });
    expect(mapper.toScreen(2, 2)).toEqual({ x: 1000, y: 500 });
  });
});

describe('cursor smoothing', () => {
  it('snaps to the first sample without inventing velocity', () => {
    const smoother = new Smoother(0.8);
    const first = smoother.update(100, 100, 0);
    expect(first).toMatchObject({ x: 100, y: 100, speed: 0 });
  });

  it('converges on a held position', () => {
    const smoother = new Smoother(0.8);
    smoother.update(0, 0, 0);
    let last = { x: 0, y: 0 };
    for (let i = 1; i <= 120; i++) last = smoother.update(500, 300, i * 16.67);
    expect(last.x).toBeCloseTo(500, 0);
    expect(last.y).toBeCloseTo(300, 0);
  });

  it('damps jitter around a static point', () => {
    const smoother = new Smoother(0.85);
    smoother.update(500, 500, 0);
    let result = { x: 500, y: 500 };
    for (let i = 1; i <= 60; i++) {
      const jitterX = 500 + (i % 2 === 0 ? 12 : -12);
      result = smoother.update(jitterX, 500, i * 16.67);
    }
    expect(Math.abs(result.x - 500)).toBeLessThan(12);
  });

  it('stays responsive during fast motion (adaptive cut-off)', () => {
    const slow = new Smoother(0.85);
    const fast = new Smoother(0.85);
    slow.update(0, 0, 0);
    fast.update(0, 0, 0);
    const slowStep = slow.update(20, 0, 16.67); // 1200 px/s
    const fastStep = fast.update(400, 0, 16.67); // 24000 px/s
    expect(fastStep.x / 400).toBeGreaterThan(slowStep.x / 20);
  });
});
