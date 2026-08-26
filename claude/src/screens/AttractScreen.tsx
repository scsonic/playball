import { SponsorBadge } from '../components/SponsorBadge';
import { TopControls } from '../components/TopControls';
import type { CampaignConfig } from '../config/campaign.config';
import type { Dictionary } from '../i18n';
import { DwellButton } from '../interaction/DwellButton';
import type { Difficulty, Locale } from '../types';

interface AttractScreenProps {
  dict: Dictionary;
  config: CampaignConfig;
  locale: Locale;
  audioEnabled: boolean;
  difficulty: Difficulty;
  handDetected: boolean;
  onStart: () => void;
  onLocale: (locale: Locale) => void;
  onToggleAudio: () => void;
  onFullscreen: () => void;
  onDifficulty: (difficulty: Difficulty) => void;
}

/**
 * Attract mode for a large public display: one headline, three steps, one action.
 * The live stadium canvas renders behind this layer, so the screen is never static.
 */
export function AttractScreen({
  dict,
  config,
  locale,
  audioEnabled,
  difficulty,
  handDetected,
  onStart,
  onLocale,
  onToggleAudio,
  onFullscreen,
  onDifficulty,
}: AttractScreenProps) {
  const difficulties: Array<{ id: Difficulty; label: string }> = [
    { id: 'easy', label: dict.difficultyEasy },
    { id: 'normal', label: dict.difficultyNormal },
    { id: 'challenge', label: dict.difficultyChallenge },
  ];

  return (
    <div className="screen justify-between">
      <header className="flex w-full items-start justify-between">
        <SponsorBadge config={config} label={dict.sponsorPlaceholder} />
        <TopControls
          dict={dict}
          locale={locale}
          audioEnabled={audioEnabled}
          onLocale={onLocale}
          onToggleAudio={onToggleAudio}
          onFullscreen={onFullscreen}
        />
      </header>

      <main className="flex w-full flex-1 items-center">
        <div className="max-w-[92vmin]">
          <div className="stripe-accent mb-[2vmin] h-[0.7vmin] w-[18vmin] rounded-full" />
          <h1 className="display headline text-stroke drop-shadow-[0_1.4vmin_3vmin_rgba(0,0,0,0.55)]">
            {dict.attractHeadline}
          </h1>
          <p className="subhead mt-[1.6vmin] text-[#ffe066] drop-shadow-[0_0.8vmin_2vmin_rgba(0,0,0,0.6)]">
            {dict.attractSub}
          </p>

          <div className="panel mt-[2.6vmin] inline-flex flex-col gap-[0.8vmin] px-[2.6vmin] py-[1.8vmin]">
            <p className="body-lg font-bold">🥎 {dict.attractRule}</p>
            <p className="body-lg text-[#8dc63f]">🍵 {dict.attractReward}</p>
          </div>

          <ol className="mt-[2.6vmin] flex flex-wrap gap-[1.4vmin]">
            {[dict.step1, dict.step2, dict.step3].map((step, i) => (
              <li key={step} className="hud-card flex items-center gap-[1.2vmin] px-[1.8vmin] py-[1.2vmin]">
                <span className="flex h-[3.2vmin] w-[3.2vmin] items-center justify-center rounded-full bg-[#2ea44f] text-[clamp(0.8rem,1.5vmin,1.5rem)] font-black">
                  {i + 1}
                </span>
                <span className="body-lg max-w-[26vmin]">{step}</span>
              </li>
            ))}
          </ol>

          <div className="mt-[3vmin] flex flex-wrap items-center gap-[1.6vmin]">
            <DwellButton id="start-game" onSelect={onStart}>
              ▶ {dict.start}
            </DwellButton>
            <span className={`body-lg ${handDetected ? 'text-[#8dc63f]' : 'fade-loop opacity-75'}`}>
              {handDetected ? '✋ ✓' : '✋'} {dict.raisePalm}
            </span>
          </div>

          <div className="mt-[2.2vmin] flex items-center gap-[0.8vmin]">
            <span className="eyebrow opacity-60">{dict.difficulty}</span>
            {difficulties.map((d) => (
              <DwellButton
                key={d.id}
                id={`difficulty-${d.id}`}
                variant="chip"
                className={difficulty === d.id ? 'chip-active' : ''}
                onSelect={() => onDifficulty(d.id)}
              >
                {d.label}
              </DwellButton>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
