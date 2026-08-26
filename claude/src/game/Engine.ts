import { sound } from '../audio/Sound';
import type { CampaignConfig } from '../config/campaign.config';
import { DIFFICULTY_PRESETS } from '../config/campaign.config';
import type { CursorSample, PitchOutcome } from '../types';
import { pointerSource } from '../vision/PointerSource';
import { evaluateCatch, resolveCatchRadius, type CatchEvaluation } from './CatchDetector';
import { BallRenderer } from './render/Ball';
import { drawGlove } from './render/Glove';
import { ParticleSystem } from './render/Particles';
import { PitcherRig } from './render/Pitcher';
import { drawProductHero } from './render/ProductHero';
import { StadiumRenderer } from './render/Stadium';
import {
  buildSequence,
  createView,
  DIFFICULTY_POOLS,
  getSpec,
  pitchPoint,
  type PitchType,
  type View,
} from './Trajectory';

export type EngineMode = 'idle' | 'attract' | 'ready' | 'playing' | 'result';

type Phase = 'countdown' | 'windup' | 'flight' | 'freeze' | 'verdict' | 'gap' | 'done';

export interface EngineCallbacks {
  onCountdown?: (value: number | null) => void;
  onPitchReleased?: (index: number, type: PitchType) => void;
  onPitchResolved?: (outcome: PitchOutcome, meta: { index: number; type: PitchType; distance: number }) => void;
  onSequenceComplete?: () => void;
}

export interface EngineDebugInfo {
  phase: Phase;
  mode: EngineMode;
  pitchIndex: number;
  pitchType: PitchType | null;
  flightProgress: number;
  ball: { x: number; y: number; radius: number } | null;
  catchRadius: number;
  lastEvaluation: CatchEvaluation | null;
  particles: number;
}

const COUNTDOWN_SECONDS = 3;
const WINDUP_SECONDS = 0.85;
const FREEZE_SECONDS = 0.15;
const VERDICT_SECONDS = 0.9;

/**
 * The gameplay engine.
 *
 * Everything is driven by the shared ticker's delta time — there is not a single
 * `setTimeout` or `setInterval` in the pitch sequence. That is deliberate: timer
 * based sequencing is exactly what makes kiosk games get stuck on "3" when a tab
 * is backgrounded or a component re-mounts. Here, aborting a game is one flag.
 */
export class GameEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private view: View = createView(1920, 1080);
  private dpr = 1;

  private stadium = new StadiumRenderer();
  private pitcher = new PitcherRig();
  private ball = new BallRenderer();
  private particles = new ParticleSystem();

  private config: CampaignConfig | null = null;
  private callbacks: EngineCallbacks = {};

  private mode: EngineMode = 'idle';
  private phase: Phase = 'done';
  private phaseTime = 0;
  private runId = -1;

  private sequence: PitchType[] = [];
  private pitchIndex = -1;
  private flightProgress = 0;
  private resolvedThisPitch = false;
  private lastOutcome: PitchOutcome | null = null;
  private lastEvaluation: CatchEvaluation | null = null;
  private lastCountdownValue: number | null = null;

  private spin = 0;
  private excitement = 0;
  private gloveImpact = 0;
  private catchPoint = { x: 0, y: 0 };
  private bannerText = '';
  private bannerTime = 0;
  private productImage: HTMLImageElement | null = null;
  private backgroundImage: HTMLImageElement | null = null;
  private lastBallVisual: { x: number; y: number; radius: number } | null = null;

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.resize();
  }

  detach() {
    this.canvas = null;
    this.ctx = null;
    this.particles.clear();
    this.ball.reset();
  }

  setCallbacks(callbacks: EngineCallbacks) {
    this.callbacks = callbacks;
  }

  applyConfig(config: CampaignConfig) {
    this.config = config;
  }

  setProductImage(img: HTMLImageElement | null) {
    this.productImage = img;
  }

  setBackgroundImage(img: HTMLImageElement | null) {
    this.backgroundImage = img;
  }

  setPitcherVideo(video: HTMLVideoElement | null) {
    this.pitcher.attachVideo(video);
  }

  setMode(mode: EngineMode) {
    this.mode = mode;
    if (mode === 'attract' || mode === 'idle') {
      this.pitcher.setPhase('idle');
      this.phase = 'done';
    }
    if (mode === 'ready') this.pitcher.setPhase('set');
  }

  getMode(): EngineMode {
    return this.mode;
  }

  resize() {
    if (!this.canvas || !this.ctx) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    // Cap DPR: a 4K signage panel at DPR 2 would quadruple fill cost for no gain.
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(width * this.dpr);
    this.canvas.height = Math.floor(height * this.dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.view = createView(width, height);
  }

  /** Starts a fresh pitch sequence. Re-entrant calls with the same run are ignored. */
  startSequence(runId: number) {
    if (this.runId === runId && this.mode === 'playing') return;
    const config = this.config;
    if (!config) return;

    this.runId = runId;
    this.mode = 'playing';
    this.phase = 'countdown';
    this.phaseTime = 0;
    this.pitchIndex = -1;
    this.flightProgress = 0;
    this.resolvedThisPitch = false;
    this.lastOutcome = null;
    this.lastCountdownValue = null;
    this.bannerText = '';
    this.excitement = 0;
    this.particles.clear();
    this.ball.reset();

    const pool = DIFFICULTY_POOLS[config.difficulty] ?? DIFFICULTY_POOLS.normal;
    this.sequence = buildSequence(config.totalPitches, pool);
    this.pitcher.setPhase('set');
  }

  /** Cancels the current game immediately (reset, inactivity, camera loss). */
  abort() {
    this.phase = 'done';
    this.mode = 'attract';
    this.runId = -1;
    this.pitchIndex = -1;
    this.bannerText = '';
    this.particles.clear();
    this.ball.reset();
    this.pitcher.setPhase('idle');
    this.callbacks.onCountdown?.(null);
  }

  celebrate(won: boolean) {
    this.mode = 'result';
    this.pitcher.setPhase(won ? 'celebrate' : 'react_positive');
    this.excitement = won ? 1 : 0.35;
    if (won && !this.config?.reducedMotion) {
      this.particles.confetti(this.view.width, 160, ['#e63946', '#f8f9fa', '#2ea44f', '#f6c453', '#48bfe3']);
    }
  }

  getDebugInfo(): EngineDebugInfo {
    return {
      phase: this.phase,
      mode: this.mode,
      pitchIndex: this.pitchIndex,
      pitchType: this.sequence[this.pitchIndex] ?? null,
      flightProgress: this.flightProgress,
      ball: this.lastBallVisual,
      catchRadius: this.currentCatchRadius(pointerSource.getSample()),
      lastEvaluation: this.lastEvaluation,
      particles: this.particles.count,
    };
  }

  /** One frame: advance the sequence, then draw. Called from the shared ticker. */
  tick(dt: number, now: number) {
    if (!this.ctx || !this.config) return;
    const cursor = pointerSource.getSample();

    if (this.mode === 'playing') this.advance(dt, cursor);

    this.spin += dt * (6 + this.flightProgress * 26);
    this.excitement = Math.max(0, this.excitement - dt * 0.55);
    this.gloveImpact = Math.max(0, this.gloveImpact - dt * 3.2);
    this.bannerTime += dt;
    this.pitcher.update(dt, now);
    this.particles.update(dt);

    this.draw(now, cursor);
  }

  // ---------------------------------------------------------------- sequence

  private advance(dt: number, cursor: CursorSample) {
    const config = this.config!;
    this.phaseTime += dt;

    switch (this.phase) {
      case 'countdown': {
        const remaining = COUNTDOWN_SECONDS - this.phaseTime;
        const value = Math.ceil(remaining);
        if (value !== this.lastCountdownValue) {
          this.lastCountdownValue = value;
          if (value > 0) {
            this.callbacks.onCountdown?.(value);
            sound.play('countdown');
          }
        }
        if (this.phaseTime >= COUNTDOWN_SECONDS) {
          this.callbacks.onCountdown?.(0);
          sound.play('go');
          this.enterPhase('windup');
        }
        break;
      }

      case 'windup': {
        // Anticipation: the player needs to see the throw coming.
        const p = Math.min(1, this.phaseTime / WINDUP_SECONDS);
        this.pitcher.setPhase(p < 0.75 ? 'windup' : 'release', p);
        if (this.phaseTime >= WINDUP_SECONDS) {
          this.pitchIndex++;
          this.resolvedThisPitch = false;
          this.flightProgress = 0;
          this.ball.reset();
          this.pitcher.setPhase('release');
          sound.play('pitch');
          this.callbacks.onPitchReleased?.(this.pitchIndex, this.sequence[this.pitchIndex]);
          this.enterPhase('flight');
        }
        break;
      }

      case 'flight': {
        const travel = config.pitchTravelDurationMs / 1000;
        this.flightProgress = this.phaseTime / travel;
        if (this.phaseTime > 0.12) this.pitcher.setPhase('follow');

        if (!this.resolvedThisPitch) {
          const evaluation = this.tryCatch(cursor);
          if (evaluation.caught) {
            this.resolveOutcome('catch', evaluation.distance);
            return;
          }
        }

        if (this.flightProgress >= 1.06) {
          this.resolveOutcome('miss', this.lastEvaluation?.distance ?? Infinity);
        }
        break;
      }

      case 'freeze':
        // A held frame at the moment of contact — the "gotcha" beat.
        if (this.phaseTime >= FREEZE_SECONDS) this.enterPhase('verdict');
        break;

      case 'verdict':
        if (this.phaseTime >= VERDICT_SECONDS) {
          if (this.pitchIndex >= config.totalPitches - 1) {
            this.phase = 'done';
            this.callbacks.onSequenceComplete?.();
          } else {
            this.enterPhase('gap');
          }
        }
        break;

      case 'gap': {
        const gap = Math.max(
          0.35,
          config.pitchIntervalMs / 1000 - config.pitchTravelDurationMs / 1000 - VERDICT_SECONDS,
        );
        this.pitcher.setPhase('set');
        this.bannerText = '';
        if (this.phaseTime >= gap) this.enterPhase('windup');
        break;
      }

      case 'done':
      default:
        break;
    }
  }

  private enterPhase(phase: Phase) {
    this.phase = phase;
    this.phaseTime = 0;
  }

  private tryCatch(cursor: CursorSample): CatchEvaluation {
    const config = this.config!;
    const spec = getSpec(this.sequence[this.pitchIndex]);
    const spread = DIFFICULTY_PRESETS[config.difficulty].spread;
    const point = pitchPoint(spec, this.flightProgress, spread);
    const visual = this.ball.project(point, this.view);

    const evaluation = evaluateCatch(
      { x: visual.x, y: visual.y, radius: visual.radius, progress: this.flightProgress },
      cursor,
      {
        palmCatchRadiusPx: this.currentCatchRadius(cursor),
        confidenceThreshold: config.trackingConfidenceThreshold,
        catchWindow: config.catchWindow,
        // Mouse and touch report an open palm, so this only gates hand tracking.
        requireOpenPalm: cursor.source === 'hand',
        alreadyResolved: this.resolvedThisPitch,
      },
    );

    this.lastEvaluation = evaluation;
    if (evaluation.caught) this.catchPoint = { x: visual.x, y: visual.y };
    return evaluation;
  }

  private currentCatchRadius(cursor: CursorSample): number {
    const config = this.config;
    if (!config) return 120;
    return resolveCatchRadius(
      config.palmCatchRadiusPx,
      this.view.height,
      DIFFICULTY_PRESETS[config.difficulty].catchRadiusScale,
      cursor.source === 'hand' ? cursor.palmRadiusPx : undefined,
    );
  }

  private resolveOutcome(outcome: PitchOutcome, distance: number) {
    if (this.resolvedThisPitch) return;
    this.resolvedThisPitch = true;
    this.lastOutcome = outcome;
    this.bannerTime = 0;

    if (outcome === 'catch') {
      this.bannerText = 'CATCH!';
      this.excitement = 1;
      this.gloveImpact = 1;
      sound.play('catch');
      this.pitcher.setPhase('react_positive');
      if (!this.config?.reducedMotion) {
        this.particles.burst(this.catchPoint.x, this.catchPoint.y, 34, ['#ffffff', '#f6c453', '#8dc63f', '#c8102e']);
      }
      this.enterPhase('freeze');
    } else {
      this.bannerText = 'MISS';
      sound.play('miss');
      this.pitcher.setPhase('react_miss');
      this.enterPhase('verdict');
    }

    this.callbacks.onPitchResolved?.(outcome, {
      index: this.pitchIndex,
      type: this.sequence[this.pitchIndex],
      distance,
    });
  }

  // ------------------------------------------------------------------ render

  private draw(now: number, cursor: CursorSample) {
    const ctx = this.ctx!;
    const config = this.config!;
    const { width, height } = this.view;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    this.stadium.draw(ctx, this.view, now, {
      reducedMotion: config.reducedMotion,
      highContrast: config.highContrast,
      backgroundImage: this.backgroundImage,
      sponsorLabel: 'TEA',
      excitement: this.excitement,
    });

    this.pitcher.draw(ctx, this.view, now);

    // Sponsor pedestal, kept out of the pitch corridor.
    drawProductHero(ctx, width * 0.855, height * 0.66, height * 0.26, now, {
      excitement: this.excitement,
      reducedMotion: config.reducedMotion,
      image: this.productImage,
      label: 'GREEN TEA',
    });

    // Ball
    if (this.mode === 'playing' && (this.phase === 'flight' || this.phase === 'freeze')) {
      const spec = getSpec(this.sequence[this.pitchIndex]);
      const spread = DIFFICULTY_PRESETS[config.difficulty].spread;
      const progress = this.phase === 'freeze' ? this.flightProgress : Math.min(1.06, this.flightProgress);
      const point = pitchPoint(spec, progress, spread);
      const visual = this.ball.draw(ctx, this.view, point, this.spin, progress, {
        reducedMotion: config.reducedMotion,
        frozen: this.phase === 'freeze',
      });
      this.lastBallVisual = { x: visual.x, y: visual.y, radius: visual.radius };
    } else {
      this.lastBallVisual = null;
    }

    // Player glove / catch zone
    if (this.mode === 'playing' || this.mode === 'ready') {
      drawGlove(
        ctx,
        cursor,
        {
          impact: this.gloveImpact,
          armed: cursor.palmOpen && cursor.confidence >= config.trackingConfidenceThreshold,
          radius: this.currentCatchRadius(cursor),
        },
        now,
        config.highContrast,
      );
    }

    this.particles.draw(ctx);

    if (this.mode === 'playing') {
      this.drawCountdown(ctx);
      this.drawBanner(ctx);
    }

    if (config.enableDebugOverlay) this.drawDebug(ctx, cursor);
  }

  private drawCountdown(ctx: CanvasRenderingContext2D) {
    if (this.phase !== 'countdown') return;
    const { width, height } = this.view;
    const remaining = COUNTDOWN_SECONDS - this.phaseTime;
    const value = Math.ceil(remaining);
    if (value <= 0) return;

    // `beat` runs 0 → 1 within each counted second.
    const beat = 1 - (remaining % 1);
    const scale = 1.35 - Math.min(1, beat * 4) * 0.35;
    const alpha = Math.min(1, beat * 8) * (1 - Math.max(0, (beat - 0.88) / 0.12));

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(width / 2, height * 0.42);
    ctx.scale(scale, scale);

    const r = height * 0.17;
    const disc = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
    disc.addColorStop(0, 'rgba(6,20,44,0.86)');
    disc.addColorStop(1, 'rgba(6,20,44,0.42)');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = height * 0.006;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    // Sweeping progress ring for the current second.
    ctx.strokeStyle = '#f6c453';
    ctx.lineWidth = height * 0.012;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - beat));
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${height * 0.24}px Outfit, system-ui, sans-serif`;
    ctx.lineWidth = height * 0.016;
    ctx.strokeStyle = 'rgba(6,20,44,0.8)';
    ctx.strokeText(String(value), 0, height * 0.012);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(value), 0, height * 0.012);
    ctx.restore();
  }

  private drawBanner(ctx: CanvasRenderingContext2D) {
    if (!this.bannerText || this.bannerTime > VERDICT_SECONDS + FREEZE_SECONDS) return;
    const { width, height } = this.view;
    const t = Math.min(1, this.bannerTime / 0.28);
    const alpha = this.bannerTime > VERDICT_SECONDS ? 1 - (this.bannerTime - VERDICT_SECONDS) / 0.3 : 1;
    const caught = this.lastOutcome === 'catch';

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(width / 2, height * 0.27);
    ctx.scale(0.8 + t * 0.25, 0.8 + t * 0.25);

    ctx.font = `900 ${height * 0.1}px Outfit, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = height * 0.012;
    ctx.strokeStyle = 'rgba(6,20,44,0.7)';
    ctx.strokeText(this.bannerText, 0, 0);
    ctx.fillStyle = caught ? '#8dc63f' : '#ffffff';
    ctx.fillText(this.bannerText, 0, 0);
    ctx.restore();
  }

  private drawDebug(ctx: CanvasRenderingContext2D, cursor: CursorSample) {
    const radius = this.currentCatchRadius(cursor);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,0,128,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cursor.x, cursor.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    if (this.lastBallVisual) {
      ctx.strokeStyle = 'rgba(0,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(this.lastBallVisual.x, this.lastBallVisual.y, this.lastBallVisual.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cursor.x, cursor.y);
      ctx.lineTo(this.lastBallVisual.x, this.lastBallVisual.y);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export const gameEngine = new GameEngine();
