import { MOUND_Z, projectGround, type View } from '../Trajectory';

export type PitcherPhase =
  | 'idle'
  | 'set'
  | 'windup'
  | 'release'
  | 'follow'
  | 'react_positive'
  | 'react_miss'
  | 'celebrate';

const BODY_HEIGHT_M = 1.92;

interface Pose {
  /** Weight shift, metres. */
  shiftX: number;
  /** Front leg lift, 0..1. */
  legLift: number;
  /** Throwing arm angle, radians (0 = down, -PI/2 = forward). */
  armAngle: number;
  /** Glove arm angle. */
  gloveAngle: number;
  /** Forward lean, radians. */
  lean: number;
  /** Vertical bob, metres. */
  bob: number;
  armExtend: number;
}

const POSES: Record<PitcherPhase, Pose> = {
  idle: { shiftX: 0, legLift: 0, armAngle: 0.35, gloveAngle: -0.2, lean: 0, bob: 0, armExtend: 0.85 },
  set: { shiftX: -0.05, legLift: 0.05, armAngle: 0.15, gloveAngle: -0.5, lean: 0.06, bob: -0.04, armExtend: 0.7 },
  windup: { shiftX: -0.18, legLift: 0.95, armAngle: 1.9, gloveAngle: -1.1, lean: -0.16, bob: 0.06, armExtend: 0.75 },
  release: { shiftX: 0.32, legLift: 0.12, armAngle: -1.45, gloveAngle: 0.9, lean: 0.42, bob: -0.1, armExtend: 1.1 },
  follow: { shiftX: 0.45, legLift: 0.0, armAngle: -2.6, gloveAngle: 1.2, lean: 0.56, bob: -0.16, armExtend: 0.9 },
  react_positive: { shiftX: 0.1, legLift: 0, armAngle: -0.9, gloveAngle: -0.9, lean: 0.08, bob: 0.02, armExtend: 0.95 },
  react_miss: { shiftX: 0.05, legLift: 0, armAngle: 0.5, gloveAngle: 0.3, lean: 0.14, bob: -0.03, armExtend: 0.8 },
  celebrate: { shiftX: 0, legLift: 0.1, armAngle: -2.9, gloveAngle: -2.7, lean: -0.1, bob: 0.12, armExtend: 1.05 },
};

export interface PitcherStyle {
  jersey: string;
  jerseyShade: string;
  pants: string;
  accent: string;
  skin: string;
}

const DEFAULT_STYLE: PitcherStyle = {
  jersey: '#f4f6fb',
  jerseyShade: '#c9d3e4',
  pants: '#e8ecf5',
  accent: '#1d3f8f',
  skin: '#d8a882',
};

/**
 * Replaceable pitcher rig.
 *
 * Ships as an **original stylised athlete** — no real player's likeness, no
 * tournament uniform, no team marks. `attachVideo()` swaps the whole rig for a
 * sponsor-supplied licensed clip (alpha WebM preferred) without touching any
 * gameplay code; the release frame stays synchronised because the engine drives
 * phases, not the artwork.
 */
export class PitcherRig {
  private phase: PitcherPhase = 'idle';
  private phaseProgress = 0;
  private current: Pose = { ...POSES.idle };
  private video: HTMLVideoElement | null = null;
  private style: PitcherStyle = DEFAULT_STYLE;

  setStyle(style: Partial<PitcherStyle>) {
    this.style = { ...this.style, ...style };
  }

  attachVideo(video: HTMLVideoElement | null) {
    this.video = video;
  }

  setPhase(phase: PitcherPhase, progress = 0) {
    this.phase = phase;
    this.phaseProgress = progress;
  }

  getPhase(): PitcherPhase {
    return this.phase;
  }

  update(dt: number, time: number) {
    const target = POSES[this.phase];
    // Release must snap; everything else eases.
    const speed = this.phase === 'release' ? 26 : this.phase === 'follow' ? 9 : 6;
    const k = Math.min(1, dt * speed);

    const idleBob = this.phase === 'idle' ? Math.sin(time / 700) * 0.02 : 0;
    const celebrateBounce = this.phase === 'celebrate' ? Math.abs(Math.sin(time / 220)) * 0.14 : 0;

    this.current = {
      shiftX: lerp(this.current.shiftX, target.shiftX, k),
      legLift: lerp(this.current.legLift, target.legLift, k),
      armAngle: lerp(this.current.armAngle, target.armAngle, k),
      gloveAngle: lerp(this.current.gloveAngle, target.gloveAngle, k),
      lean: lerp(this.current.lean, target.lean, k),
      bob: lerp(this.current.bob, target.bob + idleBob + celebrateBounce, k),
      armExtend: lerp(this.current.armExtend, target.armExtend, k),
    };
  }

  /** Screen-space position of the throwing hand, used to launch the ball. */
  getReleasePoint(view: View): { x: number; y: number } {
    const scale = view.focal / MOUND_Z;
    const base = projectGround(this.current.shiftX, MOUND_Z, view);
    const shoulderY = base.y - BODY_HEIGHT_M * 0.82 * scale;
    const armLen = BODY_HEIGHT_M * 0.34 * scale * this.current.armExtend;
    return {
      x: base.x + Math.sin(this.current.armAngle) * armLen,
      y: shoulderY - Math.cos(this.current.armAngle) * armLen,
    };
  }

  draw(ctx: CanvasRenderingContext2D, view: View, time: number) {
    const scale = view.focal / MOUND_Z;
    const base = projectGround(this.current.shiftX, MOUND_Z, view);
    const h = BODY_HEIGHT_M * scale;
    const groundY = base.y - this.current.bob * scale;

    ctx.save();
    ctx.translate(base.x, groundY);

    // Contact shadow
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(0, 0, h * 0.28, h * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();

    if (this.video && this.video.readyState >= 2) {
      const vw = h * (this.video.videoWidth / Math.max(1, this.video.videoHeight));
      ctx.drawImage(this.video, -vw / 2, -h, vw, h);
      ctx.restore();
      return;
    }

    ctx.rotate(this.current.lean * 0.35);

    const s = this.style;
    const hipY = -h * 0.5;
    const shoulderY = -h * 0.82;
    const headR = h * 0.075;

    // --- legs -------------------------------------------------------------
    ctx.strokeStyle = s.pants;
    ctx.lineCap = 'round';
    ctx.lineWidth = h * 0.085;

    // Back (drive) leg
    ctx.beginPath();
    ctx.moveTo(0, hipY);
    ctx.quadraticCurveTo(-h * 0.09, hipY + h * 0.24, -h * 0.14 - this.current.lean * h * 0.2, 0);
    ctx.stroke();

    // Front leg lifts during the windup and strides on release.
    const lift = this.current.legLift;
    const strideX = h * (0.1 + this.current.lean * 0.55);
    ctx.beginPath();
    ctx.moveTo(0, hipY);
    ctx.quadraticCurveTo(
      strideX * 0.5,
      hipY + h * 0.2 - lift * h * 0.28,
      strideX,
      -lift * h * 0.38,
    );
    ctx.stroke();

    // --- torso ------------------------------------------------------------
    ctx.lineWidth = h * 0.145;
    ctx.strokeStyle = s.jersey;
    ctx.beginPath();
    ctx.moveTo(0, hipY);
    ctx.lineTo(this.current.lean * h * 0.1, shoulderY);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = h * 0.05;
    ctx.beginPath();
    ctx.moveTo(-h * 0.04, hipY);
    ctx.lineTo(-h * 0.03, shoulderY);
    ctx.stroke();

    // Belt
    ctx.strokeStyle = s.accent;
    ctx.lineWidth = h * 0.03;
    ctx.beginPath();
    ctx.moveTo(-h * 0.06, hipY - h * 0.01);
    ctx.lineTo(h * 0.06, hipY - h * 0.01);
    ctx.stroke();

    // --- arms -------------------------------------------------------------
    const armLen = h * 0.34 * this.current.armExtend;
    const shoulderX = this.current.lean * h * 0.1;

    // Glove arm
    ctx.strokeStyle = s.jersey;
    ctx.lineWidth = h * 0.06;
    const gx = shoulderX + Math.sin(this.current.gloveAngle) * armLen;
    const gy = shoulderY - Math.cos(this.current.gloveAngle) * armLen;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(gx, gy);
    ctx.stroke();
    ctx.fillStyle = '#6b3d20';
    ctx.beginPath();
    ctx.arc(gx, gy, h * 0.055, 0, Math.PI * 2);
    ctx.fill();

    // Throwing arm
    ctx.strokeStyle = s.jerseyShade;
    ctx.lineWidth = h * 0.058;
    const ax = shoulderX + Math.sin(this.current.armAngle) * armLen;
    const ay = shoulderY - Math.cos(this.current.armAngle) * armLen;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.quadraticCurveTo(shoulderX + Math.sin(this.current.armAngle) * armLen * 0.55, shoulderY - armLen * 0.3, ax, ay);
    ctx.stroke();
    ctx.fillStyle = s.skin;
    ctx.beginPath();
    ctx.arc(ax, ay, h * 0.032, 0, Math.PI * 2);
    ctx.fill();

    // --- head -------------------------------------------------------------
    const headY = shoulderY - headR * 1.35;
    ctx.fillStyle = s.skin;
    ctx.beginPath();
    ctx.arc(shoulderX, headY, headR, 0, Math.PI * 2);
    ctx.fill();

    // Cap (generic colourway, no team marks)
    ctx.fillStyle = s.accent;
    ctx.beginPath();
    ctx.arc(shoulderX, headY, headR * 1.04, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(shoulderX + headR * 0.7, headY - headR * 0.05, headR * 0.95, headR * 0.26, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    // Celebration motion lines
    if (this.phase === 'celebrate') {
      ctx.strokeStyle = `rgba(255,236,150,${0.4 + Math.sin(time / 160) * 0.2})`;
      ctx.lineWidth = h * 0.02;
      for (let i = 0; i < 3; i++) {
        const r = h * (0.5 + i * 0.14);
        ctx.beginPath();
        ctx.arc(shoulderX, shoulderY, r, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
