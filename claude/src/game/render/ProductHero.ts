/**
 * Sponsor product pedestal — a cold green-tea bottle on a slowly rotating base.
 *
 * Drawn procedurally as a **concept placeholder**: a generic bottle silhouette in
 * tea-green, deliberately not a reproduction of any real packaging or trade dress.
 * When `image` is supplied (licensed product photography via the asset manifest)
 * it replaces the drawing entirely, keeping the pedestal, glow and light sweep.
 */
export interface ProductHeroOptions {
  /** 0..1, drives the light sweep and glow after a catch. */
  excitement: number;
  reducedMotion: boolean;
  image?: HTMLImageElement | null;
  label: string;
}

export function drawProductHero(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  height: number,
  time: number,
  opts: ProductHeroOptions,
) {
  const bob = opts.reducedMotion ? 0 : Math.sin(time / 900) * height * 0.02;
  const w = height * 0.34;

  ctx.save();
  ctx.translate(cx, cy + bob);

  // Pedestal glow
  const glow = ctx.createRadialGradient(0, height * 0.52, height * 0.05, 0, height * 0.52, height * 0.62);
  glow.addColorStop(0, `rgba(141,198,63,${0.34 + opts.excitement * 0.3})`);
  glow.addColorStop(1, 'rgba(141,198,63,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(0, height * 0.52, height * 0.55, height * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rotating pedestal disc
  const spin = opts.reducedMotion ? 0 : (time / 4200) % (Math.PI * 2);
  ctx.save();
  ctx.translate(0, height * 0.5);
  ctx.scale(1, 0.3);
  ctx.rotate(spin);
  const disc = ctx.createLinearGradient(-height * 0.36, 0, height * 0.36, 0);
  disc.addColorStop(0, '#c8a24a');
  disc.addColorStop(0.5, '#f4e0a4');
  disc.addColorStop(1, '#a8802f');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(0, 0, height * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (opts.image && opts.image.complete && opts.image.naturalWidth > 0) {
    const ratio = opts.image.naturalWidth / opts.image.naturalHeight;
    ctx.drawImage(opts.image, (-height * ratio) / 2, -height * 0.5, height * ratio, height);
  } else {
    drawConceptBottle(ctx, w, height, time, opts);
  }

  // Light sweep across the bottle on a successful catch
  if (opts.excitement > 0.02 && !opts.reducedMotion) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const sweep = ((time / 240) % 2) - 1;
    const g = ctx.createLinearGradient(sweep * w * 2 - w, -height * 0.5, sweep * w * 2 + w * 0.4, height * 0.5);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, `rgba(255,255,255,${0.35 * opts.excitement})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-w, -height * 0.5, w * 2, height);
    ctx.restore();
  }

  ctx.restore();
}

function drawConceptBottle(
  ctx: CanvasRenderingContext2D,
  w: number,
  height: number,
  time: number,
  opts: ProductHeroOptions,
) {
  const top = -height * 0.5;
  const bottom = height * 0.48;
  const bodyTop = top + height * 0.2;

  // Glass body
  ctx.beginPath();
  ctx.moveTo(-w * 0.18, top);
  ctx.lineTo(w * 0.18, top);
  ctx.lineTo(w * 0.2, top + height * 0.07);
  ctx.quadraticCurveTo(w * 0.5, bodyTop, w * 0.5, bodyTop + height * 0.08);
  ctx.lineTo(w * 0.5, bottom - height * 0.04);
  ctx.quadraticCurveTo(w * 0.5, bottom, w * 0.36, bottom);
  ctx.lineTo(-w * 0.36, bottom);
  ctx.quadraticCurveTo(-w * 0.5, bottom, -w * 0.5, bottom - height * 0.04);
  ctx.lineTo(-w * 0.5, bodyTop + height * 0.08);
  ctx.quadraticCurveTo(-w * 0.5, bodyTop, -w * 0.2, top + height * 0.07);
  ctx.closePath();

  const tea = ctx.createLinearGradient(-w * 0.5, 0, w * 0.5, 0);
  tea.addColorStop(0, '#1f5f2c');
  tea.addColorStop(0.35, '#4d9c3c');
  tea.addColorStop(0.6, '#8dc63f');
  tea.addColorStop(1, '#265f2a');
  ctx.fillStyle = tea;
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(1, w * 0.03);
  ctx.stroke();

  // Cap
  ctx.fillStyle = '#f4f6f8';
  ctx.fillRect(-w * 0.2, top - height * 0.05, w * 0.4, height * 0.06);

  // Neutral concept label band — no imitated packaging design
  const labelTop = -height * 0.08;
  const labelH = height * 0.3;
  ctx.fillStyle = 'rgba(249,248,243,0.94)';
  ctx.fillRect(-w * 0.5, labelTop, w, labelH);
  ctx.fillStyle = '#1b6b37';
  ctx.font = `700 ${labelH * 0.22}px Outfit, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(opts.label, 0, labelTop + labelH * 0.38, w * 0.9);
  ctx.fillStyle = '#8dc63f';
  ctx.fillRect(-w * 0.36, labelTop + labelH * 0.62, w * 0.72, labelH * 0.06);

  // Specular highlight
  const spec = ctx.createLinearGradient(-w * 0.36, 0, -w * 0.12, 0);
  spec.addColorStop(0, 'rgba(255,255,255,0)');
  spec.addColorStop(0.6, 'rgba(255,255,255,0.34)');
  spec.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = spec;
  ctx.fillRect(-w * 0.36, bodyTop, w * 0.24, bottom - bodyTop);

  // Condensation droplets (deterministic, so they do not crawl every frame)
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 26; i++) {
    const dx = (pseudo(i * 3.1) - 0.5) * w * 0.86;
    const dy = bodyTop + pseudo(i * 7.7) * (bottom - bodyTop) * 0.95;
    const rr = 1 + pseudo(i * 11.3) * (w * 0.035);
    const drift = opts.reducedMotion ? 0 : Math.sin(time / 1600 + i) * 1.2;
    ctx.beginPath();
    ctx.arc(dx, dy + drift, rr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function pseudo(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}
