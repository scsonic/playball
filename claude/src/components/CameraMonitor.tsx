import { useEffect, useRef } from 'react';
import type { CampaignConfig } from '../config/campaign.config';
import { TickPriority, ticker } from '../core/ticker';
import { camera } from '../vision/Camera';
import { pointerSource } from '../vision/PointerSource';

interface CameraMonitorProps {
  config: CampaignConfig;
  visible: boolean;
}

/**
 * Small camera monitor for the bottom-left corner.
 *
 * Shows the live feed with the tracked hand drawn on top, plus resolution, frame rate
 * and transport. On a kiosk this is the fastest way to answer "is the camera actually
 * feeding the game?" without attaching a laptop — and it works the same whether frames
 * come from `getUserMedia` or from a native USB host.
 *
 * Everything updates through the shared ticker and writes directly to the DOM, so the
 * monitor never triggers a React render.
 */
export function CameraMonitor({ config, visible }: CameraMonitorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const statsRef = useRef<HTMLSpanElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!visible) return;
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay) return;

    // The stream may not exist yet (host camera still opening): keep trying.
    let attached = false;
    const attach = () => {
      if (attached) return;
      const stream = camera.getPreviewStream();
      if (!stream) return;
      video.srcObject = stream;
      video.play().catch(() => undefined);
      attached = true;
    };
    attach();

    const ctx = overlay.getContext('2d');
    let lastFrameId = -1;
    let framesInWindow = 0;
    let windowStart = performance.now();
    let fps = 0;
    let accumulator = 0;

    const unsubscribe = ticker.subscribe((dt, now) => {
      // Count real camera frames, not animation frames.
      const frameId = camera.getFrameId();
      if (frameId !== lastFrameId) {
        lastFrameId = frameId;
        framesInWindow++;
      }
      if (now - windowStart >= 1000) {
        fps = Math.round((framesInWindow * 1000) / (now - windowStart));
        framesInWindow = 0;
        windowStart = now;
      }

      accumulator += dt;
      if (accumulator < 0.1) return; // 10 Hz is plenty for a monitor
      accumulator = 0;

      if (!attached) attach();

      const diagnostics = pointerSource.getDiagnostics();
      const resolution = camera.getResolution();

      if (statsRef.current) {
        statsRef.current.textContent =
          `${resolution.width}×${resolution.height} · ${fps} fps · ${camera.getTransport()}`;
      }
      if (dotRef.current) {
        const armed = diagnostics.handDetected && diagnostics.palmOpen;
        dotRef.current.style.background = armed
          ? '#8dc63f'
          : diagnostics.handDetected
            ? '#f6c453'
            : 'rgba(255,255,255,0.25)';
      }

      // Hand landmarks, drawn in the video's own normalised space.
      if (ctx) {
        const width = overlay.clientWidth;
        const height = overlay.clientHeight;
        if (overlay.width !== width || overlay.height !== height) {
          overlay.width = width;
          overlay.height = height;
        }
        ctx.clearRect(0, 0, width, height);

        const landmarks = diagnostics.landmarks;
        if (landmarks) {
          const mirror = config.cameraMirrored;
          ctx.fillStyle = 'rgba(141,198,63,0.95)';
          for (const point of landmarks) {
            const x = (mirror ? 1 - point.x : point.x) * width;
            ctx.beginPath();
            ctx.arc(x, point.y * height, 2, 0, Math.PI * 2);
            ctx.fill();
          }
          // Palm centre — the point that actually drives the cursor.
          const palm = landmarks[9];
          if (palm) {
            const x = (mirror ? 1 - palm.x : palm.x) * width;
            ctx.strokeStyle = diagnostics.palmOpen ? '#8dc63f' : '#f6c453';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, palm.y * height, 9, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
    }, TickPriority.Cursor);

    return () => {
      unsubscribe();
      video.srcObject = null;
    };
  }, [visible, config.cameraMirrored]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed bottom-[2vmin] left-[2vmin] z-[75] w-[clamp(8rem,17vmin,15rem)] overflow-hidden rounded-[1vmin] border border-white/20 bg-[rgba(5,16,34,0.72)] shadow-[0_1vmin_3vmin_rgba(0,0,0,0.45)] backdrop-blur">
      <div className="relative aspect-[4/3] w-full">
        <video
          ref={videoRef}
          muted
          playsInline
          className="h-full w-full object-cover"
          style={{ transform: config.cameraMirrored ? 'scaleX(-1)' : 'none' }}
        />
        <canvas ref={overlayRef} className="absolute inset-0 h-full w-full" />
      </div>
      <div className="flex items-center gap-[0.6vmin] px-[0.8vmin] py-[0.5vmin]">
        <span ref={dotRef} className="h-[0.9vmin] w-[0.9vmin] shrink-0 rounded-full bg-white/25" />
        <span
          ref={statsRef}
          className="truncate font-mono text-[clamp(0.5rem,0.95vmin,0.8rem)] opacity-75"
        >
          —
        </span>
      </div>
    </div>
  );
}
