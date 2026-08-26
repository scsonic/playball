import React from 'react';
import { Trophy, Hand, Sparkles, Gift } from 'lucide-react';
import { Locale } from '../types/game';
import { LOCALES } from '../locales';
import { DwellButton } from '../interaction/DwellButton';

interface AttractScreenProps {
  locale: Locale;
  onStartGame: () => void;
  onSelectLocale: (loc: Locale) => void;
}

export const AttractScreen: React.FC<AttractScreenProps> = ({
  locale,
  onStartGame,
  onSelectLocale
}) => {
  const t = LOCALES[locale];

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-8 text-white select-none overflow-hidden">
      {/* Top Banner & Language Chips */}
      <div className="w-full flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          <div className="px-4 py-1.5 bg-itoen-dark/90 border border-emerald-400/40 rounded-full text-emerald-300 text-xs md:text-sm font-black tracking-wide shadow-lg flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>ITO EN × WBC 体感キャッチブース</span>
          </div>
          <div className="hidden sm:block px-3 py-1 bg-amber-500/20 border border-amber-400/40 rounded-full text-amber-300 text-xs font-bold">
            {t.conceptDemoBadge}
          </div>
        </div>

        {/* Quick Locale Selector */}
        <div className="flex items-center bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-xl p-1 shadow-lg">
          {(['ja', 'en', 'zh-TW'] as Locale[]).map((loc) => (
            <button
              key={loc}
              onClick={() => onSelectLocale(loc)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                locale === loc
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {loc === 'ja' ? '日本語' : loc === 'en' ? 'EN' : '繁中'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Center Signage Title & Start Call to Action */}
      <div className="flex flex-col items-center text-center my-auto max-w-4xl mx-auto z-10">
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight mb-4 stadium-text-stroke">
          <span className="gold-text-gradient">{t.attractHeadline}</span>
        </h1>
        <p className="text-xl sm:text-3xl text-emerald-300 font-extrabold mb-8 drop-shadow-lg">
          {t.attractSubheadline}
        </p>

        {/* 3 Step Tutorial Pill Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl w-full mb-10">
          <div className="glass-panel-green rounded-2xl p-4 flex items-center space-x-4 text-left">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/30 border border-emerald-400/50 flex items-center justify-center flex-shrink-0">
              <Trophy className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <p className="text-xs text-emerald-200 uppercase font-bold tracking-wider">Mission</p>
              <p className="text-sm md:text-base font-bold text-white">{t.ruleCatches}</p>
            </div>
          </div>

          <div className="glass-panel-green rounded-2xl p-4 flex items-center space-x-4 text-left">
            <div className="w-12 h-12 rounded-xl bg-amber-500/30 border border-amber-400/50 flex items-center justify-center flex-shrink-0">
              <Gift className="w-6 h-6 text-yellow-300" />
            </div>
            <div>
              <p className="text-xs text-amber-200 uppercase font-bold tracking-wider">Reward</p>
              <p className="text-sm md:text-base font-bold text-white">{t.ruleReward}</p>
            </div>
          </div>
        </div>

        {/* Giant Dwell Start Button */}
        <div className="flex flex-col items-center space-y-3">
          <DwellButton
            id="attract-start-btn"
            onDwellTrigger={onStartGame}
            variant="gold"
            className="text-2xl sm:text-3xl py-6 px-12 sm:px-16 shadow-[0_0_50px_rgba(234,179,8,0.5)] border-4 border-yellow-200"
          >
            <div className="flex items-center space-x-3">
              <Hand className="w-8 h-8 animate-pulse text-slate-950" />
              <span>{t.startButton}</span>
            </div>
          </DwellButton>
          <span className="text-xs sm:text-sm text-amber-200/90 font-bold tracking-wide uppercase bg-slate-900/60 px-4 py-1 rounded-full border border-amber-400/30">
            {t.raiseHandToStart}
          </span>
        </div>
      </div>

      {/* Bottom Sponsor Ribbon Footer */}
      <div className="w-full flex items-center justify-between z-10 text-xs text-slate-400 border-t border-white/10 pt-4">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-emerald-400">伊藤園 お〜いお茶</span>
          <span>Official Event Activation Experience</span>
        </div>
        <div>
          <span>Non-Touch Dwell & Motion Sensor Active</span>
        </div>
      </div>
    </div>
  );
};
