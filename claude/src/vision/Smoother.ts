/**
 * Adaptive exponential smoother (a light "one-euro" style filter).
 *
 * A fixed low-pass filter forces a choice between jittery-but-responsive and
 * smooth-but-laggy. Instead the cut-off adapts to palm speed: nearly still hands
 * get heavy smoothing (so dwell targeting is rock solid), fast hands get almost
 * none (so catching a 2.2 s pitch still feels 1:1).
 */
export class Smoother {
  private x = 0;
  private y = 0;
  private vx = 0;
  private vy = 0;
  private lastT = 0;
  private initialised = false;

  /**
   * @param base      smoothing factor at rest (0..1, higher = smoother)
   * @param speedRef  speed (px/s) at which smoothing is halved
   */
  constructor(
    private base = 0.75,
    private speedRef = 900,
  ) {}

  setBase(base: number) {
    this.base = Math.min(0.98, Math.max(0, base));
  }

  reset() {
    this.initialised = false;
    this.vx = 0;
    this.vy = 0;
  }

  /** Snaps the filter to a position without generating a velocity spike. */
  snapTo(x: number, y: number, t: number) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.lastT = t;
    this.initialised = true;
  }

  update(x: number, y: number, t: number) {
    if (!this.initialised) {
      this.snapTo(x, y, t);
      return { x: this.x, y: this.y, vx: 0, vy: 0, speed: 0 };
    }

    const dt = Math.max(1, t - this.lastT) / 1000;
    this.lastT = t;

    const rawVx = (x - this.x) / dt;
    const rawVy = (y - this.y) / dt;
    const rawSpeed = Math.hypot(rawVx, rawVy);

    // Adaptive alpha: alpha -> base at rest, -> ~0 when moving fast.
    const alpha = this.base / (1 + rawSpeed / this.speedRef);

    this.x = alpha * this.x + (1 - alpha) * x;
    this.y = alpha * this.y + (1 - alpha) * y;

    // Velocity gets its own (heavier) filter so the dwell gate does not flicker.
    this.vx = 0.7 * this.vx + 0.3 * rawVx;
    this.vy = 0.7 * this.vy + 0.3 * rawVy;

    return { x: this.x, y: this.y, vx: this.vx, vy: this.vy, speed: Math.hypot(this.vx, this.vy) };
  }
}
