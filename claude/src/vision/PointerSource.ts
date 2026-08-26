import type { CampaignConfig } from '../config/campaign.config';
import type { CursorSample, InputSource, TrackingDiagnostics } from '../types';
import { camera, type FrameSource } from './Camera';
import { handTracker } from './HandTracker';
import { Mapper } from './Mapper';
import { Smoother } from './Smoother';

/**
 * The one place that answers "where is the player pointing?".
 *
 * Hand tracking, mouse, touch and keyboard are all folded into a single
 * `CursorSample` stream. Everything downstream — dwell selection, the cursor
 * renderer, the catch detector, the tests — consumes that stream and never
 * branches on input mode. Adding a new input device means adding a producer
 * here and nothing else.
 */
export class PointerSource {
  readonly mapper = new Mapper(true);
  private smoother = new Smoother(0.75);

  private sample: CursorSample = {
    t: 0,
    present: false,
    source: 'none',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    speed: 0,
    confidence: 0,
    palmOpen: false,
    palmRadiusPx: 90,
    handLabel: null,
    visibility: 0,
  };

  private diagnostics: TrackingDiagnostics = {
    personDetected: false,
    upperBodyVisible: false,
    handDetected: false,
    correctHand: false,
    palmOpen: false,
    confidence: 0,
    lighting: 'fair',
    distance: 'unknown',
    inferenceMs: 0,
    landmarks: null,
    poseLandmarks: null,
  };

  private cameraEnabled = false;
  private lastHandSeenAt = -Infinity;
  private lastPointerAt = -Infinity;
  private pointer = { x: 0, y: 0, down: false };
  private pointerKind: 'mouse' | 'touch' = 'mouse';
  private touchDown = false;
  private keyVector = { x: 0, y: 0 };
  private lumaCanvas: HTMLCanvasElement | null = null;
  private lumaAccumulator = 0;
  private detached: Array<() => void> = [];
  private config: CampaignConfig | null = null;

  attachDom() {
    if (typeof window === 'undefined' || this.detached.length) return;

    const onPointerMove = (e: PointerEvent | MouseEvent) => {
      const kind = (e as PointerEvent).pointerType;
      if (kind === 'touch' || kind === 'pen') {
        this.pointerKind = 'touch';
        this.touchDown = true;
      } else if (kind === 'mouse' || kind === undefined) {
        this.pointerKind = 'mouse';
      }
      this.pointer.x = e.clientX;
      this.pointer.y = e.clientY;
      this.lastPointerAt = performance.now();
    };
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      this.pointerKind = 'touch';
      this.touchDown = true;
      this.pointer.x = t.clientX;
      this.pointer.y = t.clientY;
      this.lastPointerAt = performance.now();
    };
    const onTouchEnd = () => {
      // A lifted finger is gone. Without this the cursor stays parked where the
      // player last tapped and the dwell engine keeps "hovering" there, happily
      // auto-activating whatever the next screen puts under that spot.
      this.touchDown = false;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 3 : 1;
      if (e.key === 'ArrowLeft') this.keyVector.x = -step;
      else if (e.key === 'ArrowRight') this.keyVector.x = step;
      else if (e.key === 'ArrowUp') this.keyVector.y = -step;
      else if (e.key === 'ArrowDown') this.keyVector.y = step;
      else return;
      this.lastPointerAt = performance.now();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') this.keyVector.x = 0;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') this.keyVector.y = 0;
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('touchstart', onTouch, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    window.addEventListener('pointerup', onTouchEnd, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    this.detached = [
      () => window.removeEventListener('pointermove', onPointerMove),
      () => window.removeEventListener('touchmove', onTouch),
      () => window.removeEventListener('touchstart', onTouch),
      () => window.removeEventListener('touchend', onTouchEnd),
      () => window.removeEventListener('touchcancel', onTouchEnd),
      () => window.removeEventListener('pointerup', onTouchEnd),
      () => window.removeEventListener('keydown', onKeyDown),
      () => window.removeEventListener('keyup', onKeyUp),
    ];

    this.pointer.x = window.innerWidth / 2;
    this.pointer.y = window.innerHeight / 2;
    this.resize();
  }

  applyConfig(config: CampaignConfig) {
    this.config = config;
    this.smoother.setBase(config.cursorSmoothing);
    this.mapper.setMirrored(config.cameraMirrored);
    handTracker.setTargetHand(config.handMode);
    handTracker.setUsePose(config.enablePoseDetection);
  }

  setCameraEnabled(enabled: boolean) {
    this.cameraEnabled = enabled;
    if (!enabled) this.smoother.reset();
  }

  resize() {
    if (typeof window === 'undefined') return;
    this.mapper.setScreen(window.innerWidth, window.innerHeight);
  }

  getSample(): CursorSample {
    return this.sample;
  }

  getDiagnostics(): TrackingDiagnostics {
    return this.diagnostics;
  }

  /** Called once per animation frame, before dwell and gameplay. */
  update(dt: number, now: number): CursorSample {
    const screen = this.mapper.getScreen();

    const source = this.cameraEnabled ? camera.getSource() : null;
    if (source && camera.isLive()) {
      const { hand, pose } = handTracker.detect(source, camera.getFrameId(), now, dt);

      this.lumaAccumulator += dt;
      if (this.lumaAccumulator > 1) {
        this.lumaAccumulator = 0;
        this.diagnostics.lighting = this.sampleLighting(source);
      }

      this.diagnostics = {
        ...this.diagnostics,
        personDetected: pose.personDetected || hand.detected,
        upperBodyVisible: pose.upperBodyVisible || hand.detected,
        handDetected: hand.detected,
        correctHand: hand.correctHand,
        palmOpen: hand.palm?.isOpen ?? false,
        confidence: hand.confidence,
        distance: pose.distance,
        inferenceMs: hand.inferenceMs,
        landmarks: hand.landmarks,
        poseLandmarks: pose.landmarks,
      };

      if (hand.detected && hand.palm) {
        const target = this.mapper.toScreen(hand.palm.center.x, hand.palm.center.y);
        const reacquiring = now - this.lastHandSeenAt > 700;
        if (reacquiring) {
          // Smooth reacquire: start from where the cursor faded out.
          this.smoother.snapTo(this.sample.x || target.x, this.sample.y || target.y, now);
        }
        const s = this.smoother.update(target.x, target.y, now);
        this.lastHandSeenAt = now;

        const palmPx = this.mapper.scalarToScreenX(hand.palm.width) * 0.9;
        this.sample = {
          t: now,
          present: true,
          source: 'hand',
          x: s.x,
          y: s.y,
          vx: s.vx,
          vy: s.vy,
          speed: s.speed,
          confidence: hand.confidence,
          palmOpen: hand.palm.isOpen,
          palmRadiusPx: clamp(palmPx, screen.y * 0.05, screen.y * 0.18),
          handLabel: hand.hand,
          visibility: Math.min(1, this.sample.visibility + dt * 6),
        };
        return this.sample;
      }
    }

    // --- fallback: mouse / touch / keyboard --------------------------------
    const handRecentlySeen = now - this.lastHandSeenAt < 900;
    const keyboardActive = this.keyVector.x !== 0 || this.keyVector.y !== 0;
    const pointerRecent = isPointerAlive({
      kind: this.pointerKind,
      touchDown: this.touchDown,
      msSincePointer: now - this.lastPointerAt,
      cameraEnabled: this.cameraEnabled,
    });

    if (keyboardActive) {
      const speed = 900 * dt;
      this.pointer.x = clamp(this.pointer.x + this.keyVector.x * speed, 0, screen.x);
      this.pointer.y = clamp(this.pointer.y + this.keyVector.y * speed, 0, screen.y);
      this.lastPointerAt = now;
    }

    const usePointer = pointerRecent && (!this.cameraEnabled || !handRecentlySeen || !camera.isLive());

    if (usePointer) {
      const s = this.smoother.update(this.pointer.x, this.pointer.y, now);
      const source: InputSource = keyboardActive ? 'keyboard' : 'mouse';
      this.sample = {
        t: now,
        present: true,
        source,
        x: s.x,
        y: s.y,
        vx: s.vx,
        vy: s.vy,
        speed: s.speed,
        confidence: 1,
        palmOpen: true,
        palmRadiusPx: screen.y * 0.085,
        handLabel: this.config?.handMode ?? 'left',
        visibility: Math.min(1, this.sample.visibility + dt * 6),
      };
      return this.sample;
    }

    // Tracking lost: hold the last position and fade out rather than jump.
    this.sample = {
      ...this.sample,
      t: now,
      present: false,
      confidence: 0,
      palmOpen: false,
      speed: 0,
      vx: 0,
      vy: 0,
      visibility: Math.max(0, this.sample.visibility - dt * 1.6),
    };
    return this.sample;
  }

  /** Cheap local luminance probe used only for the calibration hint. */
  private sampleLighting(source: FrameSource): TrackingDiagnostics['lighting'] {
    try {
      if (!this.lumaCanvas) {
        this.lumaCanvas = document.createElement('canvas');
        this.lumaCanvas.width = 32;
        this.lumaCanvas.height = 18;
      }
      const ctx = this.lumaCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return 'fair';
      ctx.drawImage(source, 0, 0, 32, 18);
      const { data } = ctx.getImageData(0, 0, 32, 18);
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      }
      const mean = sum / (data.length / 4);
      return mean < 42 ? 'low' : mean < 78 ? 'fair' : 'good';
    } catch {
      return 'fair';
    }
  }

  dispose() {
    this.detached.forEach((fn) => fn());
    this.detached = [];
    this.smoother.reset();
    this.lumaCanvas = null;
  }
}

export interface PointerLiveness {
  kind: 'mouse' | 'touch';
  touchDown: boolean;
  msSincePointer: number;
  cameraEnabled: boolean;
}

/**
 * Is the non-camera pointer still "there"?
 *
 * A mouse stays where it was left, so it keeps driving the cursor — but only for a
 * few seconds while a camera is available, so a stale mouse position cannot fight
 * with hand tracking. A finger, in contrast, ceases to exist the moment it lifts.
 */
export function isPointerAlive({ kind, touchDown, msSincePointer, cameraEnabled }: PointerLiveness): boolean {
  if (kind === 'touch') return touchDown;
  if (!Number.isFinite(msSincePointer)) return false;
  return cameraEnabled ? msSincePointer < 4000 : true;
}

function clamp(v: number, min: number, max: number) {
  return v < min ? min : v > max ? max : v;
}

export const pointerSource = new PointerSource();
