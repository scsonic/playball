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
  flipVertical: boolean;
  onHandMode: (mode: HandMode) => void;
  onFlipVertical: () => void;
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
  flipVertical,
  onHandMode,
  onFlipVertical,
  onSkip,
}: CalibrationScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    // One stream for both transports: the webcam's own MediaStream, or a canvas
    // capture of the frames a native host is pushing in. No second permission prompt.
    const stream = camera.getPreviewStream();
    if (!stream || !el) return;
    el.srcObject = stream;
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

      {/* Portrait totems stack; landscape walls sit side by side. */}
      <div className="flex w-full max-w-[150vmin] flex-1 flex-col items-center justify-center gap-[2vmin] landscape:flex-row landscape:gap-[3vmin]">
        <div className="panel relative aspect-video w-full overflow-hidden p-[0.8vmin] landscape:w-[62%]">
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

        <div className="panel flex w-full flex-col gap-[1.4vmin] p-[2.4vmin] landscape:w-[34%]">
          <Status on={diagnostics.personDetected} label={dict.statusPerson} />
          <Status on={diagnostics.handDetected && diagnostics.correctHand} label={dict.statusHand} />
          <Status on={diagnostics.palmOpen} label={dict.statusPalm} />
          <Status
            on={diagnostics.lighting === 'good'}
            label={`${dict.statusLighting}: ${diagnostics.lighting}`}
          />
          <Status on={diagnostics.distance === 'ok'} label={`${dict.statusDistance}: ${diagnostics.distance}`} />
          <p className="eyebrow opacity-45">{camera.getLabel()}</p>

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
            {/* Inverted camera mounts: flipping here corrects the frames themselves,
                so tracking follows the picture. */}
            <DwellButton
              id="flip-camera"
              variant="chip"
              className={flipVertical ? 'chip-active' : ''}
              onSelect={onFlipVertical}
            >
              {flipVertical ? '☑' : '☐'} ⇅ {dict.flipCamera}
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
