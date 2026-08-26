import { useEffect, useRef } from 'react';
import { TickPriority, ticker } from '../core/ticker';
import { pointerSource } from '../vision/PointerSource';
import { dwellEngine } from './DwellEngine';

interface CursorLayerProps {
  /** Menu cursor is hidden while the game engine draws the glove itself. */
  visible: boolean;
  highContrast?: boolean;
}

/**
 * The menu-mode hand cursor, drawn on its own canvas.
 *
 * Rendering the cursor outside React is not a micro-optimisation: at 60 FPS a
 * React-state cursor would re-render the entire screen tree 60 times a second
 * while MediaPipe is already competing for the main thread.
 */
export function CursorLayer({ visible, highContrast = false }: CursorLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };
    resize();
    window.addEventListener('resize', resize);

    const unsubscribe = ticker.subscribe((_dt, now) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      if (!visibleRef.current) return;

      const cursor = pointerSource.getSample();
      if (cursor.visibility <= 0.01) return;

      const status = dwellEngine.getStatus();
      const alpha = cursor.visibility;
      const r = 30;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cursor.x, cursor.y);

      // Soft halo so the cursor stays visible over bright stadium artwork.
      const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 2.4);
      halo.addColorStop(0, highContrast ? 'rgba(0,0,0,0.55)' : 'rgba(12,32,60,0.35)');
      halo.addColorStop(1, 'rgba(12,32,60,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, r * 2.4, 0, Math.PI * 2);
      ctx.fill();

      // Base ring
      ctx.lineWidth = 3;
      ctx.strokeStyle = highContrast ? '#ffffff' : 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();

      // Core dot, pulsing gently while idle
      const pulse = 1 + Math.sin(now / 320) * 0.08;
      ctx.fillStyle = highContrast ? '#ffe600' : '#f8fafc';
      ctx.beginPath();
      ctx.arc(0, 0, 5.5 * pulse, 0, Math.PI * 2);
      ctx.fill();

      // Dwell progress ring — one full revolution over the dwell duration.
      if (status.targetId && status.progress > 0.001) {
        const sweep = Math.PI * 2 * status.progress;
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.strokeStyle = status.paused ? 'rgba(255,255,255,0.4)' : highContrast ? '#ffe600' : '#7ddb62';
        ctx.beginPath();
        ctx.arc(0, 0, r + 7, -Math.PI / 2, -Math.PI / 2 + sweep);
        ctx.stroke();

        if (!status.paused) {
          ctx.globalAlpha = alpha * 0.35 * status.progress;
          ctx.fillStyle = '#7ddb62';
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }, TickPriority.Cursor);

    return () => {
      unsubscribe();
      window.removeEventListener('resize', resize);
    };
  }, [highContrast]);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[70]" aria-hidden="true" />;
}
