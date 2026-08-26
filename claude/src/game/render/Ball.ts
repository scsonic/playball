import { project, projectGround, type PitchPoint, type View } from '../Trajectory';

export interface BallVisual {
  x: number;
  y: number;
  radius: number;
  depth: number;
}

/**
 * Draws the incoming baseball with the depth cues that make a 2D canvas read as
 * 3D: it grows with perspective, casts a shadow that tracks along the ground,
 * spins its seams, and smears into a motion trail as it closes on the player.
 */
export class BallRenderer {
  private trail: Array<{ x: number; y: number; r: number }> = [];

  reset() {
    this.trail.length = 0;
  }

  project(point: PitchPoint, view: View): BallVisual {
    const p = project(point, view);
    return { x: p.x, y: p.y, radius: p.radius, depth: p.depth };
  }

  draw(
    ctx: CanvasRenderingContext2D,
    view: View,
    point: PitchPoint,
    spin: number,
    progress: number,
    opts: { reducedMotion: boolean; frozen: boolean },
  ): BallVisual {
    const v = this.project(point, view);

    // Ground shadow: directly under the ball, shrinking with height.
    const shadow = projectGround(point.x, point.z, view);
    const shadowScale = Math.max(0.15, 1 - point.y / 3.2);
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.28 * shadowScale})`;
    ctx.beginPath();
    ctx.ellipse(shadow.x, shadow.y, v.radius * 1.5 * shadowScale, v.radius * 0.5 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Motion trail
    if (!opts.reducedMotion && !opts.frozen) {
      this.trail.push({ x: v.x, y: v.y, r: v.radius });
      if (this.trail.length > 7) this.trail.shift();
      ctx.save();
      for (let i = 0; i < this.trail.length - 1; i++) {
        const t = this.trail[i];
        const a = (i / this.trail.length) * 0.28 * Math.min(1, progress * 1.6);
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r * (0.55 + i * 0.05), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (opts.frozen) {
      this.trail.length = 0;
    }

    // Ball body with directional shading (key light from upper right).
    ctx.save();
    ctx.translate(v.x, v.y);

    const grad = ctx.createRadialGradient(
      -v.radius * 0.32,
      -v.radius * 0.38,
      v.radius * 0.1,
      0,
      0,
      v.radius * 1.05,
    );
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.62, '#f3f0e8');
    grad.addColorStop(1, '#b9b3a4');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, v.radius, 0, Math.PI * 2);
    ctx.fill();

    // Rim light so the ball separates from the bright field.
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = Math.max(0.6, v.radius * 0.06);
    ctx.beginPath();
    ctx.arc(0, 0, v.radius * 0.97, Math.PI * 0.15, Math.PI * 0.95);
    ctx.stroke();

    // Seams
    if (v.radius > 3) {
      ctx.rotate(spin);
      ctx.strokeStyle = '#c8102e';
      ctx.lineWidth = Math.max(0.8, v.radius * 0.1);
      ctx.lineCap = 'round';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(side * v.radius * 0.92, 0, v.radius * 0.95, -Math.PI * 0.42, Math.PI * 0.42, side < 0);
        ctx.stroke();
      }
    }
    ctx.restore();

    return v;
  }
}
