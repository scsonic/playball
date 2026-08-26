import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    soundService.playCountdown(440 + (3 - count) * 110, 0.2);

    if (count > 1) {
      const timer = setTimeout(() => {
        setCount(count - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (count === 1) {
      const timer = setTimeout(() => {
        setCount(0); // PLAY BALL / CATCH!
        soundService.playCountdown(880, 0.4);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        onCountdownComplete();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [count, onCountdownComplete]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-8 text-white select-none pointer-events-none">
      <div className="flex flex-col items-center z-10">
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
      </div>
    </div>
  );
};
