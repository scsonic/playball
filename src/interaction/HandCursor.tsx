import React from 'react';
import { TrackingFrame } from '../types/game';

interface HandCursorProps {
  trackingFrame: TrackingFrame;
  dwellProgress: number;
  isGameplayMode: boolean;
  targetRadiusPx?: number;
}

export const HandCursor: React.FC<HandCursorProps> = ({
  trackingFrame,
  dwellProgress,
  isGameplayMode,
  targetRadiusPx = 140
}) => {
  const { handDetected, palmOpen, confidence, screenPos } = trackingFrame;

  // Don't render cursor if no hand detected and not in simulation
  const opacity = handDetected ? Math.min(1.0, confidence * 1.5) : 0;
  if (opacity <= 0.05) return null;

  const circumference = 2 * Math.PI * 28; // radius 28
  const strokeDashoffset = circumference - dwellProgress * circumference;

  return (
    <div
      className="fixed pointer-events-none z-50 transition-opacity duration-200"
      style={{
        left: `${screenPos.x}px`,
        top: `${screenPos.y}px`,
        transform: 'translate(-50%, -50%)',
        opacity
      }}
    >
      {isGameplayMode ? (
        /* Gameplay Mode: Catcher's Mitt / Open Palm Catch Zone */
        <div className="relative flex items-center justify-center">
          {/* Catch Radius Circle / Hitbox Visual */}
          <div
            className={`rounded-full border-2 border-dashed transition-all duration-150 ${
              palmOpen
                ? 'border-emerald-400 bg-emerald-500/15 scale-100 shadow-[0_0_25px_rgba(52,211,153,0.6)]'
                : 'border-amber-400/60 bg-amber-500/10 scale-90'
            }`}
            style={{
              width: `${targetRadiusPx * 2}px`,
              height: `${targetRadiusPx * 2}px`
            }}
          />

          {/* Catcher's Glove Icon / Open Palm Glyph in Center */}
          <div className="absolute flex flex-col items-center justify-center">
            <svg
              className={`w-14 h-14 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)] transition-transform duration-150 ${
                palmOpen ? 'scale-110 text-emerald-300' : 'scale-95 text-amber-300'
              }`}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              {/* Stylized Baseball Catcher Mitt / Open Hand Path */}
              <path d="M12 2C8.5 2 6 4.5 6 8v3.5c0 1.2.6 2.3 1.6 2.9L10 16v4c0 1.1.9 2 2 2h4c1.1 0 2-.9 2-2v-9c0-.6-.4-1-1-1s-1 .4-1 1v2h-1V6c0-.6-.4-1-1-1s-1 .4-1 1v7h-1V4c0-.6-.4-1-1-1s-1 .4-1 1v9h-1V8c0-2.2 1.8-4 4-4 .6 0 1 .4 1 1V6h2c1.7 0 3 1.3 3 3v7c0 2.8-2.2 5-5 5h-4c-2.2 0-4-1.8-4-4v-4.5C4 8.5 7.5 4 12 2z" />
            </svg>
            <span
              className={`mt-1 text-[11px] font-black uppercase px-2 py-0.5 rounded-full backdrop-blur-md ${
                palmOpen
                  ? 'bg-emerald-500/80 text-slate-950'
                  : 'bg-amber-500/80 text-slate-950'
              }`}
            >
              {palmOpen ? 'READY' : 'OPEN PALM'}
            </span>
          </div>
        </div>
      ) : (
        /* Menu Mode: Circular Dwell Selection Reticle */
        <div className="relative flex items-center justify-center w-16 h-16">
          {/* Outer SVG Progress Ring */}
          <svg className="w-16 h-16 -rotate-90">
            {/* Background track */}
            <circle
              cx="32"
              cy="32"
              r="28"
              className="text-white/20 stroke-current"
              strokeWidth="4"
              fill="none"
            />
            {/* Active progress fill */}
            <circle
              cx="32"
              cy="32"
              r="28"
              className="text-emerald-400 stroke-current drop-shadow-[0_0_8px_rgba(52,211,153,0.9)]"
              strokeWidth="5"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="none"
              style={{
                transition: 'stroke-dashoffset 50ms linear'
              }}
            />
          </svg>

          {/* Center Point Reticle */}
          <div className="absolute w-4 h-4 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,1)] border-2 border-emerald-500" />
        </div>
      )}
    </div>
  );
};
