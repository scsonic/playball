import { useEffect, useState } from 'react';
import { SponsorBadge } from '../components/SponsorBadge';
import type { CampaignConfig } from '../config/campaign.config';
import { CouponQr } from '../coupon/CouponQr';
import type { Dictionary } from '../i18n';
import { DwellButton } from '../interaction/DwellButton';
import type { Coupon } from '../types';

interface CouponScreenProps {
  dict: Dictionary;
  config: CampaignConfig;
  coupon: Coupon | null;
  error: string | null;
  onPlayAgain: () => void;
  onBack: () => void;
  onCampaign: () => void;
}

/** Reward screen: QR first, everything else secondary. */
export function CouponScreen({ dict, config, coupon, error, onPlayAgain, onBack, onCampaign }: CouponScreenProps) {
  const [remaining, setRemaining] = useState(() => remainingMinutes(coupon));

  useEffect(() => {
    if (!coupon) return;
    const id = window.setInterval(() => setRemaining(remainingMinutes(coupon)), 10_000);
    setRemaining(remainingMinutes(coupon));
    return () => window.clearInterval(id);
  }, [coupon]);

  return (
    <div className="screen items-center justify-center gap-[2vmin]">
      <div className="absolute left-[3vmin] top-[3vmin]">
        <SponsorBadge config={config} label={dict.sponsorPlaceholder} />
      </div>

      <div className="panel panel--light flex max-w-[120vmin] items-center gap-[4vmin] px-[4vmin] py-[3.4vmin]">
        <div className="flex flex-col items-center gap-[1.2vmin]">
          {coupon ? (
            <CouponQr url={coupon.claimUrl} size={Math.round(Math.min(window.innerHeight, window.innerWidth) * 0.3)} />
          ) : (
            <div className="flex h-[30vmin] w-[30vmin] items-center justify-center rounded-[1.4vmin] bg-slate-200 text-center text-slate-600">
              {error ?? '…'}
            </div>
          )}
          {coupon?.demo && (
            <p className="rounded-full bg-[#e63946] px-[1.6vmin] py-[0.5vmin] text-[clamp(0.7rem,1.2vmin,1.2rem)] font-black tracking-wider text-white">
              {dict.couponDemoWarning}
            </p>
          )}
        </div>

        <div className="max-w-[56vmin] text-left">
          <p className="eyebrow text-[#1b6b37]">{dict.couponTitle}</p>
          <h1 className="display text-[clamp(1.6rem,4.4vmin,4.6rem)] text-[#061428]">{dict.winReward}</h1>
          <p className="body-lg mt-[1.2vmin] text-[#0b2247] opacity-80">{dict.couponScan}</p>

          <dl className="mt-[2vmin] grid gap-[0.9vmin] text-[#061428]">
            <div className="flex items-baseline gap-[1.2vmin]">
              <dt className="eyebrow opacity-60">{dict.couponCode}</dt>
              <dd className="text-[clamp(1rem,2.2vmin,2.2rem)] font-black tracking-[0.14em]">
                {coupon?.code ?? '—'}
              </dd>
            </div>
            <div className="flex items-baseline gap-[1.2vmin]">
              <dt className="eyebrow opacity-60">{dict.couponExpires}</dt>
              <dd className="text-[clamp(0.95rem,1.9vmin,1.9rem)] font-bold">
                {remaining} {dict.couponMinutes}
              </dd>
            </div>
          </dl>

          <div className="mt-[2.4vmin] flex flex-wrap gap-[1.2vmin]">
            <DwellButton id="coupon-campaign" onSelect={onCampaign}>
              🔗 {dict.visitCampaign}
            </DwellButton>
            <DwellButton id="coupon-play-again" variant="secondary" onSelect={onPlayAgain}>
              ↻ {dict.playAgain}
            </DwellButton>
            <DwellButton id="coupon-back" variant="ghost" onSelect={onBack}>
              ⌂ {dict.backToStart}
            </DwellButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function remainingMinutes(coupon: Coupon | null): number {
  if (!coupon) return 0;
  return Math.max(0, Math.ceil((coupon.expiresAt - Date.now()) / 60_000));
}
