import type { Dictionary } from '../i18n';
import { DwellButton } from '../interaction/DwellButton';

interface CameraErrorScreenProps {
  dict: Dictionary;
  errorCode: string | null;
  onRetry: () => void;
  onMouseMode: () => void;
}

/** A dead end is never acceptable on a kiosk: always two ways forward. */
export function CameraErrorScreen({ dict, errorCode, onRetry, onMouseMode }: CameraErrorScreenProps) {
  return (
    <div className="screen items-center justify-center gap-[2vmin] text-center">
      <div className="panel flex max-w-[100vmin] flex-col items-center gap-[2vmin] px-[5vmin] py-[4vmin]">
        <span className="text-[clamp(2.4rem,7vmin,7rem)]" aria-hidden="true">
          📷
        </span>
        <h1 className="display text-[clamp(1.6rem,4vmin,4rem)]">{dict.permissionDeniedTitle}</h1>
        <p className="body-lg max-w-[70vmin] opacity-85">{dict.permissionDeniedBody}</p>
        {errorCode && <p className="eyebrow opacity-45">error: {errorCode}</p>}
        <div className="mt-[1.4vmin] flex flex-wrap justify-center gap-[1.2vmin]">
          <DwellButton id="retry-camera" onSelect={onRetry}>
            ↻ {dict.retryCamera}
          </DwellButton>
          <DwellButton id="mouse-mode" variant="secondary" onSelect={onMouseMode}>
            🖱 {dict.demoWithoutCamera}
          </DwellButton>
        </div>
      </div>
    </div>
  );
}
