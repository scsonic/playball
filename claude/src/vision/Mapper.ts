import type { Vec2 } from '../types';

/**
 * Maps normalised camera coordinates (0..1, origin top-left of the raw frame)
 * to screen pixels.
 *
 * Two things make this more than a multiply:
 *  - **Mirroring.** The preview is mirrored so the player sees themselves as in
 *    a mirror; the x axis therefore has to be flipped exactly once.
 *  - **Active area.** Nobody at a trade show stretches their arm to the extreme
 *    edge of the camera frame, so a comfortable inner box is expanded to fill
 *    the whole screen. Without it, screen corners are physically unreachable.
 */
export class Mapper {
  private width = 1920;
  private height = 1080;

  constructor(
    private mirrored = true,
    /** Inset of the usable camera box, as a fraction of the frame. */
    private activeInsetX = 0.16,
    private activeInsetY = 0.12,
  ) {}

  setMirrored(mirrored: boolean) {
    this.mirrored = mirrored;
  }

  setActiveArea(insetX: number, insetY: number) {
    this.activeInsetX = insetX;
    this.activeInsetY = insetY;
  }

  setScreen(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getScreen(): Vec2 {
    return { x: this.width, y: this.height };
  }

  /** Normalised camera point → screen pixels. */
  toScreen(nx: number, ny: number): Vec2 {
    const mx = this.mirrored ? 1 - nx : nx;

    const spanX = Math.max(0.05, 1 - this.activeInsetX * 2);
    const spanY = Math.max(0.05, 1 - this.activeInsetY * 2);

    const ax = (mx - this.activeInsetX) / spanX;
    const ay = (ny - this.activeInsetY) / spanY;

    return {
      x: clamp(ax, 0, 1) * this.width,
      y: clamp(ay, 0, 1) * this.height,
    };
  }

  /** Normalised camera *distance* (e.g. palm width) → screen pixels. */
  scalarToScreenX(n: number): number {
    const spanX = Math.max(0.05, 1 - this.activeInsetX * 2);
    return (n / spanX) * this.width;
  }
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
