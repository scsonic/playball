import React, { useEffect, useState } from 'react';
import { Trophy, Gift, RotateCcw, ExternalLink, Sparkles, Clock, CheckCircle } from 'lucide-react';
import { Locale, CouponData } from '../types/game';
import { LOCALES } from '../locales';
import { GameStoreState } from '../state/gameStateMachine';
import { demoCouponService } from '../coupon/DemoCouponService';
import { CouponQr } from '../coupon/CouponQr';
import { DwellButton } from '../interaction/DwellButton';

interface ResultScreenProps {
  gameState: GameStoreState;
  locale: Locale;
  onPlayAgain: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  gameState,
  locale,
  onPlayAgain
}) => {
  const t = LOCALES[locale];
  const { catchesCount, requiredCatches, totalPitches, sessionId, difficulty } = gameState;
  const isWon = catchesCount >= requiredCatches;

  const [coupon, setCoupon] = useState<CouponData | null>(null);

  useEffect(() => {
    if (isWon) {
      demoCouponService
        .issueCoupon({
          sessionId,
          catches: catchesCount,
          totalPitches,
          difficulty
        })
        .then((c) => setCoupon(c));
    }
  }, [isWon, sessionId, catchesCount, totalPitches, difficulty]);

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-6 md:p-8 bg-gradient-to-b from-slate-950 via-slate-900 to-itoen-dark text-white select-none overflow-hidden">
      {/* Top Banner */}
      <div className="w-full flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          <div className="px-4 py-1 bg-amber-500/20 border border-amber-400/40 rounded-full text-amber-300 text-xs font-bold uppercase">
            {t.conceptDemoBadge}
          </div>
          <span className="text-xs text-emerald-300 font-bold">
            ITO EN Oi Ocha Campaign Reward System
          </span>
        </div>
      </div>

      {/* Main Result Presentation */}
      <div className="flex flex-col items-center text-center my-auto max-w-4xl mx-auto z-10 w-full">
        {isWon ? (
          /* WIN PRESENTATION */
          <div className="flex flex-col items-center w-full">
            {/* Header */}
            <div className="inline-flex items-center space-x-2 px-5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-sm font-extrabold mb-3">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>{t.winSubheadline}</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black mb-2 stadium-text-stroke">
              <span className="gold-text-gradient">{t.winHeadline}</span>
            </h1>

            <p className="text-lg sm:text-xl text-amber-200 font-bold mb-6">
              {t.winReward} ({catchesCount} / {totalPitches} {t.catchCountLabel})
            </p>

            {/* Premium Coupon & QR Card */}
            <div className="w-full max-w-2xl glass-panel-green rounded-3xl p-6 shadow-2xl border-2 border-emerald-400/50 flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">
              {/* QR Code Container */}
              <div className="flex flex-col items-center">
                {coupon && <CouponQr url={coupon.qrUrl} size={150} />}
                <span className="text-[11px] text-emerald-200 font-bold mt-2 text-center">
                  {t.scanQrPrompt}
                </span>
              </div>

              {/* Coupon Info */}
              <div className="flex-1 text-left flex flex-col justify-between space-y-3">
                <div className="flex items-center space-x-2">
                  <Gift className="w-5 h-5 text-amber-300" />
                  <span className="font-extrabold text-white text-base">
                    伊藤園 お〜いお茶 530ml 1本引換券
                  </span>
                </div>

                {/* Coupon Code Pill */}
                <div className="bg-slate-950/70 border border-emerald-400/40 rounded-xl px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-bold">COUPON CODE:</span>
                  <span className="font-mono text-base font-black text-amber-300 tracking-wider">
                    {coupon ? coupon.code : 'GENERATING...'}
                  </span>
                </div>

                <div className="flex items-center space-x-2 text-xs text-emerald-200">
                  <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>{t.couponExpirationNotice}</span>
                </div>

                <div className="text-[11px] text-amber-300/80 font-bold bg-amber-950/40 px-3 py-1 rounded-lg border border-amber-500/20">
                  {t.demoCouponNotice}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* LOSE / RETRY PRESENTATION */
          <div className="flex flex-col items-center max-w-lg">
            <div className="w-20 h-20 rounded-3xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center mb-4">
              <Trophy className="w-10 h-10 text-amber-400" />
            </div>

            <h1 className="text-4xl sm:text-5xl font-black mb-3 stadium-text-stroke">
              <span className="text-amber-300">{t.loseHeadline}</span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-200 font-bold mb-2">
              {t.catchCountLabel}: {catchesCount} / {totalPitches}
            </p>

            <p className="text-base text-emerald-300 font-semibold mb-8">
              {t.loseEncourage}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <DwellButton
            id="result-play-again-btn"
            onDwellTrigger={onPlayAgain}
            variant="gold"
            className="text-lg py-5 px-10 flex items-center space-x-3 shadow-xl"
          >
            <RotateCcw className="w-6 h-6 text-slate-950" />
            <span>{t.playAgainBtn}</span>
          </DwellButton>

          {isWon && (
            <DwellButton
              id="result-website-btn"
              onDwellTrigger={() => {
                window.open('https://www.itoen.jp/', '_blank');
              }}
              variant="secondary"
              className="text-sm py-4 px-6 flex items-center space-x-2"
            >
              <span>{t.visitWebsiteBtn}</span>
              <ExternalLink className="w-4 h-4" />
            </DwellButton>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="w-full text-center text-xs text-slate-500 z-10">
        <span>Session ID: {sessionId}</span>
      </div>
    </div>
  );
};
