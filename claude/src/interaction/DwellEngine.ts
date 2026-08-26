import type { CursorSample, DwellStatus } from '../types';

export interface DwellTargetHandle {
  id: string;
  element: HTMLElement;
  onSelect: () => void;
  /** Optional per-target dwell time override (ms). */
  durationMs?: number;
  disabled?: boolean;
}

export interface DwellOptions {
  durationMs: number;
  /** Palm speed (px/s) above which progress pauses. */
  velocityPauseAt: number;
  /** Cooldown after a successful selection. */
  cooldownMs: number;
  /** Extra forgiving padding around each target rect, in px. */
  padding: number;
}

/**
 * Dwell-to-click: hold the cursor over a control for N seconds to activate it.
 *
 * Deliberately no pinch gesture — pinches are unreliable at signage distance and
 * invisible to passers-by. Dwell is self-explanatory: the ring fills, you commit.
 *
 * Progress is written straight to the DOM (`--dwell` custom property) instead of
 * React state, so a filling ring costs zero re-renders.
 */
export class DwellEngine {
  private targets = new Map<string, DwellTargetHandle>();
  private activeId: string | null = null;
  private progress = 0;
  private paused = false;
  private cooldownUntil = 0;
  private listeners = new Set<(status: DwellStatus) => void>();
  private enabled = true;
  private lastEmittedId: string | null = null;

  constructor(private options: DwellOptions) {}

  setOptions(options: Partial<DwellOptions>) {
    this.options = { ...this.options, ...options };
  }

  /** Dwell clicking is locked during an active pitch sequence. */
  setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) this.clear();
  }

  isEnabled() {
    return this.enabled;
  }

  register(handle: DwellTargetHandle): () => void {
    this.targets.set(handle.id, handle);
    return () => {
      this.targets.delete(handle.id);
      if (this.activeId === handle.id) this.clear();
    };
  }

  update(handle: DwellTargetHandle) {
    if (this.targets.has(handle.id)) this.targets.set(handle.id, handle);
  }

  subscribe(cb: (status: DwellStatus) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  getStatus(): DwellStatus {
    return { targetId: this.activeId, progress: this.progress, paused: this.paused };
  }

  /** Immediate activation used by mouse click, Enter and touch. */
  activateAt(x: number, y: number): boolean {
    const target = this.hitTest(x, y);
    if (!target) return false;
    this.fire(target);
    return true;
  }

  tick(cursor: CursorSample, dt: number, now: number) {
    if (!this.enabled || !cursor.present || now < this.cooldownUntil) {
      if (this.activeId) this.clear();
      return;
    }

    const target = this.hitTest(cursor.x, cursor.y);

    if (!target) {
      if (this.activeId) this.clear();
      return;
    }

    if (target.id !== this.activeId) {
      this.setActive(target);
    }

    // Moving fast? The player is travelling, not choosing.
    this.paused = cursor.speed > this.options.velocityPauseAt;
    if (this.paused) {
      // Bleed progress back rather than snapping to zero — feels less punishing.
      this.progress = Math.max(0, this.progress - dt * 1.2);
      this.writeProgress(target.element, this.progress);
      return;
    }

    const duration = (target.durationMs ?? this.options.durationMs) / 1000;
    this.progress = Math.min(1, this.progress + dt / duration);
    this.writeProgress(target.element, this.progress);

    if (this.progress >= 1) {
      this.fire(target);
    }
  }

  private fire(target: DwellTargetHandle) {
    if (target.disabled) return;
    this.cooldownUntil = performance.now() + this.options.cooldownMs;
    this.clear();
    target.onSelect();
  }

  private hitTest(x: number, y: number): DwellTargetHandle | null {
    let best: DwellTargetHandle | null = null;
    let bestArea = Infinity;
    const pad = this.options.padding;

    for (const target of this.targets.values()) {
      if (target.disabled || !target.element.isConnected) continue;
      const r = target.element.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) {
        const area = r.width * r.height;
        // Smallest hit wins, so a button nested in a panel still works.
        if (area < bestArea) {
          bestArea = area;
          best = target;
        }
      }
    }
    return best;
  }

  private setActive(target: DwellTargetHandle) {
    if (this.activeId) {
      const previous = this.targets.get(this.activeId);
      if (previous) this.resetElement(previous.element);
    }
    this.activeId = target.id;
    this.progress = 0;
    target.element.setAttribute('data-dwell-active', 'true');
    this.emit();
  }

  private clear() {
    if (this.activeId) {
      const target = this.targets.get(this.activeId);
      if (target) this.resetElement(target.element);
    }
    this.activeId = null;
    this.progress = 0;
    this.paused = false;
    this.emit();
  }

  private resetElement(el: HTMLElement) {
    el.removeAttribute('data-dwell-active');
    el.style.setProperty('--dwell', '0');
  }

  private writeProgress(el: HTMLElement, progress: number) {
    el.style.setProperty('--dwell', progress.toFixed(3));
  }

  private emit() {
    if (this.lastEmittedId === this.activeId) return;
    this.lastEmittedId = this.activeId;
    const status = this.getStatus();
    this.listeners.forEach((l) => l(status));
  }

  dispose() {
    this.clear();
    this.targets.clear();
    this.listeners.clear();
  }
}

export const dwellEngine = new DwellEngine({
  durationMs: 2000,
  velocityPauseAt: 320,
  cooldownMs: 800,
  padding: 8,
});
