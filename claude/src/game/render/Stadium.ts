import { MOUND_Z, projectGround, type View } from '../Trajectory';

export interface SceneOptions {
  reducedMotion: boolean;
  highContrast: boolean;
  /** Optional licensed/stock stadium plate; procedural art is used when absent. */
  backgroundImage?: HTMLImageElement | null;
  /** Sponsor board label, kept configurable so it can be swapped or blanked. */
  sponsorLabel: string;
  /** 0..1 celebration intensity — brightens lights and wakes the crowd. */
  excitement: number;
}

/** Depth of the outfield wall and the stands behind it, in metres. */
const WALL_Z = 96;
const STANDS_Z = 104;
const CROWD_ROWS = 18;
const CROWD_COLS = 96;

/**
 * Procedural daytime ballpark.
 *
 * Drawn with the same pinhole camera the ball uses, so a pitch released 13 m away
 * lands exactly on the mound that the field geometry puts there. Everything is
 * generated in code — no licensed photography is needed for the prototype — and an
 * authorised stadium plate can be layered in later via `backgroundImage`.
 */
export class StadiumRenderer {
  private crowdSeed: Float32Array;

  constructor() {
    this.crowdSeed = new Float32Array(CROWD_ROWS * CROWD_COLS * 3);
    for (let i = 0; i < this.crowdSeed.length; i++) this.crowdSeed[i] = Math.random();
  }

  draw(ctx: CanvasRenderingContext2D, view: View, time: number, opts: SceneOptions) {
    const { width, height } = view;

    if (opts.backgroundImage) {
      drawCover(ctx, opts.backgroundImage, width, height);
    } else {
      this.drawSky(ctx, view, time, opts);
      this.drawStands(ctx, view, time, opts);
      this.drawWall(ctx, view, opts);
    }

    this.drawField(ctx, view, opts);
    this.drawMound(ctx, view);
    this.drawLightSweep(ctx, view, time, opts);
  }

  // ------------------------------------------------------------------- sky
  private drawSky(ctx: CanvasRenderingContext2D, view: View, time: number, opts: SceneOptions) {
    const horizon = view.cy + view.eyeHeight * (view.focal / WALL_Z);
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    if (opts.highContrast) {
      sky.addColorStop(0, '#03152f');
      sky.addColorStop(1, '#0a3c7d');
    } else {
      sky.addColorStop(0, '#1b6bb8');
      sky.addColorStop(0.55, '#63a9df');
      sky.addColorStop(1, '#c9e6f7');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, view.width, horizon + 2);

    // Sun glow over the first-base side.
    const glow = ctx.createRadialGradient(
      view.width * 0.8,
      view.height * 0.04,
      10,
      view.width * 0.8,
      view.height * 0.04,
      view.height * 0.42,
    );
    glow.addColorStop(0, 'rgba(255,244,206,0.7)');
    glow.addColorStop(1, 'rgba(255,244,206,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, view.width, horizon);

    if (!opts.highContrast) this.drawClouds(ctx, view, time, opts.reducedMotion);
    this.drawLightTowers(ctx, view, opts);
  }

  private drawClouds(ctx: CanvasRenderingContext2D, view: View, time: number, reducedMotion: boolean) {
    const drift = reducedMotion ? 0 : (time / 90) % (view.width * 1.6);
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 5; i++) {
      const baseX = (i * view.width) / 4 - view.width * 0.15;
      const x = ((baseX + drift) % (view.width * 1.4)) - view.width * 0.2;
      const y = view.height * (0.05 + (i % 3) * 0.05);
      const s = view.height * (0.035 + (i % 2) * 0.02);
      ctx.beginPath();
      ctx.ellipse(x, y, s * 2.4, s, 0, 0, Math.PI * 2);
      ctx.ellipse(x + s * 1.4, y + s * 0.2, s * 1.5, s * 0.75, 0, 0, Math.PI * 2);
      ctx.ellipse(x - s * 1.5, y + s * 0.25, s * 1.3, s * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Floodlight rigs framing the bowl — a cheap, very effective "stadium" cue. */
  private drawLightTowers(ctx: CanvasRenderingContext2D, view: View, opts: SceneOptions) {
    const scale = view.focal / STANDS_Z;
    const yAt = (h: number) => view.cy - (h - view.eyeHeight) * scale;

    for (const side of [-1, 1]) {
      const x = view.cx + side * 34 * scale;
      const top = yAt(38);
      const bottom = yAt(24);

      ctx.fillStyle = '#0a1a33';
      ctx.fillRect(x - 1.1 * scale, top, 2.2 * scale, bottom - top);

      const rigW = 11 * scale;
      const rigH = 4.2 * scale;
      ctx.fillStyle = '#132a4e';
      ctx.fillRect(x - rigW / 2, top - rigH, rigW, rigH);

      const lampR = Math.max(1, rigH * 0.14);
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 8; c++) {
          ctx.fillStyle = `rgba(255,250,220,${0.55 + opts.excitement * 0.45})`;
          ctx.beginPath();
          ctx.arc(x - rigW / 2 + ((c + 0.5) * rigW) / 8, top - rigH + ((r + 0.5) * rigH) / 3, lampR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // ---------------------------------------------------------------- stands
  private drawStands(ctx: CanvasRenderingContext2D, view: View, time: number, opts: SceneOptions) {
    const scale = view.focal / STANDS_Z;
    const yAt = (h: number) => view.cy - (h - view.eyeHeight) * scale;

    const bowlBottom = yAt(3.8);
    const bowlTop = yAt(19);
    const roofTop = yAt(24.5);

    // Roof / upper structure
    ctx.fillStyle = opts.highContrast ? '#01060f' : '#0a1a33';
    ctx.fillRect(0, roofTop, view.width, bowlTop - roofTop);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(0, roofTop, view.width, Math.max(2, (bowlTop - roofTop) * 0.16));

    // Bowl
    const bowl = ctx.createLinearGradient(0, bowlTop, 0, bowlBottom);
    bowl.addColorStop(0, '#16304f');
    bowl.addColorStop(1, '#0c1e38');
    ctx.fillStyle = bowl;
    ctx.fillRect(0, bowlTop, view.width, bowlBottom - bowlTop);

    // Crowd: muted speckle, denser and darker towards the back rows.
    const rowHeight = (bowlBottom - bowlTop) / CROWD_ROWS;
    const colWidth = view.width / CROWD_COLS;
    const excitement = opts.excitement;

    for (let r = 0; r < CROWD_ROWS; r++) {
      const y = bowlTop + r * rowHeight;
      const depth = 0.35 + (r / CROWD_ROWS) * 0.65;
      for (let c = 0; c < CROWD_COLS; c++) {
        const i = (r * CROWD_COLS + c) * 3;
        const s0 = this.crowdSeed[i];
        const s1 = this.crowdSeed[i + 1];
        const s2 = this.crowdSeed[i + 2];
        if (s0 < 0.3) continue; // empty seats break up the noise

        const bob = opts.reducedMotion ? 0 : Math.sin(time / 300 + s2 * 12) * rowHeight * 0.12 * (0.25 + excitement);
        // Mostly neutral tones with a few team colours — reads as a crowd, not static.
        const tone =
          s1 < 0.55 ? '198,206,218' : s1 < 0.74 ? '150,160,176' : s1 < 0.87 ? '196,92,96' : '224,196,132';
        ctx.fillStyle = `rgba(${tone},${(0.18 + s0 * 0.22) * depth})`;
        ctx.fillRect(c * colWidth + s1 * 1.5, y + bob, colWidth * 0.6, rowHeight * 0.5);
      }

      // Aisle shadow every few rows adds structure.
      if (r % 6 === 5) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(0, y + rowHeight * 0.72, view.width, rowHeight * 0.22);
      }
    }

    // Camera flashes on big moments.
    if (!opts.reducedMotion && excitement > 0.05) {
      const flashes = Math.floor(excitement * 18);
      for (let i = 0; i < flashes; i++) {
        const fx = ((Math.sin(time / 70 + i * 31.7) + 1) / 2) * view.width;
        const fy = bowlTop + ((Math.cos(time / 90 + i * 17.3) + 1) / 2) * (bowlBottom - bowlTop);
        ctx.fillStyle = `rgba(255,255,255,${0.4 * excitement})`;
        ctx.beginPath();
        ctx.arc(fx, fy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Front rail
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(0, bowlBottom - 2, view.width, 3);
  }

  private drawWall(ctx: CanvasRenderingContext2D, view: View, opts: SceneOptions) {
    const scale = view.focal / WALL_Z;
    const yTop = view.cy - (4 - view.eyeHeight) * scale;
    const yBottom = view.cy + view.eyeHeight * scale;
    const h = yBottom - yTop;

    const wall = ctx.createLinearGradient(0, yTop, 0, yBottom);
    wall.addColorStop(0, '#0f3f24');
    wall.addColorStop(1, '#06251a');
    ctx.fillStyle = wall;
    ctx.fillRect(0, yTop, view.width, h);

    // Yellow home-run line along the top of the fence
    ctx.fillStyle = 'rgba(246,196,83,0.9)';
    ctx.fillRect(0, yTop, view.width, Math.max(1.5, h * 0.1));

    // Sponsor boards — replaceable placeholder panels, never imitated trade dress.
    const panels = 7;
    const panelW = view.width / panels;
    const panelH = h * 0.58;
    const panelY = yTop + h * 0.26;
    for (let i = 0; i < panels; i++) {
      const x = i * panelW + panelW * 0.05;
      const w = panelW * 0.9;
      const featured = i % 3 === 1;
      ctx.fillStyle = featured ? 'rgba(35,124,60,0.9)' : 'rgba(255,255,255,0.09)';
      ctx.fillRect(x, panelY, w, panelH);
      if (featured && panelH > 7) {
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.font = `700 ${Math.max(6, panelH * 0.46)}px Outfit, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(opts.sponsorLabel, x + w / 2, panelY + panelH / 2, w * 0.85);
        ctx.restore();
      }
    }
  }

  // ----------------------------------------------------------------- field
  private drawField(ctx: CanvasRenderingContext2D, view: View, opts: SceneOptions) {
    const horizonY = view.cy + view.eyeHeight * (view.focal / WALL_Z);

    const grass = ctx.createLinearGradient(0, horizonY, 0, view.height);
    if (opts.highContrast) {
      grass.addColorStop(0, '#0e4526');
      grass.addColorStop(1, '#062916');
    } else {
      grass.addColorStop(0, '#3f8f47');
      grass.addColorStop(0.35, '#2f7a3a');
      grass.addColorStop(1, '#1d5b2a');
    }
    ctx.fillStyle = grass;
    ctx.fillRect(0, horizonY - 1, view.width, view.height - horizonY + 1);

    // Mown checkerboard: depth bands crossed with converging lateral strips.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizonY, view.width, view.height - horizonY);
    ctx.clip();

    const bands = [96, 66, 46, 33, 24, 17, 12, 8.5, 6, 4, 2.6, 1.5, 0.7];
    for (let i = 0; i < bands.length - 1; i++) {
      const yFar = projectGround(0, bands[i], view).y;
      const yNear = projectGround(0, bands[i + 1], view).y;
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(0, yFar, view.width, yNear - yFar);
      }
      for (let x = -70; x < 70; x += 8) {
        if (Math.floor((x + 70) / 8) % 2 !== i % 2) continue;
        const a = projectGround(x, bands[i], view);
        const b = projectGround(x + 8, bands[i], view);
        const c = projectGround(x + 8, bands[i + 1], view);
        const d = projectGround(x, bands[i + 1], view);
        ctx.fillStyle = 'rgba(0,0,0,0.055)';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        ctx.fill();
      }
    }

    this.drawInfieldSkin(ctx, view);
    this.drawHomeDirt(ctx, view);
    ctx.restore();
  }

  /**
   * The dirt "skin" behind the bases: an annulus centred on home plate, between
   * the base paths and the outfield grass arc. Sampled on the ground plane so it
   * follows the same perspective as everything else.
   */
  private drawInfieldSkin(ctx: CanvasRenderingContext2D, view: View) {
    const inner = 26;
    const outer = 38;
    ctx.save();
    ctx.fillStyle = clayGradient(ctx, view);
    ctx.beginPath();
    arcOnGround(ctx, view, outer, -0.95, 0.95, false);
    arcOnGround(ctx, view, inner, 0.95, -0.95, true);
    ctx.closePath();
    ctx.fill();

    // Grass edge highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = Math.max(1, view.height * 0.002);
    ctx.beginPath();
    arcOnGround(ctx, view, outer, -0.95, 0.95, false);
    ctx.stroke();
    ctx.restore();
  }

  /** Home-plate dirt circle in the immediate foreground, plus the chalk lines. */
  private drawHomeDirt(ctx: CanvasRenderingContext2D, view: View) {
    ctx.save();
    ctx.fillStyle = clayGradient(ctx, view);
    ctx.beginPath();
    const radius = 5.2;
    let started = false;
    for (let a = -Math.PI * 0.5; a <= Math.PI * 0.5; a += Math.PI / 48) {
      const z = Math.cos(a) * radius;
      if (z < 0.6) continue;
      const p = projectGround(Math.sin(a) * radius, z, view);
      if (!started) {
        ctx.moveTo(p.x, p.y);
        started = true;
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.lineTo(view.width + 60, view.height + 60);
    ctx.lineTo(-60, view.height + 60);
    ctx.closePath();
    ctx.fill();

    // Foul lines running out past the player.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = Math.max(2, view.height * 0.0035);
    for (const side of [-1, 1]) {
      const far = projectGround(side * 26, 27, view);
      const near = projectGround(side * 3, 1.4, view);
      ctx.beginPath();
      ctx.moveTo(far.x, far.y);
      ctx.lineTo(near.x, near.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawMound(ctx: CanvasRenderingContext2D, view: View) {
    const scale = view.focal / MOUND_Z;
    const center = projectGround(0, MOUND_Z, view);
    const rx = 2.75 * scale;
    const ry = rx * 0.26;

    ctx.save();
    const dirt = ctx.createLinearGradient(0, center.y - ry, 0, center.y + ry);
    dirt.addColorStop(0, '#c88a5c');
    dirt.addColorStop(1, '#8e5330');
    ctx.fillStyle = dirt;
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(center.x, center.y + ry * 0.55, rx * 0.92, ry * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rubber
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(center.x - 0.3 * scale, center.y - 0.02 * scale, 0.6 * scale, Math.max(1.5, 0.05 * scale));
    ctx.restore();
  }

  private drawLightSweep(ctx: CanvasRenderingContext2D, view: View, time: number, opts: SceneOptions) {
    if (opts.excitement <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const sweepX = ((time / 12) % (view.width * 1.6)) - view.width * 0.3;
    const g = ctx.createLinearGradient(sweepX - 200, 0, sweepX + 200, view.height);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, `rgba(255,255,240,${0.07 * opts.excitement})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, view.width, view.height);
    ctx.restore();
  }
}

/** Traces an arc of given radius around home plate on the ground plane. */
function arcOnGround(
  ctx: CanvasRenderingContext2D,
  view: View,
  radius: number,
  fromAngle: number,
  toAngle: number,
  continuePath: boolean,
) {
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const a = fromAngle + ((toAngle - fromAngle) * i) / steps;
    const p = projectGround(Math.sin(a) * radius, Math.cos(a) * radius, view);
    if (i === 0 && !continuePath) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
}

function clayGradient(ctx: CanvasRenderingContext2D, view: View): CanvasGradient {
  const g = ctx.createLinearGradient(0, view.cy, 0, view.height);
  g.addColorStop(0, '#c98d5f');
  g.addColorStop(0.55, '#b0714a');
  g.addColorStop(1, '#8f5733');
  return g;
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, width: number, height: number) {
  const ratio = Math.max(width / img.width, height / img.height);
  const w = img.width * ratio;
  const h = img.height * ratio;
  ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
}
