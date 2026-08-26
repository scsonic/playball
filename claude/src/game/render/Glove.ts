import type { CursorSample } from '../../types';

export interface GloveState {
  /** 0..1 impact animation. */
  impact: number;
  /** True when the palm is open and the catch zone is armed. */
  armed: boolean;
  radius: number;
}

/**
 * The player's catch zone, drawn as a catcher's mitt.
 *
 * The visible mitt is the *actual* hitbox (radius comes straight from the catch
 * detector), so the game never feels like it lied about a near miss.
 */
export function drawGlove(
  ctx: CanvasRenderingContext2D,
  cursor: CursorSample,
  state: GloveState,
  time: number,
  highContrast = false,
) {
  if (cursor.visibility <= 0.02) return;

  const r = state.radius * (1 - state.impact * 0.12);
  ctx.save();
  ctx.globalAlpha = cursor.visibility;
  ctx.translate(cursor.x, cursor.y);

  // Catch-zone halo: green when armed, amber when the hand is closed.
  const armedColor = highContrast ? '255,230,0' : '125,219,98';
  const idleColor = '245,182,66';
  const color = state.armed ? armedColor : idleColor;
  const pulse = 1 + Math.sin(time / 260) * 0.03;

  const halo = ctx.createRadialGradient(0, 0, r * 0.35, 0, 0, r * 1.15 * pulse);
  halo.addColorStop(0, `rgba(${color},0.05)`);
  halo.addColorStop(0.72, `rgba(${color},0.16)`);
  halo.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.15 * pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(${color},${state.armed ? 0.9 : 0.55})`;
  ctx.lineWidth = Math.max(2, r * 0.04);
  ctx.setLineDash(state.armed ? [] : [r * 0.16, r * 0.12]);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // --- mitt -------------------------------------------------------------
  const mr = r * 0.78;
  ctx.rotate(-0.18);

  const leather = ctx.createRadialGradient(-mr * 0.3, -mr * 0.35, mr * 0.15, 0, 0, mr * 1.1);
  leather.addColorStop(0, '#a4682f');
  leather.addColorStop(0.6, '#7d4a1f');
  leather.addColorStop(1, '#4e2c12');
  ctx.fillStyle = leather;

  ctx.beginPath();
  ctx.ellipse(0, 0, mr, mr * 1.06, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pocket
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, mr * 0.12, mr * 0.62, mr * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  // Thumb + web lacing
  ctx.strokeStyle = '#e8d5a8';
  ctx.lineWidth = Math.max(1.5, mr * 0.07);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, mr * 0.82, Math.PI * 1.12, Math.PI * 1.88);
  ctx.stroke();

  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * mr * 0.22, -mr * 0.82);
    ctx.lineTo(i * mr * 0.16, -mr * 0.34);
    ctx.stroke();
  }

  // Impact flash
  if (state.impact > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,255,220,${state.impact * 0.55})`;
    ctx.beginPath();
    ctx.arc(0, 0, mr * (1 + (1 - state.impact) * 0.8), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
