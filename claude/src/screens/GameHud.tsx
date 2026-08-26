import type { CampaignConfig } from '../config/campaign.config';
import type { Dictionary } from '../i18n';
import { DwellButton } from '../interaction/DwellButton';
import type { PitchOutcome } from '../types';

interface GameHudProps {
  dict: Dictionary;
  config: CampaignConfig;
  pitchIndex: number;
  catches: number;
  outcomes: PitchOutcome[];
  trackingConfidence: number;
  tracked: boolean;
  onReset: () => void;
  showReady: boolean;
}

/**
 * Gameplay HUD.
 *
 * Re-renders only when the score changes — the ball, glove and stadium all live
 * on the canvas underneath, so a pitch in flight costs zero React work.
 */
export function GameHud({
  dict,
  config,
  pitchIndex,
  catches,
  outcomes,
  trackingConfidence,
  tracked,
  onReset,
  showReady,
}: GameHudProps) {
  const pips = Array.from({ length: config.totalPitches }, (_, i) => outcomes[i] ?? null);

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-[2.2vmin]">
      <div className="flex items-start justify-between">
        <div className="hud-card flex items-center gap-[2.4vmin] px-[2.2vmin] py-[1.4vmin]">
          <Stat label={dict.hudPitch} value={`${Math.min(pitchIndex, config.totalPitches)}/${config.totalPitches}`} />
          <div className="h-[4vmin] w-px bg-white/20" />
          <Stat label={dict.hudCatches} value={`${catches}`} accent />
          <div className="h-[4vmin] w-px bg-white/20" />
          <div>
            <p className="eyebrow opacity-60">{dict.hudTarget}</p>
            <div className="mt-[0.6vmin] flex gap-[0.6vmin]">
              {pips.map((outcome, i) => (
                <span
                  key={i}
                  className={`pip ${outcome === 'catch' ? 'pip--hit' : outcome === 'miss' ? 'pip--miss' : ''}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-[0.8vmin]">
          <div className="hud-card flex items-center gap-[1vmin] px-[1.4vmin] py-[0.8vmin]">
            <span className={`status-dot ${tracked ? 'status-dot--on' : ''}`} />
            <span className="body-lg">
              {dict.hudTracking} {Math.round(trackingConfidence * 100)}%
            </span>
          </div>
          <div className="hud-card flex items-center gap-[0.8vmin] px-[1.4vmin] py-[0.7vmin] opacity-80">
            <span aria-hidden="true">🔒</span>
            <span className="body-lg">{dict.hudCameraLocal}</span>
          </div>
        </div>
      </div>

      {showReady && (
        <div className="mx-auto mb-[6vmin] text-center">
          <p className="display text-[clamp(1.4rem,3.4vmin,3.4rem)]">{dict.readyTitle}</p>
          <p className="body-lg fade-loop mt-[0.8vmin] opacity-85">{dict.readyBody}</p>
        </div>
      )}

      {/* Reset sits bottom-right: away from the catch corridor, and clear of the
          camera monitor in the opposite corner. */}
      <div className="pointer-events-auto flex justify-end">
        <DwellButton id="game-reset" variant="ghost" durationMs={2600} onSelect={onReset}>
          ↺ {dict.reset}
        </DwellButton>
      </div>
    </div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="eyebrow opacity-60">{label}</p>
      <p
        className={`display text-[clamp(1.4rem,3.2vmin,3.4rem)] ${accent ? 'text-[#8dc63f]' : ''}`}
      >
        {value}
      </p>
    </div>
  );
}
