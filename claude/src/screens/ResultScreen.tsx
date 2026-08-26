import { SponsorBadge } from '../components/SponsorBadge';
import type { CampaignConfig } from '../config/campaign.config';
import type { Dictionary } from '../i18n';
import { DwellButton } from '../interaction/DwellButton';

interface ResultScreenProps {
  dict: Dictionary;
  config: CampaignConfig;
  won: boolean;
  catches: number;
  onClaim: () => void;
  onPlayAgain: () => void;
  onCampaign: () => void;
}

/**
 * Win / lose result.
 *
 * The losing screen never issues a coupon — it only invites another attempt, in
 * warm language. "Almost there", never "you failed".
 */
export function ResultScreen({ dict, config, won, catches, onClaim, onPlayAgain, onCampaign }: ResultScreenProps) {
  return (
    <div className="screen items-center justify-center gap-[2.4vmin] text-center">
      <div className="absolute left-[3vmin] top-[3vmin]">
        <SponsorBadge config={config} label={dict.sponsorPlaceholder} />
      </div>

      <div className={`panel flex flex-col items-center gap-[2vmin] px-[6vmin] py-[4vmin] ${won ? '' : 'opacity-95'}`}>
        <p className="eyebrow text-[#8dc63f]">{won ? dict.winSubtitle : dict.loseSubtitle}</p>
        <h1 className="display text-[clamp(2rem,6vmin,6.4rem)]">{won ? dict.winTitle : dict.loseTitle}</h1>

        <div className="flex items-end gap-[1.2vmin]">
          <span className="display text-[clamp(3.4rem,11vmin,12rem)] leading-none text-[#ffe066]">{catches}</span>
          <span className="subhead mb-[1.4vmin] opacity-70">
            / {config.totalPitches} {dict.scoreLabel}
          </span>
        </div>

        <div className="flex gap-[0.8vmin]">
          {Array.from({ length: config.totalPitches }, (_, i) => (
            <span key={i} className={`pip ${i < catches ? 'pip--hit' : 'pip--miss'}`} />
          ))}
        </div>

        {won && (
          <div className="mt-[1vmin] flex items-center gap-[2vmin] rounded-[1.6vmin] bg-gradient-to-r from-[#1b6b37] to-[#2ea44f] px-[3vmin] py-[1.8vmin]">
            <span className="text-[clamp(1.8rem,4.6vmin,5rem)]" aria-hidden="true">
              🍵
            </span>
            <div className="text-left">
              <p className="subhead">{dict.winReward}</p>
              <p className="body-lg opacity-80">{config.demoMode ? dict.couponDemoWarning : ''}</p>
            </div>
          </div>
        )}

        <div className="mt-[1.6vmin] flex flex-wrap items-center justify-center gap-[1.4vmin]">
          {won ? (
            <DwellButton id="claim-coupon" onSelect={onClaim}>
              🎟 {dict.claimCoupon}
            </DwellButton>
          ) : (
            <DwellButton id="play-again" onSelect={onPlayAgain}>
              ↻ {dict.playAgain}
            </DwellButton>
          )}
          {won && (
            <DwellButton id="play-again-secondary" variant="secondary" onSelect={onPlayAgain}>
              ↻ {dict.playAgain}
            </DwellButton>
          )}
          <DwellButton id="campaign-site" variant="ghost" onSelect={onCampaign}>
            🔗 {dict.visitCampaign}
          </DwellButton>
        </div>
      </div>
    </div>
  );
}
