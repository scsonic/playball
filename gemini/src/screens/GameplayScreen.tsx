import React, { useEffect, useRef, useState } from 'react';
import { Trophy, RefreshCw, Activity, Sparkles } from 'lucide-react';
import { gameEngine } from '../game/GameEngine';
import { visionSimulator } from '../vision/VisionSimulator';
import { soundService } from '../audio/SoundService';
import { GameStoreState } from '../state/gameStateMachine';
import { TrackingFrame, Locale } from '../types/game';
import { LOCALES } from '../locales';
import { DwellButton } from '../interaction/DwellButton';

interface GameplayScreenProps {
  gameState: GameStoreState;
  trackingFrameRef: React.MutableRefObject<TrackingFrame>;
  trackingFrame: TrackingFrame;
  locale: Locale;
  onResetGame: () => void;
}

export const GameplayScreen: React.FC<GameplayScreenProps> = ({
  gameState,
  trackingFrameRef,
  trackingFrame,
  locale,
  onResetGame
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const t = LOCALES[locale];

  const [countdownNum, setCountdownNum] = useState<number | null>(3);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    gameEngine.setCanvas(canvas);

    const handlePointer = (e: MouseEvent | PointerEvent) => {
      visionSimulator.setSimulatedPosition(e.clientX, e.clientY, true);
    };

    window.addEventListener('mousemove', handlePointer, { passive: true });
    window.addEventListener('pointermove', handlePointer, { passive: true });

    let animationId: number;
    const loop = (time: number) => {
      const frame = trackingFrameRef.current;
      gameEngine.updateAndRender(time, frame);
      animationId = requestAnimationFrame(loop);
    };
    animationId = requestAnimationFrame(loop);

    const handleResize = () => gameEngine.handleResize();
    window.addEventListener('resize', handleResize);

    // Dynamic 3 -> 2 -> 1 -> PLAY! countdown
    let currentCount = 3;
    soundService.playCountdown(440, 0.2);

    const countdownTimer = setInterval(() => {
      currentCount -= 1;
      if (currentCount > 0) {
        setCountdownNum(currentCount);
        soundService.playCountdown(440 + (3 - currentCount) * 110, 0.2);
      } else if (currentCount === 0) {
        setCountdownNum(0); // PLAY!
        soundService.playCountdown(880, 0.35);
      } else {
        clearInterval(countdownTimer);
        setCountdownNum(null);
        gameEngine.startPitchSequence();
      }
    }, 750);

    return () => {
      clearInterval(countdownTimer);
      cancelAnimationFrame(animationId);
      window.removeEventListener('mousemove', handlePointer);
      window.removeEventListener('pointermove', handlePointer);
      window.removeEventListener('resize', handleResize);
    };
  }, [trackingFrameRef]);

  const handleSkipCountdown = () => {
    if (countdownNum !== null) {
      setCountdownNum(null);
      gameEngine.startPitchSequence();
    }
  };

  const { currentPitchIndex, totalPitches, catchesCount, requiredCatches } = gameState;

  return (
    <div
      onClick={handleSkipCountdown}
      className="relative w-full h-full overflow-hidden select-none cursor-crosshair"
    >
      {/* 2.5D Canvas View */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
      />

      {/* Countdown Overlay (Floats smoothly directly over the stadium) */}
      {countdownNum !== null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30 bg-black/30 backdrop-blur-[2px] transition-all">
          <div className="flex flex-col items-center animate-pulse">
            <span className="text-xl md:text-2xl font-black uppercase text-emerald-300 tracking-widest mb-3 bg-slate-950/80 px-6 py-2 rounded-full border border-emerald-500/50 shadow-xl flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span>{t.countdownGetReady}</span>
            </span>

            {/* Giant Gold Number */}
            <div className="text-8xl sm:text-9xl md:text-[13rem] font-black gold-text-gradient stadium-text-stroke transform scale-110 drop-shadow-2xl">
              {countdownNum > 0 ? countdownNum : 'PLAY!'}
            </div>

            <span className="mt-6 text-xs font-bold text-amber-200 uppercase tracking-wider bg-slate-900/80 px-4 py-1.5 rounded-full border border-amber-400/40">
              Move glove to catch incoming balls • Click to skip
            </span>
          </div>
        </div>
      )}

      {/* Top HUD: Score & Pitch Trackers */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between pointer-events-none z-20">
        {/* Pitch Tracker & Target Box */}
        <div className="glass-panel rounded-2xl px-6 py-3 flex items-center space-x-6">
          {/* Pitch Count */}
          <div className="text-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
              {t.pitchCountLabel}
            </span>
            <span className="text-2xl sm:text-3xl font-black text-white">
              {Math.min(totalPitches, currentPitchIndex)} / {totalPitches}
            </span>
          </div>

          <div className="w-px h-8 bg-slate-700" />

          {/* Catch Count & Target Goal Indicator */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-widest block">
                {t.catchCountLabel}
              </span>
              <div className="flex items-center space-x-1.5 mt-0.5">
                {[...Array(totalPitches)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-3.5 h-3.5 rounded-full border transition-all duration-300 ${
                      i < catchesCount
                        ? 'bg-emerald-400 border-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.8)] scale-110'
                        : i < requiredCatches
                        ? 'border-amber-400/70 bg-amber-500/20'
                        : 'border-slate-600 bg-slate-800'
                    }`}
                  />
                ))}
                <span className="text-xs font-black text-amber-300 ml-1.5">
                  ({t.targetCatchesLabel})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tracking Confidence Indicator & Reset */}
        <div className="flex items-center space-x-3 pointer-events-auto">
          {/* Hand Tracking Confidence Meter */}
          <div className="glass-panel rounded-2xl px-4 py-2.5 flex items-center space-x-2 text-xs font-bold text-slate-300">
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>{t.confidenceMeter}: {Math.round(trackingFrame.confidence * 100)}%</span>
          </div>

          {/* Subtle Reset Button */}
          <DwellButton
            id="gameplay-reset-btn"
            onDwellTrigger={onResetGame}
            variant="ghost"
            className="text-xs py-2.5 px-4 flex items-center space-x-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t.resetBtn}</span>
          </DwellButton>
        </div>
      </div>
    </div>
  );
};
