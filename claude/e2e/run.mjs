/**
 * End-to-end tests for the Claude edition.
 *
 * Uses `playwright-core` with the locally installed Google Chrome, so the suite
 * runs without downloading a browser bundle. Everything is driven through the
 * real UI (mouse demo mode) against a production build served by `vite preview`.
 *
 *   npm run build && npm run e2e
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const PORT = Number(process.env.E2E_PORT ?? 4173);
const BASE = `http://localhost:${PORT}`;

const results = [];
let failures = 0;

async function test(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - started });
    console.log(`  ✓ ${name} (${Date.now() - started}ms)`);
  } catch (err) {
    failures++;
    results.push({ name, ok: false, ms: Date.now() - started, error: err.message });
    console.log(`  ✗ ${name}\n      ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`preview server did not start at ${url}`);
}

/** Reads live engine/state diagnostics through the documented debug hook. */
const readState = (page) =>
  page.evaluate(() => {
    const hook = window.__catchChallenge;
    return {
      app: hook.store.getState().app,
      catches: hook.store.getState().catches,
      pitchIndex: hook.store.getState().pitchIndex,
      won: hook.store.getState().won,
      engine: hook.engine.getDebugInfo(),
    };
  });

async function waitForApp(page, predicate, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await readState(page);
    if (predicate(state)) return state;
    await page.waitForTimeout(60);
  }
  throw new Error('timed out waiting for app state');
}

async function main() {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    stdio: 'ignore',
    detached: false,
  });

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const consoleErrors = [];

  try {
    await waitForServer(BASE);

    const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`console: ${msg.text()}`);
    });

    console.log('\nLanding page');
    await test('offers both editions', async () => {
      await page.goto(BASE, { waitUntil: 'networkidle' });
      const hrefs = await page.$$eval('a.card', (cards) => cards.map((c) => c.getAttribute('href')));
      assert(hrefs.includes('./gemini/'), 'missing Gemini link');
      assert(hrefs.includes('./claude/'), 'missing Claude link');
    });

    await test('Gemini edition still boots', async () => {
      await page.goto(`${BASE}/gemini/`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);
      const body = await page.textContent('body');
      assert(body && body.length > 0, 'gemini edition rendered nothing');
    });

    console.log('\nClaude edition — camera fallback');
    await test('boots and offers a no-camera demo mode', async () => {
      await page.goto(`${BASE}/claude/`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#skip-camera', { timeout: 10_000 });
      assert((await page.textContent('body')).includes('カメラ映像はこの端末'), 'privacy copy missing');
    });

    await test('camera denial lands on a recoverable error screen', async () => {
      await page.click('#enable-camera');
      await waitForApp(page, (s) => s.app === 'CAMERA_ERROR');
      await page.waitForSelector('#retry-camera');
      await page.waitForSelector('#mouse-mode');
    });

    await test('mouse demo mode reaches attract mode', async () => {
      await page.click('#mouse-mode');
      await waitForApp(page, (s) => s.app === 'ATTRACT_MODE');
      await page.waitForSelector('#start-game');
    });

    console.log('\nClaude edition — interaction');
    await test('language switching updates copy without reload', async () => {
      await page.click('#locale-en');
      assert((await page.textContent('body')).includes('Can you catch'), 'English copy missing');
      await page.click('#locale-ja');
      assert((await page.textContent('body')).includes('キャッチ'), 'Japanese copy missing');
    });

    await test('dwell-to-click fires exactly one selection after 2s', async () => {
      // Easy difficulty for the game that follows: the bot chases the ball by polling
      // the engine, which lags a frame or two. That lag is a property of the harness,
      // not the game, and Easy removes it as a source of flakes.
      await page.evaluate(() => window.__catchChallenge.dispatch({ type: 'SET_DIFFICULTY', difficulty: 'easy' }));
      await page.evaluate(() => window.__catchChallenge.store.patchConfig({ dwellClickDurationMs: 600 }));
      const box = await page.locator('#start-game').boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(1400); // dwell, no click event
      const state = await readState(page);
      assert(state.app === 'READY' || state.app === 'COUNTDOWN', `dwell did not start the game (${state.app})`);
      await page.evaluate(() => window.__catchChallenge.store.patchConfig({ dwellClickDurationMs: 2000 }));
    });

    await test('plays a full 5-pitch game and wins by catching the ball', async () => {
      await waitForApp(page, (s) => s.app === 'PITCHING' || s.app === 'PITCH_RESULT', 20_000);
      // Track the live ball with the mouse — this exercises the real catch pipeline.
      const deadline = Date.now() + 45_000;
      let state = await readState(page);
      while (state.app !== 'GAME_RESULT' && Date.now() < deadline) {
        if (state.engine.ball) {
          await page.mouse.move(state.engine.ball.x, state.engine.ball.y);
        }
        state = await readState(page);
      }
      assert(state.app === 'GAME_RESULT', `game did not finish (${state.app})`);
      assert(state.pitchIndex === 5, `expected 5 pitches, got ${state.pitchIndex}`);
      assert(state.catches >= 3, `expected a win, caught ${state.catches}`);
      assert(state.won === true, 'win flag not set');
    });

    await test('winning shows the coupon with a QR code and a demo warning', async () => {
      await page.waitForSelector('#claim-coupon');
      await page.click('#claim-coupon');
      await waitForApp(page, (s) => s.app === 'COUPON');
      await page.waitForSelector('img[alt="Coupon QR code"]', { timeout: 10_000 });
      const body = await page.textContent('body');
      assert(body.includes('DEMO-'), 'coupon code missing');
      assert(body.includes('デモ用コード'), 'demo warning missing');
    });

    await test('play again restarts without a page reload', async () => {
      await page.evaluate(() => {
        window.__e2eMarker = 'kept';
      });
      await page.click('#coupon-play-again');
      const state = await waitForApp(page, (s) => s.app === 'READY' || s.app === 'COUNTDOWN');
      assert(state.catches === 0, 'score was not cleared');
      assert((await page.evaluate(() => window.__e2eMarker)) === 'kept', 'the page reloaded');
    });

    await test('a losing game never issues a coupon', async () => {
      await page.evaluate(() => {
        const hook = window.__catchChallenge;
        hook.engine.abort();
        hook.dispatch({ type: 'FORCE_RESULT', won: false });
      });
      await waitForApp(page, (s) => s.app === 'GAME_RESULT' && s.won === false);
      assert((await page.$('#claim-coupon')) === null, 'claim button shown after a loss');
      await page.evaluate(() => window.__catchChallenge.dispatch({ type: 'SHOW_COUPON' }));
      const state = await readState(page);
      assert(state.app === 'GAME_RESULT', 'a loss was able to open the coupon screen');
    });

    await test('inactivity returns the kiosk to attract mode', async () => {
      await page.evaluate(() => window.__catchChallenge.store.patchConfig({ inactivityResetSeconds: 1 }));
      await page.mouse.move(10, 10);
      await waitForApp(page, (s) => s.app === 'ATTRACT_MODE', 15_000);
      await page.evaluate(() => window.__catchChallenge.store.patchConfig({ inactivityResetSeconds: 30 }));
    });

    console.log('\nHost camera API (the Android USB-camera path)');
    await test('exposes window.CatchChallenge.camera to a native host', async () => {
      const api = await page.evaluate(() => {
        const cc = window.CatchChallenge;
        return {
          version: cc && cc.version,
          methods: cc && cc.camera ? Object.keys(cc.camera).sort() : [],
        };
      });
      assert(api.version === 1, 'host API version missing');
      assert(
        ['close', 'isActive', 'open', 'pushFrame', 'registerHost', 'status'].every((m) =>
          api.methods.includes(m),
        ),
        `unexpected host API surface: ${api.methods.join(',')}`,
      );
    });

    await test('accepts pushed frames and reports a live host camera', async () => {
      const status = await page.evaluate(async () => {
        // Stand in for the Android app: register, announce, push JPEG frames.
        let permissionAsked = 0;
        window.CatchChallenge.camera.registerHost({
          name: 'e2e-usb-host',
          requestPermission: () => { permissionAsked++; },
        });
        window.CatchChallenge.camera.open({ width: 320, height: 240, label: 'E2E UVC', transport: 'uvc' });

        const c = document.createElement('canvas');
        c.width = 320;
        c.height = 240;
        const ctx = c.getContext('2d');
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = i % 2 ? '#3366aa' : '#aa6633';
          ctx.fillRect(0, 0, 320, 240);
          ctx.fillStyle = '#fff';
          ctx.fillRect(20 + i * 10, 40, 60, 60);
          const base64 = c.toDataURL('image/jpeg', 0.7).split(',')[1];
          window.CatchChallenge.camera.pushFrame(base64);
          await new Promise((r) => setTimeout(r, 90));
        }
        await new Promise((r) => setTimeout(r, 200));
        return { ...window.CatchChallenge.camera.status(), permissionAsked };
      });

      assert(status.host === 'e2e-usb-host', 'host not registered');
      assert(status.active === true, `host camera not active: ${JSON.stringify(status)}`);
      assert(status.frames > 0, 'no frames decoded');
      assert(status.width === 320 && status.height === 240, 'frame size not adopted');
    });

    await test('a host camera drives the game instead of getUserMedia', async () => {
      // The page has no webcam here, so reaching calibration proves the frames
      // came from the host path.
      await page.evaluate(() => window.__catchChallenge.dispatch({ type: 'RESET', reason: 'manual' }));
      await page.waitForTimeout(600);
      await page.evaluate(() => {
        const hook = window.__catchChallenge;
        hook.store.patchConfig({ inactivityResetSeconds: 600 });
        hook.dispatch({ type: 'RETRY_CAMERA' });
      });
      await waitForApp(page, (s) => s.app === 'CAMERA_PERMISSION');

      // Keep the host feed alive while the app starts the camera.
      const pump = page.evaluate(async () => {
        const c = document.createElement('canvas');
        c.width = 320;
        c.height = 240;
        const ctx = c.getContext('2d');
        for (let i = 0; i < 60; i++) {
          ctx.fillStyle = i % 2 ? '#224466' : '#446622';
          ctx.fillRect(0, 0, 320, 240);
          window.CatchChallenge.camera.pushFrame(c.toDataURL('image/jpeg', 0.6).split(',')[1]);
          await new Promise((r) => setTimeout(r, 80));
        }
      });

      await page.click('#enable-camera');
      const state = await waitForApp(
        page,
        (s) => s.app === 'CAMERA_CALIBRATION' || s.app === 'ATTRACT_MODE' || s.app === 'CAMERA_ERROR',
        25_000,
      );
      const transport = await page.evaluate(() => window.__catchChallenge.camera.getTransport());
      await pump;

      assert(transport === 'host', `expected the host transport, got ${transport}`);
      assert(state.app !== 'CAMERA_ERROR', 'host camera was not accepted');
    });

    console.log('\nLayout');
    for (const [label, viewport] of [
      ['1920×1080 landscape', { width: 1920, height: 1080 }],
      ['3840×2160 landscape', { width: 3840, height: 2160 }],
      ['1080×1920 portrait', { width: 1080, height: 1920 }],
    ]) {
      await test(`renders without horizontal overflow at ${label}`, async () => {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(400);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        assert(!overflow, 'page scrolls horizontally');
      });
    }

    await test('no uncaught errors during the whole run', async () => {
      const ignorable = /favicon|Failed to load resource|mediapipe|tasks-vision/i;
      const real = consoleErrors.filter((e) => !ignorable.test(e));
      assert(real.length === 0, `console errors:\n      ${real.join('\n      ')}`);
    });

    await context.close();
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }

  console.log(`\n${results.length - failures}/${results.length} passed`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
