/**
 * Pitch trajectories in real-world metres, projected with a single pinhole
 * camera model.
 *
 * Working in metres rather than pixels means the perspective growth of the ball,
 * the mowing stripes on the field and the mound all agree with each other for
 * free, and the same pitch looks correct on a laptop and on a 4K signage wall.
 *
 * Axes (right-handed, from the batter's eye):
 *   X — lateral, positive to the player's right
 *   Y — height above the ground
 *   Z — depth, 0 at the player's eye, positive towards the mound
 */

export type PitchType =
  | 'fastball_center'
  | 'high_left'
  | 'high_right'
  | 'low_left'
  | 'low_right'
  | 'curve_left'
  | 'curve_right';

export const PITCH_TYPES: PitchType[] = [
  'fastball_center',
  'high_left',
  'high_right',
  'low_left',
  'low_right',
  'curve_left',
  'curve_right',
];

/** Depth of the pitcher's mound. Shared by the field art and the pitcher rig. */
export const MOUND_Z = 13;
/** Where the ball leaves the pitcher's hand. */
export const RELEASE = { x: -0.35, y: 1.95, z: MOUND_Z };
/** Depth of the catch plane — roughly where the player's hand is. */
export const PLATE_Z = 0.75;
/** Regulation-ish ball radius in metres. */
export const BALL_RADIUS_M = 0.037;

export interface PitchSpec {
  type: PitchType;
  /** Lateral target at the catch plane, metres. */
  targetX: number;
  /** Height target at the catch plane, metres. */
  targetY: number;
  /** Lateral break, metres at mid-flight. */
  break: number;
  /** Vertical hop/drop, metres at mid-flight. */
  hop: number;
  label: string;
}

const SPECS: Record<PitchType, PitchSpec> = {
  fastball_center: { type: 'fastball_center', targetX: 0.02, targetY: 1.42, break: 0, hop: 0.06, label: 'Four-seam' },
  high_left: { type: 'high_left', targetX: -0.62, targetY: 1.86, break: -0.06, hop: 0.1, label: 'High inside' },
  high_right: { type: 'high_right', targetX: 0.62, targetY: 1.86, break: 0.06, hop: 0.1, label: 'High outside' },
  low_left: { type: 'low_left', targetX: -0.58, targetY: 1.02, break: -0.05, hop: -0.12, label: 'Two-seam low' },
  low_right: { type: 'low_right', targetX: 0.58, targetY: 1.02, break: 0.05, hop: -0.12, label: 'Sinker low' },
  curve_left: { type: 'curve_left', targetX: -0.5, targetY: 1.3, break: 0.42, hop: 0.16, label: 'Sweeper' },
  curve_right: { type: 'curve_right', targetX: 0.5, targetY: 1.3, break: -0.42, hop: 0.16, label: 'Slider' },
};

export function getSpec(type: PitchType): PitchSpec {
  return SPECS[type];
}

export interface PitchPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * Position along the pitch.
 * @param p 0 at release, 1 at the catch plane.
 */
export function pitchPoint(spec: PitchSpec, p: number, spread = 1): PitchPoint {
  const t = clamp01(p);
  const arc = Math.sin(Math.PI * t); // 0 → 1 → 0 across the flight

  const targetX = spec.targetX * spread;
  const targetY = 1.42 + (spec.targetY - 1.42) * spread;

  return {
    x: lerp(RELEASE.x, targetX, t) + spec.break * spread * arc,
    // Gravity-ish sag plus the pitch's own hop, both peaking mid-flight.
    y: lerp(RELEASE.y, targetY, t) + (spec.hop - 0.22) * arc,
    z: lerp(RELEASE.z, PLATE_Z, t),
  };
}

export interface View {
  width: number;
  height: number;
  /** Focal length in pixels. */
  focal: number;
  /** Principal point. */
  cx: number;
  cy: number;
  /** Camera height above the ground, metres. */
  eyeHeight: number;
}

export function createView(width: number, height: number): View {
  return {
    width,
    height,
    // Slightly long lens: compresses the field and makes the ball read big.
    // Capped against the width so a portrait totem does not end up over-zoomed.
    focal: Math.min(height * 1.05, width * 0.95),
    cx: width / 2,
    // Horizon sits above centre so more field is visible.
    cy: height * 0.44,
    eyeHeight: 1.55,
  };
}

/**
 * Aspect-aware lateral spread.
 *
 * Pitch targets are authored for a 16:9 wall. On a narrow (portrait) display the
 * same lateral offsets would put the ball past the edge of the screen at the catch
 * plane, so the spread is scaled down to keep every pitch reachable and fair.
 */
export function lateralSpreadFor(view: View): number {
  return clamp(view.width / (view.focal * 1.7), 0.45, 1);
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export interface Projected {
  x: number;
  y: number;
  /** Pixels per metre at this depth. */
  scale: number;
  radius: number;
  depth: number;
}

export function project(point: PitchPoint, view: View, radiusM = BALL_RADIUS_M): Projected {
  const z = Math.max(0.12, point.z);
  const scale = view.focal / z;
  return {
    x: view.cx + point.x * scale,
    y: view.cy - (point.y - view.eyeHeight) * scale,
    scale,
    radius: radiusM * scale,
    depth: z,
  };
}

/** Projects a point lying on the ground plane (Y = 0) at depth z. */
export function projectGround(x: number, z: number, view: View): { x: number; y: number; scale: number } {
  const depth = Math.max(0.12, z);
  const scale = view.focal / depth;
  return { x: view.cx + x * scale, y: view.cy + view.eyeHeight * scale, scale };
}

/**
 * Builds the pitch order for one game.
 *
 * Rules: never repeat the same pitch twice in a row, always open with something
 * catchable, and keep every trajectory away from the screen edges.
 */
export function buildSequence(count: number, allowed: PitchType[], rng: () => number = Math.random): PitchType[] {
  const pool = allowed.length ? allowed : PITCH_TYPES;
  const sequence: PitchType[] = [];
  let previous: PitchType | null = null;

  for (let i = 0; i < count; i++) {
    if (i === 0 && pool.includes('fastball_center')) {
      sequence.push('fastball_center');
      previous = 'fastball_center';
      continue;
    }
    const candidates = pool.filter((t) => t !== previous);
    const pick = candidates[Math.floor(rng() * candidates.length)] ?? pool[0];
    sequence.push(pick);
    previous = pick;
  }
  return sequence;
}

/** Trajectory pools per difficulty — challenge unlocks the breaking pitches. */
export const DIFFICULTY_POOLS: Record<string, PitchType[]> = {
  easy: ['fastball_center', 'high_left', 'high_right', 'low_left', 'low_right'],
  normal: PITCH_TYPES,
  challenge: PITCH_TYPES,
};

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
