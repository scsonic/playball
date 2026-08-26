import { describe, expect, it } from 'vitest';
import {
  buildSequence,
  createView,
  getSpec,
  PITCH_TYPES,
  pitchPoint,
  project,
  projectGround,
  RELEASE,
  type PitchType,
} from '../game/Trajectory';

const view = createView(1920, 1080);

describe('pitch geometry', () => {
  it('starts every pitch at the release point and ends at the catch plane', () => {
    for (const type of PITCH_TYPES) {
      const spec = getSpec(type);
      const start = pitchPoint(spec, 0);
      const end = pitchPoint(spec, 1);
      expect(start.z).toBeCloseTo(RELEASE.z);
      expect(end.z).toBeCloseTo(0.75);
      expect(start.x).toBeCloseTo(RELEASE.x);
    }
  });

  it('grows on screen as it approaches the player', () => {
    const spec = getSpec('fastball_center');
    const early = project(pitchPoint(spec, 0.1), view);
    const late = project(pitchPoint(spec, 0.95), view);
    expect(late.radius).toBeGreaterThan(early.radius * 4);
    expect(late.depth).toBeLessThan(early.depth);
  });

  it('keeps every trajectory clear of the screen edges', () => {
    for (const type of PITCH_TYPES) {
      const spec = getSpec(type);
      for (let p = 0; p <= 1; p += 0.05) {
        const screen = project(pitchPoint(spec, p), view);
        expect(screen.x).toBeGreaterThan(view.width * 0.06);
        expect(screen.x).toBeLessThan(view.width * 0.94);
        expect(screen.y).toBeGreaterThan(0);
        expect(screen.y).toBeLessThan(view.height);
      }
    }
  });

  it('produces visibly different arrival points per pitch type', () => {
    const arrivals = PITCH_TYPES.map((type) => project(pitchPoint(getSpec(type), 1), view));
    for (let i = 0; i < arrivals.length; i++) {
      for (let j = i + 1; j < arrivals.length; j++) {
        const distance = Math.hypot(arrivals[i].x - arrivals[j].x, arrivals[i].y - arrivals[j].y);
        expect(distance).toBeGreaterThan(40);
      }
    }
  });

  it('breaks laterally on curve balls but not on the four-seam', () => {
    const straightMid = pitchPoint(getSpec('fastball_center'), 0.5);
    const straightLerp = (RELEASE.x + getSpec('fastball_center').targetX) / 2;
    expect(Math.abs(straightMid.x - straightLerp)).toBeLessThan(0.01);

    const curveMid = pitchPoint(getSpec('curve_left'), 0.5);
    const curveLerp = (RELEASE.x + getSpec('curve_left').targetX) / 2;
    expect(Math.abs(curveMid.x - curveLerp)).toBeGreaterThan(0.3);
  });

  it('narrows the spread on easier difficulties', () => {
    const spec = getSpec('high_right');
    const normal = pitchPoint(spec, 1, 1);
    const easy = pitchPoint(spec, 1, 0.62);
    expect(Math.abs(easy.x)).toBeLessThan(Math.abs(normal.x));
    expect(Math.abs(easy.y - 1.42)).toBeLessThan(Math.abs(normal.y - 1.42));
  });
});

describe('ground projection', () => {
  it('places nearer ground points lower on screen', () => {
    expect(projectGround(0, 3, view).y).toBeGreaterThan(projectGround(0, 40, view).y);
  });
});

describe('buildSequence', () => {
  const pool = PITCH_TYPES;

  it('returns exactly the requested number of pitches', () => {
    expect(buildSequence(5, pool)).toHaveLength(5);
    expect(buildSequence(10, pool)).toHaveLength(10);
  });

  it('opens with a catchable pitch down the middle', () => {
    expect(buildSequence(5, pool)[0]).toBe<PitchType>('fastball_center');
  });

  it('never repeats the same pitch back to back', () => {
    for (let seed = 0; seed < 50; seed++) {
      const sequence = buildSequence(10, pool);
      for (let i = 1; i < sequence.length; i++) {
        expect(sequence[i]).not.toBe(sequence[i - 1]);
      }
    }
  });

  it('respects a restricted difficulty pool', () => {
    const easy: PitchType[] = ['fastball_center', 'high_left', 'low_right'];
    const sequence = buildSequence(8, easy);
    sequence.forEach((type) => expect(easy).toContain(type));
  });
});
