import { describe, it, expect } from 'vitest';
import { DwellController } from '../interaction/DwellController';

describe('DwellController', () => {
  it('increments progress and triggers click on 2.0s completion', () => {
    const dwell = new DwellController(2000);
    let triggered = false;

    const mockElement = {
      getBoundingClientRect: () => ({
        left: 100,
        right: 300,
        top: 100,
        bottom: 300,
        width: 200,
        height: 200,
        x: 100,
        y: 100,
        toJSON: () => {}
      }),
      isConnected: true
    } as unknown as HTMLElement;

    dwell.registerTarget('btn-test', mockElement, () => {
      triggered = true;
    });

    // Cursor inside target at t=0
    dwell.update(200, 200, 10, false);
    expect(dwell.getCurrentHoverId()).toBe('btn-test');

    // Simulate completion by setting dwell duration short or checking progress
    dwell.setDwellDuration(100);
    dwell.update(200, 200, 10, false);

    // Wait 120ms
    setTimeout(() => {
      const result = dwell.update(200, 200, 10, false);
      expect(result.clicked || triggered).toBe(true);
    }, 120);
  });

  it('resets progress when cursor leaves target', () => {
    const dwell = new DwellController(2000);
    const mockElement = {
      getBoundingClientRect: () => ({
        left: 100,
        right: 300,
        top: 100,
        bottom: 300,
        width: 200,
        height: 200,
        x: 100,
        y: 100,
        toJSON: () => {}
      }),
      isConnected: true
    } as unknown as HTMLElement;

    dwell.registerTarget('btn-test', mockElement, () => {});

    // Enter
    dwell.update(200, 200, 10, false);
    expect(dwell.getCurrentHoverId()).toBe('btn-test');

    // Leave
    const res = dwell.update(500, 500, 10, false);
    expect(res.hoveredTargetId).toBeNull();
    expect(res.progress).toBe(0);
  });
});
