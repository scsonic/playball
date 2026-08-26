import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analytics, fpsBucket } from './analytics/Analytics';
import { sound } from './audio/Sound';
import { CameraMonitor } from './components/CameraMonitor';
import { SponsorBadge } from './components/SponsorBadge';
import { resolveAsset } from './config/asset-manifest';
import { dispatch, store, useConfig, useGameState } from './core/store';
import { TickPriority, ticker } from './core/ticker';
import { createCouponService } from './coupon/HttpCouponService';
import type { CouponService } from './coupon/CouponService';
import { gameEngine } from './game/Engine';
import { t } from './i18n';
import { CursorLayer } from './interaction/CursorLayer';
import { dwellEngine } from './interaction/DwellEngine';
import { AdminPanel } from './screens/AdminPanel';
import { AttractScreen } from './screens/AttractScreen';
import { BootScreen } from './screens/BootScreen';
import { CalibrationScreen } from './screens/CalibrationScreen';
import { CameraErrorScreen } from './screens/CameraErrorScreen';
import { CouponScreen } from './screens/CouponScreen';
import { GameHud } from './screens/GameHud';
import { ResultScreen } from './screens/ResultScreen';
import type { Coupon, Difficulty, HandMode, Locale, TrackingDiagnostics } from './types';
import { camera } from './vision/Camera';
import { externalCamera } from './vision/ExternalCamera';
import { handTracker } from './vision/HandTracker';
import { pointerSource } from './vision/PointerSource';

const FLIP_STORAGE_KEY = 'catch-challenge.cameraFlipVertical';
const CALIBRATION_HOLD_SECONDS = 1.0;
const READY_HOLD_SECONDS = 1.4;
/** States where a stray dwell must not be able to fire UI. */
const GAMEPLAY_STATES = new Set(['COUNTDOWN', 'PITCHING', 'PITCH_RESULT']);

export function App() {
  const state = useGameState();
  const config = useConfig();
  const dict = useMemo(() => t(state.locale), [state.locale]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const couponService = useRef<CouponService | null>(null);
  const gameStartedAt = useRef(0);
  const calibrationHold = useRef(0);
  const lastActivity = useRef(Date.now());

  const [uiTick, setUiTick] = useState(() => ({
    diagnostics: pointerSource.getDiagnostics(),
    confidence: 0,
    tracked: false,
    calibration: 0,
  }));
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // ------------------------------------------------------------ bootstrap
  useEffect(() => {
    analytics.setContext({ sessionId: state.sessionId, locale: state.locale, difficulty: state.difficulty });
    analytics.track('game_session_started');

    // Operator / end-to-end test hook. Read-only diagnostics plus the same
    // controls the admin panel already exposes — documented in the README.
    (window as unknown as { __catchChallenge?: unknown }).__catchChallenge = {
      store,
      dispatch,
      engine: gameEngine,
      pointer: pointerSource,
      dwell: dwellEngine,
      ticker,
      camera,
      externalCamera,
    };
    pointerSource.attachDom();
    pointerSource.applyConfig(store.getConfig());

    // Restore the per-installation camera orientation before anything opens a camera.
    try {
      if (localStorage.getItem(FLIP_STORAGE_KEY) === 'true') {
        dispatch({ type: 'TOGGLE_CAMERA_FLIP' });
        camera.setFlipVertical(true);
      }
    } catch {
      /* storage unavailable */
    }
    createCouponService(store.getConfig()).then((service) => {
      couponService.current = service;
    });
    const id = window.setTimeout(() => dispatch({ type: 'BOOT_COMPLETE' }), 900);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Canvas + engine lifecycle
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    gameEngine.attach(canvas);
    gameEngine.applyConfig(store.getConfig());

    const resize = () => {
      gameEngine.resize();
      pointerSource.resize();
    };
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    resize();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      gameEngine.detach();
    };
  }, []);

  // Optional artwork from the asset manifest; procedural art is used if absent.
  useEffect(() => {
    let cancelled = false;
    const load = (id: string, apply: (img: HTMLImageElement | null) => void) => {
      const url = resolveAsset(id, config);
      if (!url) return apply(null);
      const img = new Image();
      img.onload = () => !cancelled && apply(img);
      img.onerror = () => !cancelled && apply(null);
      img.src = url;
    };
    load('productBottle', (img) => gameEngine.setProductImage(img));
    load('stadiumBackground', (img) => gameEngine.setBackgroundImage(img));
    return () => {
      cancelled = true;
    };
  }, [config]);

  // Keep every subsystem in sync with config / preferences.
  useEffect(() => {
    pointerSource.applyConfig(config);
    gameEngine.applyConfig(config);
    camera.setFlipVertical(config.cameraFlipVertical);
    dwellEngine.setOptions({
      durationMs: config.dwellClickDurationMs,
      velocityPauseAt: config.dwellVelocityPausePx,
      cooldownMs: config.dwellCooldownMs,
    });
    sound.setEnabled(state.audioEnabled);
    document.documentElement.lang = state.locale;
    document.body.classList.toggle('reduced-motion', state.reducedMotion);
    document.body.classList.toggle('high-contrast', state.highContrast);
    analytics.setContext({
      locale: state.locale,
      difficulty: state.difficulty,
      inputMode: state.inputMode,
      screenMode: window.innerHeight > window.innerWidth ? 'portrait' : 'landscape',
    });
  }, [config, state.audioEnabled, state.locale, state.reducedMotion, state.highContrast, state.inputMode, state.difficulty]);

  // ------------------------------------------------------- the single loop
  useEffect(() => {
    let uiAccumulator = 0;

    const unsubVision = ticker.subscribe((dt, now) => {
      const cursor = pointerSource.update(dt, now);
      const current = store.getState();

      if (cursor.present && cursor.speed > 25) lastActivity.current = Date.now();

      // Calibration completes after a steady hold of the correct open palm.
      if (current.app === 'CAMERA_CALIBRATION') {
        const diag = pointerSource.getDiagnostics();
        const good = diag.handDetected && diag.correctHand && diag.palmOpen;
        calibrationHold.current = good
          ? Math.min(CALIBRATION_HOLD_SECONDS, calibrationHold.current + dt)
          : Math.max(0, calibrationHold.current - dt * 1.5);
        if (calibrationHold.current >= CALIBRATION_HOLD_SECONDS) {
          calibrationHold.current = 0;
          analytics.track('calibration_completed');
          dispatch({ type: 'CALIBRATED' });
        }
      }

      // Low-rate UI mirror so React never renders per frame.
      uiAccumulator += dt;
      if (uiAccumulator >= 0.2) {
        uiAccumulator = 0;
        setUiTick({
          diagnostics: { ...pointerSource.getDiagnostics() },
          confidence: cursor.confidence,
          tracked: cursor.present && cursor.source === 'hand',
          calibration: calibrationHold.current / CALIBRATION_HOLD_SECONDS,
        });
      }

      // Kiosk inactivity reset.
      const idleFor = (Date.now() - lastActivity.current) / 1000;
      const resettable = !['ATTRACT_MODE', 'BOOT', 'CAMERA_PERMISSION', 'RESETTING'].includes(current.app);
      if (resettable && idleFor > store.getConfig().inactivityResetSeconds) {
        lastActivity.current = Date.now();
        analytics.track('auto_reset');
        dispatch({ type: 'RESET', reason: 'inactivity' });
      }
    }, TickPriority.Vision);

    const unsubDwell = ticker.subscribe((dt, now) => {
      dwellEngine.tick(pointerSource.getSample(), dt, now);
    }, TickPriority.Dwell);

    const unsubGame = ticker.subscribe((dt, now) => {
      gameEngine.tick(dt, now);
    }, TickPriority.Game);

    return () => {
      unsubVision();
      unsubDwell();
      unsubGame();
    };
  }, []);

  // ------------------------------------------------------- engine callbacks
  useEffect(() => {
    gameEngine.setCallbacks({
      onCountdown: (value) => {
        if (value === 0) dispatch({ type: 'START_PITCHING' });
      },
      onPitchReleased: (index) => {
        // Return from the previous pitch's result state before scoring again.
        dispatch({ type: 'NEXT_PITCH' });
        const next = dispatch({ type: 'PITCH_RELEASED' });
        analytics.track('pitch_released', { pitchNumber: index + 1, catchCount: next.catches });
      },
      onPitchResolved: (outcome, meta) => {
        const next = dispatch({ type: 'PITCH_RESOLVED', outcome });
        lastActivity.current = Date.now();
        analytics.track(outcome === 'catch' ? 'pitch_caught' : 'pitch_missed', {
          pitchNumber: meta.index + 1,
          catchCount: next.catches,
          fpsBucket: fpsBucket(ticker.getFps()),
        });
      },
      onSequenceComplete: () => {
        const next = dispatch({ type: 'GAME_COMPLETE' });
        gameEngine.celebrate(next.won);
        sound.play(next.won ? 'win' : 'lose');
        analytics.track(next.won ? 'game_won' : 'game_lost', { catchCount: next.catches });
      },
    });
  }, []);

  // -------------------------------------------------- state-driven side effects
  useEffect(() => {
    const app = state.app;
    dwellEngine.setEnabled(!GAMEPLAY_STATES.has(app) || app === 'PITCH_RESULT');

    if (app === 'ATTRACT_MODE') {
      gameEngine.setMode('attract');
      lastActivity.current = Date.now();
    } else if (app === 'READY') {
      gameEngine.setMode('ready');
      const id = window.setTimeout(() => {
        dispatch({ type: 'START_COUNTDOWN' });
        gameEngine.startSequence(store.getState().runId);
      }, READY_HOLD_SECONDS * 1000);
      return () => window.clearTimeout(id);
    } else if (app === 'RESETTING') {
      gameEngine.abort();
      setCoupon(null);
      setCouponError(null);
      const id = window.setTimeout(() => dispatch({ type: 'RESET_COMPLETE' }), 350);
      return () => window.clearTimeout(id);
    } else if (app === 'BOOT' || app === 'CAMERA_PERMISSION') {
      gameEngine.setMode('idle');
    }
  }, [state.app]);

  // Coupon issuance — only ever from a won result.
  useEffect(() => {
    if (state.app !== 'COUPON' || coupon || !state.won) return;
    let cancelled = false;
    (async () => {
      try {
        const service = couponService.current ?? (await createCouponService(store.getConfig()));
        couponService.current = service;
        await service.submitResult(resultPayload());
        const issued = await service.issueCoupon(resultPayload());
        if (cancelled) return;
        setCoupon(issued);
        analytics.track('coupon_issued');
        analytics.track('coupon_qr_displayed');
      } catch (err) {
        if (!cancelled) setCouponError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };

    function resultPayload() {
      const s = store.getState();
      const c = store.getConfig();
      return {
        sessionId: s.sessionId,
        catches: s.catches,
        totalPitches: c.totalPitches,
        requiredCatches: c.requiredCatches,
        won: s.won,
        difficulty: s.difficulty,
        durationMs: Date.now() - gameStartedAt.current,
      };
    }
  }, [state.app, state.won, coupon]);

  // Keyboard: admin panel, admin reset, Enter to activate the hovered control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const shortcut = store.getConfig().adminShortcutKey.toLowerCase();
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === shortcut) {
        e.preventDefault();
        setAdminOpen((open) => !open);
      } else if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleReset('admin');
      } else if (e.key === 'Escape') {
        setAdminOpen(false);
      } else if (e.key === 'Enter' || e.key === ' ') {
        const cursor = pointerSource.getSample();
        if (dwellEngine.activateAt(cursor.x, cursor.y)) e.preventDefault();
      }
      lastActivity.current = Date.now();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Screen wake lock — a kiosk must not sleep between visitors.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      try {
        const wakeLock = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<typeof lock> } })
          .wakeLock;
        if (wakeLock) lock = await wakeLock.request('screen');
      } catch {
        /* wake lock unavailable — not fatal */
      }
    };
    request();
    const onVisible = () => document.visibilityState === 'visible' && request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => undefined);
    };
  }, []);

  // Camera loss recovery
  useEffect(() => {
    camera.onLost((code) => {
      analytics.track('camera_error', { errorCode: code });
      pointerSource.setCameraEnabled(false);
      gameEngine.abort();
      dispatch({ type: 'CAMERA_LOST', code });
    });
  }, []);

  // ----------------------------------------------------------------- actions
  const handleEnableCamera = useCallback(async () => {
    setBusy(true);
    await sound.unlock();
    sound.play('select');
    const c = store.getConfig();
    const result = await camera.start(c.cameraWidth, c.cameraHeight);
    if (!result.ok) {
      setBusy(false);
      analytics.track('camera_permission_denied', { errorCode: result.code });
      dispatch({ type: 'CAMERA_DENIED', code: result.code ?? 'unknown' });
      return;
    }
    analytics.track('camera_permission_granted');
    console.info(`[camera] transport=${result.transport} device=${camera.getLabel()}`);
    const loaded = await handTracker.load();
    pointerSource.setCameraEnabled(loaded);
    setBusy(false);
    if (!loaded) {
      // Models unavailable (offline / blocked CDN): fall back rather than dead-end.
      dispatch({ type: 'CAMERA_SKIPPED' });
      return;
    }
    sound.startAmbient();
    dispatch({ type: 'CAMERA_GRANTED' });
  }, []);

  const handleSkipCamera = useCallback(async () => {
    await sound.unlock();
    sound.play('select');
    sound.startAmbient();
    pointerSource.setCameraEnabled(false);
    dispatch({ type: 'CAMERA_SKIPPED' });
  }, []);

  const handleStart = useCallback(() => {
    sound.play('select');
    gameStartedAt.current = Date.now();
    lastActivity.current = Date.now();
    setCoupon(null);
    setCouponError(null);
    analytics.track('game_started');
    dispatch({ type: 'READY_UP' });
  }, []);

  const handlePlayAgain = useCallback(() => {
    sound.play('select');
    setCoupon(null);
    setCouponError(null);
    gameStartedAt.current = Date.now();
    lastActivity.current = Date.now();
    analytics.track('play_again_clicked');
    dispatch({ type: 'PLAY_AGAIN' });
  }, []);

  const handleReset = useCallback((reason: 'manual' | 'admin' | 'inactivity' | 'coupon_timeout' = 'manual') => {
    sound.play('select');
    gameEngine.abort();
    dispatch({ type: 'RESET', reason });
  }, []);

  const handleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* browser policy may refuse — the layout works either way */
    }
  }, []);

  const handleLocale = useCallback((locale: Locale) => {
    sound.play('select');
    analytics.track('language_changed');
    dispatch({ type: 'SET_LOCALE', locale });
  }, []);

  const handleDifficulty = useCallback((difficulty: Difficulty) => {
    sound.play('select');
    analytics.track('difficulty_changed');
    dispatch({ type: 'SET_DIFFICULTY', difficulty });
  }, []);

  const handleHandMode = useCallback((handMode: HandMode) => {
    sound.play('select');
    dispatch({ type: 'SET_HAND_MODE', handMode });
  }, []);

  /**
   * Flip the camera image. Remembered per installation: an inverted mount does not
   * become upright between visitors, and nobody wants to set this every morning.
   */
  const handleFlipCamera = useCallback(() => {
    sound.play('select');
    const next = dispatch({ type: 'TOGGLE_CAMERA_FLIP' });
    camera.setFlipVertical(next.cameraFlipVertical);
    try {
      localStorage.setItem(FLIP_STORAGE_KEY, String(next.cameraFlipVertical));
    } catch {
      /* private mode / storage disabled — the setting simply will not persist */
    }
  }, []);

  const handleClaim = useCallback(() => {
    sound.play('select');
    analytics.track('coupon_claim_clicked');
    dispatch({ type: 'SHOW_COUPON' });
  }, []);

  const openCampaign = useCallback(() => {
    window.open(store.getConfig().campaignUrl, '_blank', 'noopener,noreferrer');
  }, []);

  // ------------------------------------------------------------------ render
  const app = state.app;
  const showGameCanvas = app !== 'BOOT' && app !== 'CAMERA_PERMISSION' && app !== 'CAMERA_ERROR';
  const menuCursorVisible = !GAMEPLAY_STATES.has(app) && app !== 'READY';

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#061428]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ opacity: showGameCanvas ? 1 : 0, transition: 'opacity 400ms ease' }}
        aria-hidden="true"
      />

      {/* Vignette keeps large-format UI legible over the bright stadium. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 45%, rgba(6,20,40,0) 35%, rgba(6,20,40,0.55) 100%)',
          opacity: showGameCanvas ? 1 : 0,
        }}
      />

      {(app === 'BOOT' || app === 'CAMERA_PERMISSION') && (
        <BootScreen
          dict={dict}
          config={config}
          locale={state.locale}
          audioEnabled={state.audioEnabled}
          booting={app === 'BOOT'}
          busy={busy}
          onEnableCamera={handleEnableCamera}
          onSkipCamera={handleSkipCamera}
          onLocale={handleLocale}
          onToggleAudio={() => dispatch({ type: 'TOGGLE_AUDIO' })}
          onFullscreen={handleFullscreen}
        />
      )}

      {app === 'CAMERA_ERROR' && (
        <CameraErrorScreen
          dict={dict}
          errorCode={state.errorCode}
          onRetry={() => dispatch({ type: 'RETRY_CAMERA' })}
          onMouseMode={handleSkipCamera}
        />
      )}

      {app === 'CAMERA_CALIBRATION' && (
        <CalibrationScreen
          dict={dict}
          config={config}
          diagnostics={uiTick.diagnostics as TrackingDiagnostics}
          progress={uiTick.calibration}
          handMode={state.handMode}
          flipVertical={state.cameraFlipVertical}
          onHandMode={handleHandMode}
          onFlipVertical={handleFlipCamera}
          onSkip={() => dispatch({ type: 'CALIBRATED' })}
        />
      )}

      {app === 'ATTRACT_MODE' && (
        <AttractScreen
          dict={dict}
          config={config}
          locale={state.locale}
          audioEnabled={state.audioEnabled}
          difficulty={state.difficulty}
          handDetected={uiTick.tracked}
          onStart={handleStart}
          onLocale={handleLocale}
          onToggleAudio={() => dispatch({ type: 'TOGGLE_AUDIO' })}
          onFullscreen={handleFullscreen}
          onDifficulty={handleDifficulty}
        />
      )}

      {(app === 'READY' || GAMEPLAY_STATES.has(app)) && (
        <GameHud
          dict={dict}
          config={config}
          pitchIndex={state.pitchIndex}
          catches={state.catches}
          outcomes={state.outcomes}
          trackingConfidence={uiTick.confidence}
          tracked={uiTick.tracked || state.inputMode === 'mouse'}
          onReset={() => handleReset('manual')}
          showReady={app === 'READY'}
        />
      )}

      {app === 'GAME_RESULT' && (
        <ResultScreen
          dict={dict}
          config={config}
          won={state.won}
          catches={state.catches}
          onClaim={handleClaim}
          onPlayAgain={handlePlayAgain}
          onCampaign={openCampaign}
        />
      )}

      {app === 'COUPON' && (
        <CouponScreen
          dict={dict}
          config={config}
          coupon={coupon}
          error={couponError}
          onPlayAgain={handlePlayAgain}
          onBack={() => dispatch({ type: 'GO_ATTRACT' })}
          onCampaign={openCampaign}
        />
      )}

      <CursorLayer visible={menuCursorVisible} highContrast={state.highContrast} />

      {/* Live camera monitor: the fastest on-site answer to "is the camera feeding
          the game?", and it works the same for a webcam and a native USB host. */}
      <CameraMonitor
        config={config}
        visible={config.showCameraMonitor && state.cameraReady && app !== 'CAMERA_CALIBRATION'}
        onFlip={handleFlipCamera}
        flipLabel={dict.flipCamera}
      />

      {state.demoWatermark && <div className="watermark">{dict.conceptDemo}</div>}

      {app === 'ATTRACT_MODE' && (
        <div className="pointer-events-none absolute bottom-[2.4vmin] right-[2.4vmin] opacity-70">
          <SponsorBadge config={config} label="" />
        </div>
      )}

      <AdminPanel
        open={adminOpen}
        config={config}
        state={state}
        couponMode={couponService.current?.mode ?? 'demo'}
        onClose={() => setAdminOpen(false)}
        onForceResult={(won) => {
          gameEngine.abort();
          const next = dispatch({ type: 'FORCE_RESULT', won });
          gameEngine.celebrate(next.won);
        }}
        onReset={() => handleReset('admin')}
        onDifficulty={handleDifficulty}
        onToggleDebug={() => {
          const next = dispatch({ type: 'TOGGLE_DEBUG' });
          store.patchConfig({ enableDebugOverlay: next.debugOverlay });
        }}
        onToggleCameraFlip={handleFlipCamera}
        onToggleWatermark={() => dispatch({ type: 'TOGGLE_WATERMARK' })}
      />
    </div>
  );
}
