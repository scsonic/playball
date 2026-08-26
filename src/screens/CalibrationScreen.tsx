import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Hand, User, Sun, ArrowRight, RefreshCw } from 'lucide-react';
import { Locale, TrackingFrame } from '../types/game';
import { LOCALES } from '../locales';
import { DwellButton } from '../interaction/DwellButton';

interface CalibrationScreenProps {
  locale: Locale;
  trackingFrame: TrackingFrame;
  videoElement: HTMLVideoElement | null;
  targetHand: 'left' | 'right';
  onCalibrationComplete: () => void;
  onToggleTargetHand: () => void;
  onRetryCamera: () => void;
}

export const CalibrationScreen: React.FC<CalibrationScreenProps> = ({
  locale,
  trackingFrame,
  videoElement,
  targetHand,
  onCalibrationComplete,
  onToggleTargetHand,
  onRetryCamera
}) => {
  const t = LOCALES[locale];
  const [calibProgress, setCalibProgress] = useState<number>(0);

  const { personDetected, handDetected, palmOpen, confidence } = trackingFrame;
  const isReady = personDetected && handDetected && palmOpen && confidence >= 0.5;

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isReady) {
      interval = setInterval(() => {
        setCalibProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            onCalibrationComplete();
            return 100;
          }
          return prev + 10;
        });
      }, 80);
    } else {
      setCalibProgress(0);
    }

    return () => clearInterval(interval);
  }, [isReady, onCalibrationComplete]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-6 md:p-8 bg-slate-950 text-white select-none overflow-hidden">
      {/* Title Header */}
      <div className="text-center z-10">
        <h2 className="text-3xl md:text-4xl font-black gold-text-gradient mb-2">
          {t.calibrationTitle}
        </h2>
        <p className="text-slate-300 text-sm md:text-base font-semibold">
          {t.stepBackInstruction}
        </p>
      </div>

      {/* Main Calibration Preview Area */}
      <div className="relative w-full max-w-4xl flex-1 flex flex-col items-center justify-center my-4 z-10">
        <div className="relative w-full max-w-2xl aspect-video rounded-3xl overflow-hidden border-4 border-slate-700/80 bg-slate-900 shadow-2xl flex items-center justify-center">
          {/* Mirrored Camera View Canvas or Video Ref */}
          {videoElement ? (
            <video
              ref={(ref) => {
                if (ref && videoElement.srcObject && ref.srcObject !== videoElement.srcObject) {
                  ref.srcObject = videoElement.srcObject;
                  ref.play().catch(() => {});
                }
              }}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          ) : (
            <div className="flex flex-col items-center text-slate-500">
              <User className="w-16 h-16 animate-pulse mb-2" />
              <span>Camera Preview</span>
            </div>
          )}

          {/* Guide Overlay / Target Hand Silhouette */}
          <div className="absolute inset-0 border-4 border-emerald-500/40 rounded-3xl pointer-events-none flex items-center justify-center">
            {/* Guide Palm Target Zone */}
            <div
              className={`w-40 h-40 rounded-3xl border-4 border-dashed flex flex-col items-center justify-center transition-all duration-300 ${
                isReady
                  ? 'border-emerald-400 bg-emerald-500/20 scale-105 shadow-[0_0_30px_rgba(52,211,153,0.6)]'
                  : 'border-white/40 bg-black/30'
              }`}
            >
              <Hand className={`w-16 h-16 ${isReady ? 'text-emerald-300 animate-bounce' : 'text-white/60'}`} />
              <span className="text-xs font-bold mt-1 uppercase text-center px-2">
                {targetHand === 'left' ? 'Left Palm' : 'Right Palm'}
              </span>
            </div>
          </div>

          {/* Calibration Progress Bar inside Camera Box */}
          {isReady && (
            <div className="absolute bottom-4 left-6 right-6">
              <div className="flex justify-between text-xs font-bold text-emerald-300 mb-1">
                <span>{t.holdStillInstruction}</span>
                <span>{calibProgress}%</span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-emerald-500/40">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all duration-100"
                  style={{ width: `${calibProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Checklist Indicators & Hand Switch */}
      <div className="w-full max-w-4xl flex flex-col md:flex-row items-center justify-between gap-4 z-10">
        {/* Status Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full md:w-auto">
          <div className="glass-panel px-4 py-2.5 rounded-xl flex items-center space-x-2 text-xs font-bold">
            <User className="w-4 h-4 text-blue-400" />
            <span>{t.personDetected}</span>
            {personDetected ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto" />
            ) : (
              <AlertCircle className="w-4 h-4 text-slate-500 ml-auto" />
            )}
          </div>

          <div className="glass-panel px-4 py-2.5 rounded-xl flex items-center space-x-2 text-xs font-bold">
            <Hand className="w-4 h-4 text-amber-400" />
            <span>{targetHand === 'left' ? t.handDetected : '右手検出'}</span>
            {handDetected ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto" />
            ) : (
              <AlertCircle className="w-4 h-4 text-slate-500 ml-auto" />
            )}
          </div>

          <div className="glass-panel px-4 py-2.5 rounded-xl flex items-center space-x-2 text-xs font-bold">
            <Hand className="w-4 h-4 text-emerald-400" />
            <span>{t.palmOpen}</span>
            {palmOpen ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto" />
            ) : (
              <AlertCircle className="w-4 h-4 text-slate-500 ml-auto" />
            )}
          </div>

          <div className="glass-panel px-4 py-2.5 rounded-xl flex items-center space-x-2 text-xs font-bold">
            <Sun className="w-4 h-4 text-yellow-400" />
            <span>{t.lightingQuality}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto" />
          </div>
        </div>

        {/* Hand Toggle & Skip Calibration */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onToggleTargetHand}
            className="px-4 py-2.5 bg-slate-800/90 border border-slate-600 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all flex items-center space-x-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{targetHand === 'left' ? 'Switch to Right Hand' : 'Switch to Left Hand'}</span>
          </button>

          <DwellButton
            id="calib-proceed-btn"
            onDwellTrigger={onCalibrationComplete}
            variant="green"
            className="text-xs py-3 px-5 flex items-center space-x-2"
          >
            <span>Proceed</span>
            <ArrowRight className="w-4 h-4" />
          </DwellButton>
        </div>
      </div>
    </div>
  );
};
