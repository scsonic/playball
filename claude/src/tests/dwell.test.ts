import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DwellEngine } from '../interaction/DwellEngine';
import type { CursorSample } from '../types';

/** Minimal stand-in for a DOM button — no jsdom required. */
function fakeTarget(rect: { left: number; top: number; width: number; height: number }) {
  const properties = new Map<string, string>();
  return {
    isConnected: true,
    getBoundingClientRect: () => ({
      left: rect.left,
      top: rect.top,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      width: rect.width,
      height: rect.height,
    }),
    setAttribute: vi.fn(),
    removeAttribute: vi.fn(),
    style: {
      setProperty: (key: string, value: string) => properties.set(key, value),
    },
    getDwell: () => Number(properties.get('--dwell') ?? 0),
  } as unknown as HTMLElement & { getDwell(): number };
}

const cursor = (patch: Partial<CursorSample> = {}): CursorSample => ({
  t: 0,
  present: true,
  source: 'hand',
  x: 150,
  y: 60,
  vx: 0,
  vy: 0,
  speed: 0,
  confidence: 0.9,
  palmOpen: true,
  palmRadiusPx: 100,
  handLabel: 'left',
  visibility: 1,
  ...patch,
});

describe('DwellEngine', () => {
  let engine: DwellEngine;
  let onSelect: ReturnType<typeof vi.fn>;
  let element: ReturnType<typeof fakeTarget>;

  beforeEach(() => {
    engine = new DwellEngine({ durationMs: 2000, velocityPauseAt: 320, cooldownMs: 800, padding: 8 });
    onSelect = vi.fn();
    element = fakeTarget({ left: 100, top: 20, width: 200, height: 80 });
    engine.register({ id: 'start', element, onSelect });
  });

  /** Feeds the engine `seconds` of frames at 60 FPS. */
  const hold = (seconds: number, sample = cursor()) => {
    const frames = Math.round(seconds * 60);
    for (let i = 0; i < frames; i++) {
      engine.tick({ ...sample, t: i * 16.67 }, 1 / 60, 1000 + i * 16.67);
    }
  };

  it('fires exactly once after a two-second hold', () => {
    hold(2.1);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('does not fire early', () => {
    hold(1.7);
    expect(onSelect).not.toHaveBeenCalled();
    expect(engine.getStatus().progress).toBeGreaterThan(0.7);
  });

  it('writes progress to the element for the ring animation', () => {
    hold(1.0);
    expect(element.getDwell()).toBeGreaterThan(0.4);
    expect(element.getDwell()).toBeLessThan(0.6);
  });

  it('resets progress when the cursor leaves the control', () => {
    hold(1.2);
    engine.tick(cursor({ x: 900, y: 900 }), 1 / 60, 5000);
    expect(engine.getStatus().targetId).toBeNull();
    expect(engine.getStatus().progress).toBe(0);
    hold(1.2);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('pauses while the palm is moving quickly', () => {
    hold(1.9, cursor({ speed: 800 }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(engine.getStatus().paused).toBe(true);
  });

  it('does not double-fire during the cooldown', () => {
    hold(2.1);
    hold(2.1);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('ignores a lost cursor', () => {
    hold(2.5, cursor({ present: false }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('stops selecting entirely while disabled during a pitch', () => {
    engine.setEnabled(false);
    hold(2.5);
    expect(onSelect).not.toHaveBeenCalled();
    engine.setEnabled(true);
    hold(2.1);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('supports immediate activation for mouse and keyboard', () => {
    expect(engine.activateAt(150, 60)).toBe(true);
    expect(engine.activateAt(2000, 2000)).toBe(false);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('picks the smallest control when targets overlap', () => {
    const smallSelect = vi.fn();
    engine.register({
      id: 'small',
      element: fakeTarget({ left: 140, top: 50, width: 40, height: 30 }),
      onSelect: smallSelect,
    });
    engine.activateAt(150, 60);
    expect(smallSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('drops targets on unregister', () => {
    const unregister = engine.register({ id: 'temp', element, onSelect });
    unregister();
    hold(2.1);
    expect(onSelect).toHaveBeenCalledTimes(1); // only the original registration
  });
});
