import type { CursorSample } from '../types';

export interface BallState {
  /** Screen position of the ball centre, CSS px. */
  x: number;
  y: number;
  /** Screen radius, CSS px. */
  radius: number;
  /** Flight progress, 0 at release and 1 at the catch plane. */
  progress: number;
}

export interface CatchOptions {
  /** Catch radius around the palm, CSS px. */
  palmCatchRadiusPx: number;
  /** Minimum tracking confidence for a catch to count. */
  confidenceThreshold: number;
  /** Flight-progress window in which a catch is possible. */
  catchWindow: [number, number];
  requireOpenPalm: boolean;
  /** True once this pitch has already been scored. */
  alreadyResolved: boolean;
}

export type CatchRejection =
  | 'resolved'
  | 'out_of_window'
  | 'no_tracking'
  | 'low_confidence'
  | 'palm_closed'
  | 'too_far';

export interface CatchEvaluation {
  caught: boolean;
  distance: number;
  /** Combined radius the distance was tested against. */
  threshold: number;
  reason: CatchRejection | 'catch';
  /** True while the ball is inside the catchable depth window. */
  inWindow: boolean;
}

/**
 * Pure catch test — no canvas, no camera, no timers, so it is fully unit-tested.
 *
 * The hitbox is deliberately forgiving: at a trade show a near miss that reads
 * as a catch is a much better outcome than a technically correct miss.
 */
export function evaluateCatch(ball: BallState, cursor: CursorSample, options: CatchOptions): CatchEvaluation {
  const inWindow = ball.progress >= options.catchWindow[0] && ball.progress <= options.catchWindow[1];
  const distance = Math.hypot(ball.x - cursor.x, ball.y - cursor.y);
  const threshold = ball.radius + options.palmCatchRadiusPx;

  const reject = (reason: CatchRejection): CatchEvaluation => ({
    caught: false,
    distance,
    threshold,
    reason,
    inWindow,
  });

  if (options.alreadyResolved) return reject('resolved');
  if (!inWindow) return reject('out_of_window');
  if (!cursor.present) return reject('no_tracking');
  if (cursor.confidence < options.confidenceThreshold) return reject('low_confidence');
  if (options.requireOpenPalm && !cursor.palmOpen) return reject('palm_closed');
  if (distance > threshold) return reject('too_far');

  return { caught: true, distance, threshold, reason: 'catch', inWindow };
}

/** Focal length of the reference display the catch radius was authored on (1080p). */
export const REFERENCE_FOCAL = 1080 * 1.05;

/**
 * Responsive catch radius.
 *
 * Scaled by the scene's focal length rather than by raw pixel height, so the glove
 * keeps the same size *relative to the ball* on a laptop, a 4K wall and a portrait
 * totem — the three cases where a height-based scale visibly breaks. When the camera
 * reports a real palm size we blend towards it, so a player standing closer gets a
 * proportionally bigger glove instead of a mismatched hitbox.
 */
export function resolveCatchRadius(
  baseRadiusPx: number,
  focal: number,
  difficultyScale: number,
  measuredPalmRadiusPx?: number,
): number {
  const scaled = baseRadiusPx * (focal / REFERENCE_FOCAL) * difficultyScale;
  if (!measuredPalmRadiusPx || measuredPalmRadiusPx <= 0) return scaled;
  return scaled * 0.65 + measuredPalmRadiusPx * 1.15 * 0.35;
}
