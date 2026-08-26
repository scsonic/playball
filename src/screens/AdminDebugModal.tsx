import React, { useEffect, useState } from 'react';
import { X, Activity, Settings, Play, Download, RefreshCw, Hand, Shield } from 'lucide-react';
import { TrackingFrame, Difficulty } from '../types/game';
import { gameStateMachine, GameStoreState } from '../state/gameStateMachine';
import { analyticsService } from '../analytics/AnalyticsService';

interface AdminDebugModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackingFrame: TrackingFrame;
  gameState: GameStoreState;
  videoElement: HTMLVideoElement | null;
  onSimulateWin: () => void;
  onSimulateLose: () => void;
  onReset: () => void;
}

export const AdminDebugModal: React.FC<AdminDebugModalProps> = ({
  isOpen,
  onClose,
  trackingFrame,
  gameState,
  videoElement,
  onSimulateWin,
  onSimulateLose,
  onReset
}) => {
  const [fps, setFps] = useState<number>(60);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId: number;

    const countFps = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(countFps);
    };

    if (isOpen) {
      animId = requestAnimationFrame(countFps);
    }
    return () => cancelAnimationFrame(animId);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExportLogs = () => {
    const data = analyticsService.getExportableLogs();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `itoen_debug_log_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border-2 border-emerald-500/60 rounded-3xl p-6 shadow-2xl text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center space-x-3">
            <Settings className="w-6 h-6 text-emerald-400" />
            <h3 className="text-xl font-black text-white">Admin & Computer Vision Debug Console</h3>
            <span className="text-xs bg-slate-800 text-emerald-300 font-mono px-2 py-0.5 rounded">
              Shortcut: [`] or [~]
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Vision Stream & Live Coordinates */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-300 flex items-center space-x-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Vision Tracking Feed</span>
            </h4>

            {/* Video Preview Box */}
            <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-slate-700 flex items-center justify-center">
              {videoElement ? (
                <video
                  ref={(ref) => {
                    if (ref && videoElement.srcObject && ref.srcObject !== videoElement.srcObject) {
                      ref.srcObject = videoElement.srcObject;
                      ref.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              ) : (
                <span className="text-xs text-slate-500">Camera not active</span>
              )}

              {/* Live Palm Centroid Reticle */}
              {trackingFrame.handDetected && (
                <div
                  className="absolute w-6 h-6 rounded-full border-2 border-emerald-400 bg-emerald-500/40 pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${(1.0 - trackingFrame.rawPalmCenter.x) * 100}%`,
                    top: `${trackingFrame.rawPalmCenter.y * 100}%`
                  }}
                />
              )}
            </div>

            {/* Live Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 block">Performance</span>
                <span className="text-emerald-400 font-bold text-base">{fps} FPS</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 block">Confidence</span>
                <span className="text-amber-400 font-bold text-base">
                  {Math.round(trackingFrame.confidence * 100)}%
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 block">Palm Open</span>
                <span className={trackingFrame.palmOpen ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {trackingFrame.palmOpen ? 'TRUE' : 'FALSE'}
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 block">Velocity</span>
                <span className="text-blue-400 font-bold">{Math.round(trackingFrame.velocity)} px/s</span>
              </div>
            </div>
          </div>

          {/* Right Column: Game State & Controls */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-300 flex items-center space-x-2">
              <Settings className="w-4 h-4 text-emerald-400" />
              <span>Game Simulation & Presets</span>
            </h4>

            {/* Current State Indicator */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Application State:</span>
                <span className="font-bold text-amber-300 font-mono">{gameState.currentState}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Score:</span>
                <span className="font-bold text-emerald-400 font-mono">
                  {gameState.catchesCount} / {gameState.totalPitches} Catches
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Session ID:</span>
                <span className="font-mono text-slate-400 truncate max-w-[180px]">
                  {gameState.sessionId}
                </span>
              </div>
            </div>

            {/* Difficulty Selector */}
            <div>
              <span className="text-xs text-slate-400 font-bold uppercase block mb-2">Difficulty</span>
              <div className="grid grid-cols-3 gap-2">
                {(['easy', 'normal', 'challenge'] as Difficulty[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => gameStateMachine.setDifficulty(d)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold uppercase transition-all ${
                      gameState.difficulty === d
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Simulation Actions */}
            <div className="space-y-2 pt-2">
              <span className="text-xs text-slate-400 font-bold uppercase block mb-1">
                Instant Simulation Triggers
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onSimulateWin}
                  className="py-2.5 px-4 bg-emerald-700 hover:bg-emerald-600 rounded-xl text-xs font-bold transition-all"
                >
                  Force Win Screen
                </button>
                <button
                  onClick={onSimulateLose}
                  className="py-2.5 px-4 bg-amber-700 hover:bg-amber-600 rounded-xl text-xs font-bold transition-all"
                >
                  Force Retry Screen
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={onReset}
                  className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset State</span>
                </button>

                <button
                  onClick={handleExportLogs}
                  className="py-2.5 px-4 bg-blue-700 hover:bg-blue-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{copied ? 'Exported!' : 'Export Logs'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
