import { soundService } from '../audio/SoundService';

export interface DwellTarget {
  id: string;
  element: HTMLElement;
  callback: () => void;
}

export class DwellController {
  private targets: Map<string, DwellTarget> = new Map();
  private currentHoverId: string | null = null;
  private dwellStartTime: number = 0;
  private dwellDurationMs: number = 2000;
  private progress: number = 0; // 0..1
  private lastClickTime: number = 0;
  private cooldownMs: number = 600;
  private maxVelocityThreshold: number = 180; // px/s

  constructor(dwellDurationMs: number = 2000) {
    this.dwellDurationMs = dwellDurationMs;
  }

  public setDwellDuration(durationMs: number) {
    this.dwellDurationMs = durationMs;
  }

  public registerTarget(id: string, element: HTMLElement, callback: () => void) {
    this.targets.set(id, { id, element, callback });
  }

  public unregisterTarget(id: string) {
    this.targets.delete(id);
    if (this.currentHoverId === id) {
      this.resetProgress();
    }
  }

  public update(
    cursorX: number,
    cursorY: number,
    velocity: number,
    isGameplayMode: boolean = false
  ): {
    hoveredTargetId: string | null;
    progress: number;
    clicked: boolean;
  } {
    const now = performance.now();

    // Lock dwell clicking during active gameplay
    if (isGameplayMode) {
      this.resetProgress();
      return { hoveredTargetId: null, progress: 0, clicked: false };
    }

    // Cooldown check
    if (now - this.lastClickTime < this.cooldownMs) {
      this.resetProgress();
      return { hoveredTargetId: null, progress: 0, clicked: false };
    }

    // Find which element the cursor is currently inside
    let foundTargetId: string | null = null;
    let foundTarget: DwellTarget | null = null;

    for (const [id, target] of this.targets.entries()) {
      if (!target.element || !target.element.isConnected) continue;
      const rect = target.element.getBoundingClientRect();
      if (
        cursorX >= rect.left &&
        cursorX <= rect.right &&
        cursorY >= rect.top &&
        cursorY <= rect.bottom
      ) {
        foundTargetId = id;
        foundTarget = target;
        break;
      }
    }

    // If cursor left previous target or moved too fast
    if (foundTargetId !== this.currentHoverId || velocity > this.maxVelocityThreshold) {
      if (foundTargetId !== this.currentHoverId) {
        this.currentHoverId = foundTargetId;
        this.dwellStartTime = now;
        this.progress = 0;
      } else {
        // Paused or reset due to high hand movement
        this.dwellStartTime = now - (this.progress * this.dwellDurationMs * 0.5);
      }
    }

    if (!foundTargetId) {
      this.resetProgress();
      return { hoveredTargetId: null, progress: 0, clicked: false };
    }

    // Calculate dwell progress
    const elapsed = now - this.dwellStartTime;
    this.progress = Math.max(0, Math.min(1.0, elapsed / this.dwellDurationMs));

    soundService.playDwellProgress(this.progress);

    // Trigger click on completion
    if (this.progress >= 1.0) {
      this.lastClickTime = now;
      this.progress = 0;
      this.currentHoverId = null;

      soundService.playDwellClick();
      if (foundTarget && foundTarget.callback) {
        foundTarget.callback();
      }

      return { hoveredTargetId: foundTargetId, progress: 1.0, clicked: true };
    }

    return { hoveredTargetId: foundTargetId, progress: this.progress, clicked: false };
  }

  public getProgress(): number {
    return this.progress;
  }

  public getCurrentHoverId(): string | null {
    return this.currentHoverId;
  }

  public resetProgress() {
    this.currentHoverId = null;
    this.progress = 0;
    this.dwellStartTime = 0;
  }
}

export const dwellController = new DwellController(2000);
