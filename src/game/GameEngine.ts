import { PitchData, TrajectoryType, TrackingFrame, PitchTrajectoryPoint } from '../types/game';
import { TrajectoryGenerator } from './TrajectoryGenerator';
import { CatchDetector } from './CatchDetector';
import { PitcherRenderer } from './PitcherRenderer';
import { StadiumRenderer } from './StadiumRenderer';
import { ProductHeroRenderer } from './ProductHeroRenderer';
import { ParticleSystem } from './ParticleSystem';
import { soundService } from '../audio/SoundService';
import { gameStateMachine } from '../state/gameStateMachine';
import { analyticsService } from '../analytics/AnalyticsService';
import { DEFAULT_CAMPAIGN_CONFIG, DIFFICULTY_PRESETS } from '../config/campaign.config';

export class GameEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animFrameId: number = 0;
  private lastTime: number = 0;

  // Sub-renderers
  public stadiumRenderer: StadiumRenderer = new StadiumRenderer();
  public pitcherRenderer: PitcherRenderer = new PitcherRenderer();
  public productHeroRenderer: ProductHeroRenderer = new ProductHeroRenderer();
  public particleSystem: ParticleSystem = new ParticleSystem();

  // Pitch Loop State
  private pitches: PitchData[] = [];
  private currentPitchIndex: number = 0;
  private totalPitches: number = 5;
  private requiredCatches: number = 3;
  private pitchIntervalMs: number = 3200;
  private pitchTravelDurationMs: number = 2200;
  private palmCatchRadiusPx: number = 140;

  // Active pitch animation variables
  private pitchStartTime: number = 0;
  private isBallInFlight: boolean = false;
  private isAnticipation: boolean = false;
  private currentBallPoint: PitchTrajectoryPoint | null = null;
  private activePitchType: TrajectoryType = 'fastball_center';
  private freezeUntil: number = 0;
  private bannerText: string = '';
  private bannerAlpha: number = 0;
  private bannerColor: string = '#ffffff';

  // Ball spin animation
  private ballRotation: number = 0;

  constructor() {
    this.totalPitches = DEFAULT_CAMPAIGN_CONFIG.totalPitches;
    this.requiredCatches = DEFAULT_CAMPAIGN_CONFIG.requiredCatches;
    this.pitchIntervalMs = DEFAULT_CAMPAIGN_CONFIG.pitchIntervalMs;
    this.pitchTravelDurationMs = DEFAULT_CAMPAIGN_CONFIG.pitchTravelDurationMs;
    this.palmCatchRadiusPx = DEFAULT_CAMPAIGN_CONFIG.palmCatchRadiusPx;
  }

  public setCanvas(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.handleResize();
  }

  public handleResize() {
    if (!this.canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
    }
  }

  public startPitchSequence() {
    this.currentPitchIndex = 0;
    this.particleSystem.clear();

    const difficulty = gameStateMachine.getState().difficulty;
    const preset = DIFFICULTY_PRESETS[difficulty];
    this.pitchTravelDurationMs = preset.pitchTravelDurationMs;
    this.palmCatchRadiusPx = preset.palmCatchRadiusPx;

    // Generate 5 varied pitches
    const trajectories: TrajectoryType[] = [
      'fastball_center',
      'high_left',
      'curve_right',
      'low_left',
      'curve_left'
    ];

    this.pitches = trajectories.slice(0, this.totalPitches).map((type, i) => ({
      id: i + 1,
      type,
      startTime: 0,
      durationMs: this.pitchTravelDurationMs,
      targetX: TrajectoryGenerator.getTargetForType(type).x,
      targetY: TrajectoryGenerator.getTargetForType(type).y,
      resolved: false,
      result: null
    }));

    this.scheduleNextPitch();
  }

  private scheduleNextPitch() {
    if (this.currentPitchIndex >= this.totalPitches) {
      // Game loop complete!
      const won = gameStateMachine.isGameWon();
      if (won) {
        this.pitcherRenderer.setPhase('celebrate');
        this.particleSystem.emitWinConfetti(window.innerWidth, window.innerHeight);
        soundService.playWin();
        analyticsService.logEvent('game_won', {
          catchCount: gameStateMachine.getState().catchesCount,
          sessionId: gameStateMachine.getState().sessionId
        });
      } else {
        this.pitcherRenderer.setPhase('miss_reaction');
        analyticsService.logEvent('game_lost', {
          catchCount: gameStateMachine.getState().catchesCount,
          sessionId: gameStateMachine.getState().sessionId
        });
      }

      setTimeout(() => {
        gameStateMachine.transitionTo('GAME_RESULT');
      }, 1400);
      return;
    }

    const currentPitch = this.pitches[this.currentPitchIndex];
    this.activePitchType = currentPitch.type;
    gameStateMachine.advancePitch(this.currentPitchIndex + 1);

    // 1. Anticipation Phase (Pitcher windup)
    this.isAnticipation = true;
    this.isBallInFlight = false;
    this.pitcherRenderer.setPhase('windup', 0);

    const windupDuration = 1000;
    const startTime = performance.now();

    const checkWindup = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1.0, elapsed / windupDuration);
      this.pitcherRenderer.setPhase('windup', progress);

      if (progress >= 1.0) {
        // 2. Release Ball!
        this.pitcherRenderer.setPhase('release', 0);
        soundService.playPitchRelease();
        analyticsService.logEvent('pitch_released', {
          pitchNumber: this.currentPitchIndex + 1,
          sessionId: gameStateMachine.getState().sessionId
        });

        this.isAnticipation = false;
        this.isBallInFlight = true;
        this.pitchStartTime = performance.now();
        currentPitch.startTime = this.pitchStartTime;
      } else {
        setTimeout(checkWindup, 30);
      }
    };

    setTimeout(checkWindup, 30);
  }

  public updateAndRender(time: number, trackingFrame: TrackingFrame) {
    if (!this.canvas || !this.ctx) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dt = Math.min(0.05, Math.max(0.001, (time - this.lastTime) / 1000));
    this.lastTime = time;

    // Clear canvas
    this.ctx.clearRect(0, 0, width, height);

    // 1. Render Stadium Environment
    this.stadiumRenderer.render(this.ctx, width, height, time);

    // 2. Render Pitcher on Mound
    this.pitcherRenderer.render(this.ctx, width, height, time);

    // 3. Update Product Hero (Tea Bottle) on Pedestal
    this.productHeroRenderer.update(dt);
    this.productHeroRenderer.render(
      this.ctx,
      width * 0.88,
      height * 0.42,
      Math.min(width, height) * 0.0016,
      time
    );

    // 4. Update and Render Active Pitch in Flight
    if (this.isBallInFlight && time > this.freezeUntil) {
      const elapsed = time - this.pitchStartTime;
      const t = Math.min(1.0, elapsed / this.pitchTravelDurationMs);
      const currentPitch = this.pitches[this.currentPitchIndex];

      const ballPoint = TrajectoryGenerator.calculatePoint(this.activePitchType, t);
      this.currentBallPoint = ballPoint;
      this.ballRotation += dt * 18; // Spin baseball

      // Collision Check with Player's Hand
      if (!currentPitch.resolved) {
        const catchCheck = CatchDetector.checkCollision(
          ballPoint,
          width,
          height,
          trackingFrame,
          this.palmCatchRadiusPx
        );

        if (catchCheck.isCatch) {
          // SUCCESSFUL CATCH!
          currentPitch.resolved = true;
          currentPitch.result = 'caught';
          gameStateMachine.recordCatch();
          soundService.playCatch();
          this.productHeroRenderer.triggerCatchSweep();

          const screenX = ballPoint.x * width;
          const screenY = ballPoint.y * height;
          this.particleSystem.emitCatchBurst(screenX, screenY);

          this.bannerText = 'NICE CATCH!!';
          this.bannerColor = '#4ade80';
          this.bannerAlpha = 1.0;

          this.freezeUntil = time + 180; // 180ms satisfying impact freeze
          this.pitcherRenderer.setPhase('follow_through');

          analyticsService.logEvent('pitch_caught', {
            pitchNumber: this.currentPitchIndex + 1,
            sessionId: gameStateMachine.getState().sessionId
          });

          setTimeout(() => {
            this.isBallInFlight = false;
            this.currentPitchIndex += 1;
            setTimeout(() => this.scheduleNextPitch(), 1000);
          }, 400);
        } else if (t >= 1.0) {
          // MISSED PITCH
          currentPitch.resolved = true;
          currentPitch.result = 'missed';
          gameStateMachine.recordMiss();
          soundService.playMiss();

          this.bannerText = 'MISS!';
          this.bannerColor = '#f87171';
          this.bannerAlpha = 1.0;

          analyticsService.logEvent('pitch_missed', {
            pitchNumber: this.currentPitchIndex + 1,
            sessionId: gameStateMachine.getState().sessionId
          });

          setTimeout(() => {
            this.isBallInFlight = false;
            this.currentPitchIndex += 1;
            setTimeout(() => this.scheduleNextPitch(), 1000);
          }, 400);
        }
      }

      // Render Baseball and Shadow
      this.renderBaseball(this.ctx, width, height, ballPoint);
    }

    // 5. Render Particles (Catch sparks, confetti)
    this.particleSystem.update(dt);
    this.particleSystem.render(this.ctx);

    // 6. Render On-Screen Result Banner ("NICE CATCH!!" / "MISS!")
    if (this.bannerAlpha > 0) {
      this.bannerAlpha -= dt * 1.8;
      this.renderResultBanner(this.ctx, width, height);
    }
  }

  private renderBaseball(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    point: PitchTrajectoryPoint
  ) {
    const ballX = point.x * width;
    const ballY = point.y * height;
    const shadowX = point.shadowX * width;
    const shadowY = point.shadowY * height;

    const baseRadius = 14;
    const radius = (baseRadius + (1.0 - point.z) * 65) * point.scale;

    // 1. Render Drop Shadow on Stadium Grass
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(shadowX, shadowY, radius * 1.1, radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(5, 20, 10, ${point.shadowAlpha})`;
    ctx.fill();
    ctx.restore();

    // 2. Render 2.5D Baseball Sphere with Lighting & Seams
    ctx.save();
    ctx.translate(ballX, ballY);
    ctx.rotate(this.ballRotation);

    // Spherical Radial Gradient
    const ballGrad = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, radius * 0.1, 0, 0, radius);
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(0.7, '#f1f5f9');
    ballGrad.addColorStop(1, '#94a3b8');

    ctx.beginPath();
    ctx.arc(0, 0, Math.max(4, radius), 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = Math.max(1, radius * 0.05);
    ctx.stroke();

    // Baseball Red Seams / Stitches
    if (radius > 12) {
      ctx.beginPath();
      ctx.arc(-radius * 0.3, 0, radius * 0.65, -Math.PI * 0.4, Math.PI * 0.4, false);
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = Math.max(1.5, radius * 0.08);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(radius * 0.3, 0, radius * 0.65, Math.PI * 0.6, Math.PI * 1.4, false);
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = Math.max(1.5, radius * 0.08);
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderResultBanner(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, this.bannerAlpha));
    ctx.font = '900 64px Outfit, Zen Kaku Gothic New, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.bannerColor;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 24;
    ctx.fillText(this.bannerText, width * 0.5, height * 0.28);
    ctx.restore();
  }

  public destroy() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
  }
}

export const gameEngine = new GameEngine();
