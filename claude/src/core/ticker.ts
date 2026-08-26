/**
 * The single requestAnimationFrame loop for the whole experience.
 *
 * Vision inference, the dwell engine, the game engine and the cursor renderer
 * all subscribe here in a fixed priority order. One loop means one place to
 * measure FPS, one place to pause on tab-hide, and one place to clean up — which
 * is what keeps a kiosk running for hours without leaking frames or timers.
 */
export type TickFn = (dt: number, now: number) => void;

interface Subscriber {
  fn: TickFn;
  priority: number;
  id: symbol;
}

class Ticker {
  private subs: Subscriber[] = [];
  private raf = 0;
  private last = 0;
  private running = false;
  private frames = 0;
  private fpsWindowStart = 0;
  private fps = 0;

  subscribe(fn: TickFn, priority = 100): () => void {
    const id = Symbol('tick');
    this.subs.push({ fn, priority, id });
    this.subs.sort((a, b) => a.priority - b.priority);
    this.start();
    return () => {
      this.subs = this.subs.filter((s) => s.id !== id);
      if (this.subs.length === 0) this.stop();
    };
  }

  getFps(): number {
    return this.fps;
  }

  private start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.fpsWindowStart = this.last;
    this.frames = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  private stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private frame = (now: number) => {
    if (!this.running) return;
    // Clamp dt so a backgrounded tab never fast-forwards the simulation.
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;

    this.frames++;
    if (now - this.fpsWindowStart >= 500) {
      this.fps = Math.round((this.frames * 1000) / (now - this.fpsWindowStart));
      this.frames = 0;
      this.fpsWindowStart = now;
    }

    for (const sub of this.subs) {
      try {
        sub.fn(dt, now);
      } catch (err) {
        console.error('[ticker] subscriber failed', err);
      }
    }

    this.raf = requestAnimationFrame(this.frame);
  };

  /** Explicit teardown for tests / hot reload. */
  dispose() {
    this.subs = [];
    this.stop();
  }
}

export const ticker = new Ticker();

export const TickPriority = {
  Vision: 10,
  Dwell: 20,
  Game: 30,
  Cursor: 90,
} as const;
