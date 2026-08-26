import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The host camera contract is what a native shell (see `android/`) programs
 * against, so it is tested as a contract: names, call order and failure modes.
 *
 * `ExternalCamera` needs a DOM canvas, so the pieces that touch one are exercised
 * through a minimal stub rather than pulling in a full jsdom environment.
 */
describe('host camera API surface', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('publishes window.CatchChallenge.camera with the documented methods', async () => {
    const globalAny = globalThis as unknown as { window?: unknown; document?: unknown };
    globalAny.window = {};
    globalAny.document = { createElement: () => ({ getContext: () => null, width: 0, height: 0 }) };

    const { installHostApi } = await import('../vision/ExternalCamera');
    installHostApi();

    const api = (globalAny.window as { CatchChallenge: { version: number; camera: Record<string, unknown> } })
      .CatchChallenge;

    expect(api.version).toBe(1);
    for (const method of ['registerHost', 'open', 'pushFrame', 'close', 'isActive', 'status']) {
      expect(typeof api.camera[method]).toBe('function');
    }

    delete globalAny.window;
    delete globalAny.document;
  });

  it('reports a registered host and forwards permission requests to it', async () => {
    const { externalCamera } = await import('../vision/ExternalCamera');
    externalCamera.reset();

    expect(externalCamera.hasHost()).toBe(false);
    expect(externalCamera.requestHostPermission()).toBe(false);

    const requestPermission = vi.fn();
    externalCamera.registerHost({ name: 'android-uvc', requestPermission });

    expect(externalCamera.hasHost()).toBe(true);
    expect(externalCamera.getHostName()).toBe('android-uvc');
    expect(externalCamera.requestHostPermission()).toBe(true);
    expect(requestPermission).toHaveBeenCalledTimes(1);

    externalCamera.reset();
  });

  it('is not active until frames actually arrive, and reports why it closed', async () => {
    const { externalCamera } = await import('../vision/ExternalCamera');
    externalCamera.reset();
    externalCamera.registerHost({ name: 'test-host' });

    // Without a DOM canvas `open` cannot build a surface; the important contract is
    // that "announced" never means "live" until a frame has been decoded.
    expect(externalCamera.isActive()).toBe(false);

    externalCamera.close('unplugged');
    expect(externalCamera.isActive()).toBe(false);
    expect(externalCamera.status().closeReason).toBe('unplugged');

    externalCamera.reset();
  });

  it('survives a host that throws from its permission hook', async () => {
    const { externalCamera } = await import('../vision/ExternalCamera');
    externalCamera.reset();
    externalCamera.registerHost({
      name: 'broken-host',
      requestPermission: () => {
        throw new Error('binder died');
      },
    });

    expect(externalCamera.requestHostPermission()).toBe(false);
    externalCamera.reset();
  });
});

describe('exclusive hosts', () => {
  it('marks a host exclusive so the page will not fall back to getUserMedia', async () => {
    const { externalCamera } = await import('../vision/ExternalCamera');
    externalCamera.reset();

    externalCamera.registerHost({ name: 'browser-host' });
    expect(externalCamera.isExclusive()).toBe(false);

    externalCamera.registerHost({ name: 'android-usb-camera', exclusive: true });
    expect(externalCamera.isExclusive()).toBe(true);
    expect(externalCamera.status().exclusive).toBe(true);

    externalCamera.reset();
  });

  it('reports a failure raised after the open request, and ignores older ones', async () => {
    const { externalCamera } = await import('../vision/ExternalCamera');
    externalCamera.reset();

    externalCamera.close('stale_failure_from_last_session');
    const requestedAt = Date.now() + 5; // a request that happens after that close
    expect(externalCamera.getFailureSince(requestedAt)).toBeNull();

    externalCamera.close('no_camera');
    expect(externalCamera.getFailureSince(requestedAt - 10)).toBe('no_camera');

    externalCamera.reset();
  });
});
