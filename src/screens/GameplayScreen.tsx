import React, { useEffect, useRef } from 'react';
import { Trophy, RefreshCw, Activity } from 'lucide-react';
import { gameEngine } from '../game/GameEngine';
import { gameStateMachine, GameStoreState } from '../state/gameStateMachine';
import { TrackingFrame, Locale } from '../types/game';
import { LOCALES } from '../locales';
import { DwellButton } from '../interaction/DwellButton';

interface GameplayScreenProps {
  gameState: GameStoreState;
  trackingFrame: TrackingFrame;
  locale: Locale;
  onResetGame: () => void;
}

export const GameplayScreen: React.FC<GameplayScreenProps> = ({
  gameState,
  trackingFrame,
  locale,
  onResetGame
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const t = LOCALES[locale];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    gameEngine.setCanvas(canvas);
    gameEngine.startPitchSequence();

    let animationId: number;
    const loop = (time: number) => {
      gameEngine.updateAndRender(time, trackingFrame);
      animationId = requestAnimationFrame(loop);
    };
    animationId = requestAnimationFrame(loop);

    const handleResize = () => gameEngine.handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const { currentPitchIndex, totalPitches, catchesCount, requiredCatches } = gameState;

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* 2.5D Canvas View */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
      />

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
