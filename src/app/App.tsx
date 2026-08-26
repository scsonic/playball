import React, { useEffect, useState, useRef, useCallback } from 'react';
import { gameStateMachine, GameStoreState } from '../state/gameStateMachine';
import { cameraManager } from '../vision/CameraManager';
import { handTracker } from '../vision/HandTracker';
import { visionSimulator } from '../vision/VisionSimulator';
import { dwellController } from '../interaction/DwellController';
import { HandCursor } from '../interaction/HandCursor';
import { soundService } from '../audio/SoundService';
import { TrackingFrame, Locale } from '../types/game';

// Screens
import { BootScreen } from '../screens/BootScreen';
import { CalibrationScreen } from '../screens/CalibrationScreen';
import { AttractScreen } from '../screens/AttractScreen';
import { CountdownScreen } from '../screens/CountdownScreen';
import { GameplayScreen } from '../screens/GameplayScreen';
import { ResultScreen } from '../screens/ResultScreen';
import { AdminDebugModal } from '../screens/AdminDebugModal';

export const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameStoreState>(gameStateMachine.getState());
  const initialFrame: TrackingFrame = {
    timestamp: performance.now(),
    personDetected: true,
    handDetected: true,
    isLeftHand: true,
    palmOpen: true,
    confidence: 1.0,
    rawPalmCenter: { x: 0.5, y: 0.5 },
    smoothedPalmCenter: { x: 0.5, y: 0.5 },
    screenPos: { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 },
    velocity: 0,
    lightingQuality: 'good'
  };

  const trackingFrameRef = useRef<TrackingFrame>(initialFrame);
  const [dwellProgress, setDwellProgress] = useState<number>(0);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [targetHand, setTargetHand] = useState<'left' | 'right'>('left');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const inactivityTimerRef = useRef<number>(Date.now());

  // Subscribe to State Machine
  useEffect(() => {
    const unsub = gameStateMachine.subscribe((state) => {
      setGameState(state);
      soundService.setEnabled(state.audioEnabled);
    });
    return () => unsub();
  }, []);

  // Main Tracking & Dwell Loop (Updates Ref & Dwell without causing 60 FPS full re-renders)
  useEffect(() => {
    let lastDwellProgress = 0;

    const loop = (time: number) => {
      let currentFrame: TrackingFrame;

      const video = cameraManager.getVideoElement();
      if (!gameState.mouseDemoMode && video && cameraManager.isReady()) {
        const cameraFrame = handTracker.processVideoFrame(video, time);
        if (cameraFrame.handDetected) {
          currentFrame = cameraFrame;
        } else {
          currentFrame = visionSimulator.getFrame(time);
        }
      } else {
        currentFrame = visionSimulator.getFrame(time);
      }

      trackingFrameRef.current = currentFrame;

      // 2. Update Dwell Selection
      const isGameplay = gameState.currentState === 'PITCHING' || gameState.currentState === 'COUNTDOWN';
      const dwellRes = dwellController.update(
        currentFrame.screenPos.x,
        currentFrame.screenPos.y,
        currentFrame.velocity,
        isGameplay
      );

      // Only trigger state update if progress changed meaningfully (saves re-renders)
      if (Math.abs(dwellRes.progress - lastDwellProgress) > 0.05 || dwellRes.progress === 0 || dwellRes.progress === 1) {
        lastDwellProgress = dwellRes.progress;
        setDwellProgress(dwellRes.progress);
      }

      // 3. Inactivity Auto-Reset in Trade-Show Kiosk
      if (currentFrame.velocity > 50 || dwellRes.clicked) {
        inactivityTimerRef.current = Date.now();
      } else if (
        (gameState.currentState === 'GAME_RESULT' || gameState.currentState === 'COUPON') &&
        Date.now() - inactivityTimerRef.current > 30000
      ) {
        inactivityTimerRef.current = Date.now();
        gameStateMachine.resetToAttract();
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [gameState.mouseDemoMode, gameState.currentState]);

  // Keyboard Shortcuts (Admin, Fullscreen, Reset)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '`' || e.key === '~') {
        setIsAdminOpen((prev) => !prev);
      } else if (e.key === 'r' || e.key === 'R') {
        gameStateMachine.resetToAttract();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  const handleEnableCamera = useCallback(async () => {
    const success = await cameraManager.initialize();
    if (success) {
      await handTracker.initialize();
      gameStateMachine.transitionTo('CAMERA_CALIBRATION');
    } else {
      visionSimulator.enable();
      gameStateMachine.setMouseDemoMode(true);
      gameStateMachine.transitionTo('ATTRACT_MODE');
    }
  }, []);

  const handleStartMouseDemo = useCallback(() => {
    visionSimulator.enable();
    gameStateMachine.setMouseDemoMode(true);
    gameStateMachine.transitionTo('ATTRACT_MODE');
  }, []);

  const handleToggleTargetHand = useCallback(() => {
    setTargetHand((prev) => {
      const nextHand = prev === 'left' ? 'right' : 'left';
      handTracker.setTargetHand(nextHand);
      return nextHand;
    });
  }, []);

  const handleStartGame = useCallback(() => {
    gameStateMachine.startNewGame();
  }, []);

  const handleCountdownComplete = useCallback(() => {
    gameStateMachine.transitionTo('PITCHING');
  }, []);

  const handleResetGame = useCallback(() => {
    gameStateMachine.resetToAttract();
  }, []);

  const isGameplayMode = gameState.currentState === 'PITCHING' || gameState.currentState === 'COUNTDOWN';

  return (
    <main className="relative w-full h-full overflow-hidden bg-slate-950 text-white select-none">
      <h1 className="sr-only">ITO EN WBC Baseball Catching Challenge</h1>
      {/* Hidden Video for CV Processing */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="hidden"
      />

      {/* Screen Routing */}
      {gameState.currentState === 'BOOT' && (
        <BootScreen
          locale={gameState.locale}
          audioEnabled={gameState.audioEnabled}
          isFullscreen={isFullscreen}
          onSelectLocale={(loc) => gameStateMachine.setLocale(loc)}
          onToggleAudio={() => gameStateMachine.setAudioEnabled(!gameState.audioEnabled)}
          onToggleFullscreen={toggleFullscreen}
          onEnableCamera={handleEnableCamera}
          onStartMouseDemo={handleStartMouseDemo}
        />
      )}

      {gameState.currentState === 'CAMERA_CALIBRATION' && (
        <CalibrationScreen
          locale={gameState.locale}
          trackingFrame={trackingFrameRef.current}
          videoElement={cameraManager.getVideoElement()}
          targetHand={targetHand}
          onCalibrationComplete={() => gameStateMachine.transitionTo('ATTRACT_MODE')}
          onToggleTargetHand={handleToggleTargetHand}
          onRetryCamera={handleEnableCamera}
        />
      )}

      {gameState.currentState === 'ATTRACT_MODE' && (
        <AttractScreen
          locale={gameState.locale}
          onStartGame={handleStartGame}
          onSelectLocale={(loc) => gameStateMachine.setLocale(loc)}
        />
      )}

      {(gameState.currentState === 'READY' || gameState.currentState === 'PITCHING') && (
        <GameplayScreen
          gameState={gameState}
          trackingFrameRef={trackingFrameRef}
          trackingFrame={trackingFrameRef.current}
          locale={gameState.locale}
          onResetGame={handleResetGame}
        />
      )}

      {gameState.currentState === 'GAME_RESULT' && (
        <ResultScreen
          gameState={gameState}
          locale={gameState.locale}
          onPlayAgain={handleStartGame}
        />
      )}

      {/* Dynamic Hand / Glove Dwell Cursor */}
      <HandCursor
        trackingFrameRef={trackingFrameRef}
        dwellProgress={dwellProgress}
        isGameplayMode={isGameplayMode}
        targetRadiusPx={140}
      />

      {/* Admin / Debug Modal */}
      <AdminDebugModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        trackingFrame={trackingFrameRef.current}
        gameState={gameState}
        videoElement={cameraManager.getVideoElement()}
        onSimulateWin={() => {
          gameStateMachine.startNewGame();
          gameStateMachine.recordCatch();
          gameStateMachine.recordCatch();
          gameStateMachine.recordCatch();
          gameStateMachine.transitionTo('GAME_RESULT');
        }}
        onSimulateLose={() => {
          gameStateMachine.startNewGame();
          gameStateMachine.recordMiss();
          gameStateMachine.recordMiss();
          gameStateMachine.recordMiss();
          gameStateMachine.transitionTo('GAME_RESULT');
        }}
        onReset={handleResetGame}
      />
    </main>
  );
};
