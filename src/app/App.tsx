import React, { useEffect, useState, useRef } from 'react';
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
  const [trackingFrame, setTrackingFrame] = useState<TrackingFrame>({
    timestamp: performance.now(),
    personDetected: false,
    handDetected: false,
    isLeftHand: true,
    palmOpen: false,
    confidence: 0,
    rawPalmCenter: { x: 0.5, y: 0.5 },
    smoothedPalmCenter: { x: 0.5, y: 0.5 },
    screenPos: { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 },
    velocity: 0,
    lightingQuality: 'good'
  });
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

  // Main Tracking & Dwell Loop
  useEffect(() => {
    const loop = (time: number) => {
      let currentFrame = trackingFrame;

      // 1. Check Vision Source
      if (gameState.mouseDemoMode) {
        currentFrame = visionSimulator.getFrame(time);
      } else {
        const video = cameraManager.getVideoElement();
        if (video && cameraManager.isReady()) {
          currentFrame = handTracker.processVideoFrame(video, time);
        }
      }

      setTrackingFrame(currentFrame);

      // 2. Update Dwell Selection
      const isGameplay = gameState.currentState === 'PITCHING' || gameState.currentState === 'COUNTDOWN';
      const dwellRes = dwellController.update(
        currentFrame.screenPos.x,
        currentFrame.screenPos.y,
        currentFrame.velocity,
        isGameplay
      );
      setDwellProgress(dwellRes.progress);

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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleEnableCamera = async () => {
    const success = await cameraManager.initialize();
    if (success) {
      await handTracker.initialize();
      gameStateMachine.transitionTo('CAMERA_CALIBRATION');
    } else {
      // If camera access fails, fallback to mouse demo mode
      visionSimulator.enable();
      gameStateMachine.setMouseDemoMode(true);
      gameStateMachine.transitionTo('ATTRACT_MODE');
    }
  };

  const handleStartMouseDemo = () => {
    visionSimulator.enable();
    gameStateMachine.setMouseDemoMode(true);
    gameStateMachine.transitionTo('ATTRACT_MODE');
  };

  const handleToggleTargetHand = () => {
    const nextHand = targetHand === 'left' ? 'right' : 'left';
    setTargetHand(nextHand);
    handTracker.setTargetHand(nextHand);
  };

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
          trackingFrame={trackingFrame}
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
          onStartGame={() => gameStateMachine.startNewGame()}
          onSelectLocale={(loc) => gameStateMachine.setLocale(loc)}
        />
      )}

      {gameState.currentState === 'READY' && (
        <CountdownScreen
          locale={gameState.locale}
          onCountdownComplete={() => gameStateMachine.transitionTo('PITCHING')}
        />
      )}

      {gameState.currentState === 'PITCHING' && (
        <GameplayScreen
          gameState={gameState}
          trackingFrame={trackingFrame}
          locale={gameState.locale}
          onResetGame={() => gameStateMachine.resetToAttract()}
        />
      )}

      {gameState.currentState === 'GAME_RESULT' && (
        <ResultScreen
          gameState={gameState}
          locale={gameState.locale}
          onPlayAgain={() => gameStateMachine.startNewGame()}
        />
      )}

      {/* Dynamic Hand / Glove Dwell Cursor */}
      <HandCursor
        trackingFrame={trackingFrame}
        dwellProgress={dwellProgress}
        isGameplayMode={isGameplayMode}
        targetRadiusPx={140}
      />

      {/* Admin / Debug Modal */}
      <AdminDebugModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        trackingFrame={trackingFrame}
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
        onReset={() => gameStateMachine.resetToAttract()}
      />
    </main>
  );
};
