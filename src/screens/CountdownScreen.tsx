import React, { useEffect, useState, useRef } from 'react';
import { soundService } from '../audio/SoundService';
import { Locale } from '../types/game';
import { LOCALES } from '../locales';

interface CountdownScreenProps {
  locale: Locale;
  onCountdownComplete: () => void;
}

export const CountdownScreen: React.FC<CountdownScreenProps> = ({
  locale,
  onCountdownComplete
}) => {
  const t = LOCALES[locale];
  const [count, setCount] = useState<number>(3);
  const onCompleteRef = useRef(onCountdownComplete);
  onCompleteRef.current = onCountdownComplete;

  useEffect(() => {
    let current = 3;
    soundService.playCountdown(440, 0.2);

    const interval = setInterval(() => {
      current -= 1;
      if (current > 0) {
        setCount(current);
        soundService.playCountdown(440 + (3 - current) * 110, 0.2);
      } else if (current === 0) {
        setCount(0); // PLAY BALL!
        soundService.playCountdown(880, 0.4);
      } else {
        clearInterval(interval);
        onCompleteRef.current();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []); // Run once on mount!

  const handleSkip = () => {
    onCompleteRef.current();
  };

  return (
    <div
      onClick={handleSkip}
      className="relative w-full h-full flex flex-col items-center justify-center p-8 text-white select-none cursor-pointer"
      title="Click anywhere to start pitch immediately"
    >
      <div className="flex flex-col items-center z-10 pointer-events-none">
        <p className="text-xl sm:text-2xl font-black uppercase text-emerald-300 tracking-widest mb-4 bg-slate-900/70 px-6 py-2 rounded-full border border-emerald-500/40">
          {t.countdownGetReady}
        </p>

        {/* Huge Animated Countdown Number */}
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 w-44 h-44 sm:w-60 sm:h-60 rounded-full bg-amber-500/20 blur-3xl animate-ping" />
          <div className="text-8xl sm:text-9xl md:text-[14rem] font-black gold-text-gradient stadium-text-stroke transform transition-all duration-300 scale-110">
            {count > 0 ? count : 'PLAY!'}
          </div>
        </div>

        <p className="mt-8 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-950/60 px-4 py-1.5 rounded-full border border-white/10">
          Click anywhere to skip countdown
        </p>
      </div>
    </div>
  );
};
