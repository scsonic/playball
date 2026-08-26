import { useEffect, useRef, useState } from 'react';
import { analytics } from '../analytics/Analytics';
import { probeAssets } from '../config/asset-manifest';
import type { CampaignConfig } from '../config/campaign.config';
import { gameEngine } from '../game/Engine';
import { store } from '../core/store';
import { ticker } from '../core/ticker';
import type { Difficulty, GameStateLike } from './adminTypes';
import { camera } from '../vision/Camera';
import { externalCamera } from '../vision/ExternalCamera';
import { pointerSource } from '../vision/PointerSource';

interface AdminPanelProps {
  open: boolean;
  config: CampaignConfig;
  state: GameStateLike;
  couponMode: string;
  onClose: () => void;
  onForceResult: (won: boolean) => void;
  onReset: () => void;
  onDifficulty: (difficulty: Difficulty) => void;
  onToggleDebug: () => void;
  onToggleWatermark: () => void;
}

/**
 * Hidden operator panel (Ctrl+Alt+D).
 *
 * Everything an on-site technician needs — tracking health, FPS, the live hitbox,
 * asset status, and manual win/lose simulation for a sponsor walkthrough — with
 * nothing leaking into the player-facing experience.
 */
export function AdminPanel({
  open,
  config,
  state,
  couponMode,
  onClose,
  onForceResult,
  onReset,
  onDifficulty,
  onToggleDebug,
  onToggleWatermark,
}: AdminPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [assets, setAssets] = useState<Record<string, boolean>>({});
  const [snapshot, setSnapshot] = useState(() => readSnapshot());

  useEffect(() => {
    if (!open) return;
    probeAssets(config).then(setAssets);
    const id = window.setInterval(() => setSnapshot(readSnapshot()), 250);
    return () => window.clearInterval(id);
  }, [open, config]);

  useEffect(() => {
    if (!open) return;
    const el = videoRef.current;
    const stream = camera.getPreviewStream();
    if (stream && el) {
      el.srcObject = stream;
      el.play().catch(() => undefined);
    }

    let raf = 0;
    const draw = () => {
      const canvas = overlayRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const diag = pointerSource.getDiagnostics();
        drawLandmarks(ctx, canvas, diag.poseLandmarks, 'rgba(90,200,255,0.75)', 2);
        drawLandmarks(ctx, canvas, diag.landmarks, 'rgba(141,198,63,0.95)', 3);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      if (el) el.srcObject = null;
    };
  }, [open]);

  if (!open) return null;

  const cursor = snapshot.cursor;
  const diag = snapshot.diagnostics;
  const debug = snapshot.engine;

  return (
    <div className="pointer-events-auto fixed inset-0 z-[90] flex items-start justify-end bg-black/55 p-[2vmin] font-mono text-[clamp(0.62rem,1.05vmin,1rem)]">
      <div className="panel max-h-full w-[52vmin] overflow-y-auto p-[1.8vmin]">
        <div className="mb-[1.2vmin] flex items-center justify-between">
          <h2 className="text-[clamp(0.9rem,1.7vmin,1.7rem)] font-black tracking-wide">OPERATOR PANEL</h2>
          <button onClick={onClose} className="rounded bg-white/15 px-[1vmin] py-[0.4vmin]">
            ESC
          </button>
        </div>

        <div className="relative mb-[1.4vmin] aspect-video w-full overflow-hidden rounded-[0.8vmin] bg-black">
          <video
            ref={videoRef}
            muted
            playsInline
            className="h-full w-full object-cover"
            style={{ transform: config.cameraMirrored ? 'scaleX(-1)' : 'none' }}
          />
          <canvas
            ref={overlayRef}
            width={480}
            height={270}
            className="absolute inset-0 h-full w-full"
            style={{ transform: config.cameraMirrored ? 'scaleX(-1)' : 'none' }}
          />
        </div>

        <Section title="Runtime">
          <Row k="state" v={state.app} />
          <Row k="run / pitch" v={`${state.runId} / ${debug.pitchIndex + 1}`} />
          <Row k="engine phase" v={`${debug.mode} · ${debug.phase}`} />
          <Row k="pitch type" v={debug.pitchType ?? '—'} />
          <Row k="flight" v={debug.flightProgress.toFixed(2)} />
          <Row k="fps" v={String(snapshot.fps)} />
          <Row k="inference" v={`${diag.inferenceMs.toFixed(1)} ms`} />
          <Row k="particles" v={String(debug.particles)} />
        </Section>

        <Section title="Tracking">
          <Row k="source" v={cursor.source} />
          <Row k="screen" v={`${cursor.x.toFixed(0)}, ${cursor.y.toFixed(0)}`} />
          <Row k="speed" v={`${cursor.speed.toFixed(0)} px/s`} />
          <Row k="confidence" v={cursor.confidence.toFixed(2)} />
          <Row k="palm open" v={String(cursor.palmOpen)} />
          <Row k="palm radius" v={`${cursor.palmRadiusPx.toFixed(0)} px`} />
          <Row k="catch radius" v={`${debug.catchRadius.toFixed(0)} px`} />
          <Row k="hand" v={`${cursor.handLabel ?? '—'} (target ${config.handMode})`} />
          <Row k="person / body" v={`${diag.personDetected} / ${diag.upperBodyVisible}`} />
          <Row k="lighting / dist" v={`${diag.lighting} / ${diag.distance}`} />
          <Row
            k="last eval"
            v={
              debug.lastEvaluation
                ? `${debug.lastEvaluation.reason} d=${debug.lastEvaluation.distance.toFixed(0)}/${debug.lastEvaluation.threshold.toFixed(0)}`
                : '—'
            }
          />
        </Section>

        <Section title="Assets">
          {Object.entries(assets).map(([id, ok]) => (
            <Row key={id} k={id} v={ok ? '✓ file' : '· procedural'} />
          ))}
        </Section>

        <Section title="Camera">
          <Row k="transport" v={camera.getTransport()} />
          <Row k="device" v={camera.getLabel()} />
          <Row k="resolution" v={`${camera.getResolution().width}x${camera.getResolution().height}`} />
          <Row k="host" v={externalCamera.status().host ?? 'none'} />
          <Row k="host frames" v={`${externalCamera.status().frames} (${externalCamera.status().dropped} dropped)`} />
        </Section>

        <Section title="Campaign">
          <Row k="coupon api" v={couponMode} />
          <Row k="demo mode" v={String(config.demoMode)} />
          <Row k="licensed athlete" v={String(config.useLicensedAthleteAssets)} />
          <Row k="licensed brand" v={String(config.useLicensedBrandAssets)} />
          <Row k="session" v={state.sessionId} />
        </Section>

        <div className="mt-[1.4vmin] grid grid-cols-2 gap-[0.6vmin]">
          {(['easy', 'normal', 'challenge'] as Difficulty[]).map((d) => (
            <AdminButton key={d} active={config.difficulty === d} onClick={() => onDifficulty(d)}>
              {d}
            </AdminButton>
          ))}
          <AdminButton active={config.enableDebugOverlay} onClick={onToggleDebug}>
            hitbox overlay
          </AdminButton>
          <AdminButton active={state.demoWatermark} onClick={onToggleWatermark}>
            demo watermark
          </AdminButton>
          <AdminButton onClick={() => onForceResult(true)}>simulate WIN</AdminButton>
          <AdminButton onClick={() => onForceResult(false)}>simulate LOSE</AdminButton>
          <AdminButton onClick={onReset}>reset session</AdminButton>
          <AdminButton onClick={exportLog}>export log</AdminButton>
        </div>
      </div>
    </div>
  );
}

function readSnapshot() {
  return {
    cursor: pointerSource.getSample(),
    diagnostics: pointerSource.getDiagnostics(),
    engine: gameEngine.getDebugInfo(),
    fps: ticker.getFps(),
    history: store.getHistory(),
  };
}

function exportLog() {
  const payload = {
    exportedAt: new Date().toISOString(),
    transitions: store.getHistory(),
    events: analytics.exportLog(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `catch-challenge-diagnostics-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function drawLandmarks(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  landmarks: Array<{ x: number; y: number }> | null,
  color: string,
  size: number,
) {
  if (!landmarks) return;
  ctx.fillStyle = color;
  for (const lm of landmarks) {
    ctx.beginPath();
    ctx.arc(lm.x * canvas.width, lm.y * canvas.height, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-[1.2vmin]">
      <p className="mb-[0.5vmin] border-b border-white/15 pb-[0.3vmin] text-[#8dc63f]">{title}</p>
      <div className="grid gap-[0.2vmin]">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-[1vmin]">
      <span className="opacity-55">{k}</span>
      <span className="truncate text-right">{v}</span>
    </div>
  );
}

function AdminButton({
  children,
  onClick,
  active = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-[0.8vmin] py-[0.6vmin] text-left ${
        active ? 'bg-[#2ea44f] text-black' : 'bg-white/12 hover:bg-white/20'
      }`}
    >
      {children}
    </button>
  );
}
