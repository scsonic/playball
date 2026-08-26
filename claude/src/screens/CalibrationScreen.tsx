import { useEffect, useRef } from 'react';
import type { CampaignConfig } from '../config/campaign.config';
import type { Dictionary } from '../i18n';
import { DwellButton } from '../interaction/DwellButton';
import type { HandMode, TrackingDiagnostics } from '../types';
import { camera } from '../vision/Camera';

interface CalibrationScreenProps {
  dict: Dictionary;
  config: CampaignConfig;
  diagnostics: TrackingDiagnostics;
  progress: number;
  handMode: HandMode;
  onHandMode: (mode: HandMode) => void;
  onSkip: () => void;
}

/**
 * Calibration: a mirrored preview plus live, honest status indicators.
 * The player is never told to "wait" without being told exactly what is missing.
 */
export function CalibrationScreen({
  dict,
  config,
  diagnostics,
  progress,
  handMode,
  onHandMode,
  onSkip,
}: CalibrationScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const source = camera.getVideo();
    const el = videoRef.current;
    if (!source || !el) return;
    // Re-use the existing MediaStream: no second getUserMedia prompt.
    el.srcObject = source.srcObject;
    el.play().catch(() => undefined);
    return () => {
      el.srcObject = null;
    };
  }, []);

  const instruction = !diagnostics.personDetected
    ? dict.calibrationStepBack
    : !diagnostics.handDetected
      ? dict.calibrationRaiseHand
      : !diagnostics.palmOpen
        ? dict.calibrationOpenPalm
        : dict.calibrationHoldStill;

  return (
    <div className="screen items-center justify-center gap-[2.4vmin]">
      <h1 className="display text-[clamp(1.6rem,4vmin,4rem)]">{dict.calibrationTitle}</h1>
      <p className="subhead fade-loop text-[#8dc63f]">{instruction}</p>

      <div className="flex w-full max-w-[150vmin] flex-1 items-center justify-center gap-[3vmin]">
        <div className="panel relative aspect-video w-[62%] overflow-hidden p-[0.8vmin]">
          <video
            ref={videoRef}
            muted
            playsInline
            className="h-full w-full rounded-[1.4vmin] object-cover"
            style={{ transform: config.cameraMirrored ? 'scaleX(-1)' : 'none' }}
          />
          {/* Framing guide */}
          <div className="pointer-events-none absolute inset-[8%] rounded-[2vmin] border-[0.4vmin] border-dashed border-white/35" />
          <div className="absolute bottom-[1.4vmin] left-1/2 w-[80%] -translate-x-1/2">
            <div className="h-[1.1vmin] overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#8dc63f] to-[#2ea44f] transition-[width] duration-150"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="body-lg mt-[0.6vmin] text-center opacity-80">
              {dict.calibrationProgress} {Math.round(progress * 100)}%
            </p>
          </div>
        </div>

        <div className="panel flex w-[34%] flex-col gap-[1.4vmin] p-[2.4vmin]">
          <Status on={diagnostics.personDetected} label={dict.statusPerson} />
          <Status on={diagnostics.handDetected && diagnostics.correctHand} label={dict.statusHand} />
          <Status on={diagnostics.palmOpen} label={dict.statusPalm} />
          <Status
            on={diagnostics.lighting === 'good'}
            label={`${dict.statusLighting}: ${diagnostics.lighting}`}
          />
          <Status on={diagnostics.distance === 'ok'} label={`${dict.statusDistance}: ${diagnostics.distance}`} />

          <div className="mt-[1vmin] flex flex-wrap gap-[0.8vmin]">
            <DwellButton
              id="hand-left"
              variant="chip"
              className={handMode === 'left' ? 'chip-active' : ''}
              onSelect={() => onHandMode('left')}
            >
              {dict.handModeLeft}
            </DwellButton>
            <DwellButton
              id="hand-right"
              variant="chip"
              className={handMode === 'right' ? 'chip-active' : ''}
              onSelect={() => onHandMode('right')}
            >
              {dict.handModeRight}
            </DwellButton>
          </div>

          <DwellButton id="skip-calibration" variant="ghost" className="mt-auto" onSelect={onSkip}>
            {dict.skipCalibration} →
          </DwellButton>
        </div>
      </div>
    </div>
  );
}

function Status({ on, label }: { on: boolean; label: string }) {
  return (
    <div className="body-lg flex items-center gap-[1.2vmin]">
      <span className={`status-dot ${on ? 'status-dot--on' : ''}`} />
      <span className={on ? 'opacity-100' : 'opacity-55'}>{label}</span>
    </div>
  );
}
