import { SponsorBadge } from '../components/SponsorBadge';
import { TopControls } from '../components/TopControls';
import type { CampaignConfig } from '../config/campaign.config';
import type { Dictionary } from '../i18n';
import { DwellButton } from '../interaction/DwellButton';
import type { Locale } from '../types';

interface BootScreenProps {
  dict: Dictionary;
  config: CampaignConfig;
  locale: Locale;
  audioEnabled: boolean;
  booting: boolean;
  busy: boolean;
  onEnableCamera: () => void;
  onSkipCamera: () => void;
  onLocale: (locale: Locale) => void;
  onToggleAudio: () => void;
  onFullscreen: () => void;
}

/** Boot + camera permission, with the privacy promise stated before the prompt. */
export function BootScreen({
  dict,
  config,
  locale,
  audioEnabled,
  booting,
  busy,
  onEnableCamera,
  onSkipCamera,
  onLocale,
  onToggleAudio,
  onFullscreen,
}: BootScreenProps) {
  return (
    <div className="screen items-center justify-between">
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

      <main className="flex w-full max-w-[130vmin] flex-1 flex-col items-center justify-center gap-[3vmin] text-center">
        <BaseballLoader spinning={booting || busy} />

        <div>
          <p className="eyebrow mb-[1.2vmin] text-[#8dc63f]">{dict.bootSubtitle}</p>
          <h1 className="display headline">{dict.bootTitle}</h1>
        </div>

        {booting ? (
          <p className="body-lg fade-loop opacity-80">{dict.bootLoading}</p>
        ) : (
          <>
            <section className="panel w-full max-w-[92vmin] px-[3.4vmin] py-[2.6vmin] text-left">
              <h2 className="subhead mb-[1.4vmin] flex items-center gap-[1vmin]">
                <span aria-hidden="true">🔒</span>
                {dict.privacyTitle}
              </h2>
              <ul className="body-lg grid gap-[0.9vmin] opacity-90">
                <PrivacyLine>{dict.privacyLocal}</PrivacyLine>
                <PrivacyLine>{dict.privacyNoUpload}</PrivacyLine>
                <PrivacyLine>{dict.privacyNoFaces}</PrivacyLine>
              </ul>
            </section>

            <div className="flex flex-col items-center gap-[1.4vmin]">
              <DwellButton id="enable-camera" onSelect={onEnableCamera} disabled={busy}>
                📷 {dict.enableCamera}
              </DwellButton>
              {/* The vision model can take a while to arrive on a cold kiosk; never
                  leave the player looking at a dimmed button with no explanation. */}
              {busy && <p className="body-lg fade-loop opacity-80">{dict.preparingCamera}</p>}
              <DwellButton id="skip-camera" variant="ghost" onSelect={onSkipCamera}>
                🖱 {dict.demoWithoutCamera}
              </DwellButton>
            </div>
          </>
        )}
      </main>

      <footer className="body-lg w-full text-center opacity-50">
        {config.demoMode ? dict.conceptDemo : ''}
      </footer>
    </div>
  );
}

function PrivacyLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-[1vmin]">
      <span className="mt-[0.6vmin] block h-[0.8vmin] w-[0.8vmin] shrink-0 rounded-full bg-[#8dc63f]" />
      <span>{children}</span>
    </li>
  );
}

/** Animated baseball loading indicator. */
export function BaseballLoader({ spinning }: { spinning: boolean }) {
  return (
    <div className={`relative h-[12vmin] w-[12vmin] ${spinning ? 'spin-slow' : ''}`}>
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#ffffff,#e7e3d8_60%,#b6b0a1)] shadow-[0_1.6vmin_4vmin_rgba(0,0,0,0.45)]" />
      <svg viewBox="0 0 100 100" className="absolute inset-0">
        <path d="M22 10 C40 30 40 70 22 90" fill="none" stroke="#c8102e" strokeWidth="4" strokeLinecap="round" />
        <path d="M78 10 C60 30 60 70 78 90" fill="none" stroke="#c8102e" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </div>
  );
}
