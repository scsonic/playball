import { DwellButton } from '../interaction/DwellButton';
import type { Dictionary } from '../i18n';
import { LOCALE_ORDER } from '../i18n';
import type { Locale } from '../types';

interface TopControlsProps {
  dict: Dictionary;
  locale: Locale;
  audioEnabled: boolean;
  onLocale: (locale: Locale) => void;
  onToggleAudio: () => void;
  onFullscreen: () => void;
  showFullscreen?: boolean;
}

/** Language, audio and full-screen — all dwell-selectable, no touching required. */
export function TopControls({
  dict,
  locale,
  audioEnabled,
  onLocale,
  onToggleAudio,
  onFullscreen,
  showFullscreen = true,
}: TopControlsProps) {
  return (
    <div className="flex items-center gap-[0.8vmin]">
      {LOCALE_ORDER.map((code) => (
        <DwellButton
          key={code}
          id={`locale-${code}`}
          variant="chip"
          className={locale === code ? 'chip-active' : ''}
          onSelect={() => onLocale(code)}
        >
          {code === 'ja' ? '日本語' : code === 'en' ? 'EN' : '繁中'}
        </DwellButton>
      ))}
      <DwellButton id="audio-toggle" variant="chip" onSelect={onToggleAudio}>
        {audioEnabled ? `🔊 ${dict.audioOn}` : `🔈 ${dict.audioOff}`}
      </DwellButton>
      {showFullscreen && (
        <DwellButton id="fullscreen" variant="chip" onSelect={onFullscreen}>
          ⛶ {dict.fullscreen}
        </DwellButton>
      )}
    </div>
  );
}
