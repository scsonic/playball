import React from 'react';
import { ShieldCheck, Camera, MousePointer, Volume2, VolumeX, Maximize, Minimize, Globe } from 'lucide-react';
import { Locale } from '../types/game';
import { LOCALES } from '../locales';
import { DwellButton } from '../interaction/DwellButton';

interface BootScreenProps {
  locale: Locale;
  audioEnabled: boolean;
  isFullscreen: boolean;
  onSelectLocale: (loc: Locale) => void;
  onToggleAudio: () => void;
  onToggleFullscreen: () => void;
  onEnableCamera: () => void;
  onStartMouseDemo: () => void;
}

export const BootScreen: React.FC<BootScreenProps> = ({
  locale,
  audioEnabled,
  isFullscreen,
  onSelectLocale,
  onToggleAudio,
  onToggleFullscreen,
  onEnableCamera,
  onStartMouseDemo
}) => {
  const t = LOCALES[locale];

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-8 bg-gradient-to-b from-slate-950 via-slate-900 to-itoen-dark text-white overflow-hidden select-none">
      {/* Background Stadium Glow Elements */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header & Settings Bar */}
      <div className="w-full max-w-6xl flex items-center justify-between z-10">
        {/* Concept Badge & Sponsor Slot */}
        <div className="flex items-center space-x-3">
          <div className="px-3 py-1 bg-amber-500/20 border border-amber-400/40 rounded-full text-amber-300 text-xs font-bold uppercase tracking-wider">
            {t.conceptDemoBadge}
          </div>
          <div className="px-3 py-1 bg-emerald-950/80 border border-emerald-500/30 rounded-full text-emerald-300 text-xs font-bold">
            ITO EN Official Sponsor Slot
          </div>
        </div>

        {/* Controls: Audio, Fullscreen, Locale */}
        <div className="flex items-center space-x-3">
          {/* Language Selector */}
          <div className="flex items-center bg-slate-800/80 border border-slate-700/60 rounded-xl p-1">
            <Globe className="w-4 h-4 text-slate-400 ml-2 mr-1" />
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

          {/* Audio Toggle */}
          <button
            onClick={onToggleAudio}
            className="p-2.5 bg-slate-800/80 border border-slate-700/60 rounded-xl text-slate-300 hover:text-white transition-all"
            title={audioEnabled ? t.audioOn : t.audioOff}
          >
            {audioEnabled ? <Volume2 className="w-5 h-5 text-emerald-400" /> : <VolumeX className="w-5 h-5 text-rose-400" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={onToggleFullscreen}
            className="p-2.5 bg-slate-800/80 border border-slate-700/60 rounded-xl text-slate-300 hover:text-white transition-all"
            title={isFullscreen ? t.exitFullscreenBtn : t.fullscreenBtn}
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Center Hero: Title & Animated Baseball Indicator */}
      <div className="flex flex-col items-center justify-center text-center max-w-3xl z-10 my-auto">
        {/* Animated Baseball Spinning Icon */}
        <div className="relative w-28 h-28 mb-6 flex items-center justify-center">
          <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl animate-pulse" />
          <div className="relative w-24 h-24 rounded-full bg-white shadow-2xl flex items-center justify-center border-4 border-slate-200 animate-spin" style={{ animationDuration: '6s' }}>
            {/* Baseball Red Stitches */}
            <div className="absolute inset-2 rounded-full border-2 border-dashed border-red-600 opacity-80" />
            <div className="w-4 h-4 rounded-full bg-slate-200/50" />
          </div>
        </div>

        <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-3 stadium-text-stroke">
          <span className="gold-text-gradient">{t.campaignConcept}</span>
        </h1>
        <p className="text-xl md:text-2xl text-emerald-300 font-bold mb-8 drop-shadow-md">
          {t.attractSubheadline}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-5 w-full justify-center max-w-md">
          <DwellButton
            id="boot-enable-camera"
            onDwellTrigger={onEnableCamera}
            variant="green"
            className="w-full sm:w-auto text-lg py-5 px-8 flex items-center justify-center gap-3 shadow-xl"
          >
            <Camera className="w-6 h-6" />
            {t.enableCameraBtn}
          </DwellButton>

          <DwellButton
            id="boot-mouse-demo"
            onDwellTrigger={onStartMouseDemo}
            variant="secondary"
            className="w-full sm:w-auto text-sm py-4 px-6 flex items-center justify-center gap-2"
          >
            <MousePointer className="w-5 h-5 text-slate-300" />
            {t.demoWithoutCameraBtn}
          </DwellButton>
        </div>
      </div>

      {/* Bottom Privacy Card */}
      <div className="w-full max-w-3xl glass-panel rounded-2xl p-4 flex items-center space-x-4 z-10">
        <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400 flex-shrink-0">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <div className="text-left text-xs md:text-sm">
          <p className="font-bold text-slate-200">{t.cameraLocalPrivacy}</p>
          <p className="text-slate-400 mt-0.5">{t.cameraNoUpload}</p>
        </div>
      </div>
    </div>
  );
};
