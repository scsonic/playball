import { useEffect, useState } from 'react';
import { resolveAsset } from '../config/asset-manifest';
import type { CampaignConfig } from '../config/campaign.config';

/**
 * Sponsor lockup with a graceful fallback.
 *
 * If no logo file is present (or licensed assets are switched off) it renders a
 * neutral typographic placeholder rather than an imitation of any real mark.
 */
export function SponsorBadge({
  config,
  label,
  className = '',
}: {
  config: CampaignConfig;
  label: string;
  className?: string;
}) {
  const [ok, setOk] = useState(true);
  const src = resolveAsset('brandLogo', config);

  useEffect(() => setOk(true), [src]);

  return (
    <div className={`flex items-center gap-[1.2vmin] ${className}`}>
      {ok && src ? (
        <img
          src={src}
          alt=""
          onError={() => setOk(false)}
          className="h-[clamp(1.6rem,3.6vmin,4rem)] w-auto opacity-95"
        />
      ) : (
        <div className="rounded-[0.6vmin] bg-gradient-to-br from-[#8dc63f] to-[#1b6b37] px-[1.1vmin] py-[0.55vmin] text-[clamp(0.7rem,1.3vmin,1.3rem)] font-black tracking-tight text-white">
          TEA
        </div>
      )}
      <span className="eyebrow opacity-60">{label}</span>
    </div>
  );
}
