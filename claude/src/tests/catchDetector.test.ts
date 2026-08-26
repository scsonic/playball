import { describe, expect, it } from 'vitest';
import { evaluateCatch, resolveCatchRadius, type BallState, type CatchOptions } from '../game/CatchDetector';
import { createView } from '../game/Trajectory';
import type { CursorSample } from '../types';

const cursor = (patch: Partial<CursorSample> = {}): CursorSample => ({
  t: 0,
  present: true,
  source: 'hand',
  x: 500,
  y: 400,
  vx: 0,
  vy: 0,
  speed: 0,
  confidence: 0.9,
  palmOpen: true,
  palmRadiusPx: 100,
  handLabel: 'left',
  visibility: 1,
  ...patch,
});

const ball = (patch: Partial<BallState> = {}): BallState => ({
  x: 520,
  y: 410,
  radius: 40,
  progress: 0.9,
  ...patch,
});

const options = (patch: Partial<CatchOptions> = {}): CatchOptions => ({
  palmCatchRadiusPx: 120,
  confidenceThreshold: 0.4,
  catchWindow: [0.74, 1.0],
  requireOpenPalm: true,
  alreadyResolved: false,
  ...patch,
});

describe('evaluateCatch', () => {
  it('catches an overlapping ball inside the window', () => {
    const result = evaluateCatch(ball(), cursor(), options());
    expect(result.caught).toBe(true);
    expect(result.reason).toBe('catch');
  });

  it('misses when the palm is too far away', () => {
    const result = evaluateCatch(ball({ x: 1200 }), cursor(), options());
    expect(result.caught).toBe(false);
    expect(result.reason).toBe('too_far');
  });

  it('ignores a ball that has not reached the catch window', () => {
    const result = evaluateCatch(ball({ progress: 0.3 }), cursor(), options());
    expect(result.caught).toBe(false);
    expect(result.reason).toBe('out_of_window');
    expect(result.inWindow).toBe(false);
  });

  it('rejects a closed fist when an open palm is required', () => {
    const result = evaluateCatch(ball(), cursor({ palmOpen: false }), options());
    expect(result.reason).toBe('palm_closed');
  });

  it('accepts a closed hand when the open-palm rule is off (mouse mode)', () => {
    const result = evaluateCatch(ball(), cursor({ palmOpen: false }), options({ requireOpenPalm: false }));
    expect(result.caught).toBe(true);
  });

  it('rejects low-confidence tracking', () => {
    const result = evaluateCatch(ball(), cursor({ confidence: 0.1 }), options());
    expect(result.reason).toBe('low_confidence');
  });

  it('rejects a lost cursor', () => {
    const result = evaluateCatch(ball(), cursor({ present: false }), options());
    expect(result.reason).toBe('no_tracking');
  });

  it('never scores the same pitch twice', () => {
    const result = evaluateCatch(ball(), cursor(), options({ alreadyResolved: true }));
    expect(result.caught).toBe(false);
    expect(result.reason).toBe('resolved');
  });

  it('uses the combined ball + palm radius as the threshold', () => {
    const result = evaluateCatch(ball({ x: 500, y: 400 }), cursor(), options());
    expect(result.threshold).toBe(160);
    expect(result.distance).toBe(0);
  });
});

describe('resolveCatchRadius', () => {
  const landscape = createView(1920, 1080);
  const uhd = createView(3840, 2160);
  const portrait = createView(1080, 1920);

  it('matches the authored radius on the reference display', () => {
    expect(resolveCatchRadius(140, landscape.focal, 1)).toBeCloseTo(140);
  });

  it('scales with the scene, not with raw pixel height', () => {
    expect(resolveCatchRadius(140, uhd.focal, 1)).toBeCloseTo(280);
    // A portrait totem is taller in pixels but has a *narrower* scene: a
    // height-based scale would hand the player an absurdly large glove.
    const portraitRadius = resolveCatchRadius(140, portrait.focal, 1);
    expect(portraitRadius).toBeLessThan(140);
    expect(portraitRadius).toBeGreaterThan(100);
  });

  it('applies the difficulty multiplier', () => {
    expect(resolveCatchRadius(140, landscape.focal, 1.25)).toBeCloseTo(175);
    expect(resolveCatchRadius(140, landscape.focal, 0.82)).toBeCloseTo(114.8);
  });

  it('blends towards a measured palm when hand tracking is live', () => {
    const blended = resolveCatchRadius(140, landscape.focal, 1, 200);
    expect(blended).toBeGreaterThan(140);
    expect(blended).toBeLessThan(230);
  });
});
