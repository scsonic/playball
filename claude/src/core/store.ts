import { useSyncExternalStore } from 'react';
import { DEFAULT_CONFIG, withDifficulty, type CampaignConfig } from '../config/campaign.config';
import {
  canTransition,
  createInitialState,
  reduce,
  type GameAction,
  type GameState,
  type SessionRules,
} from './stateMachine';

type Listener = () => void;

/**
 * Minimal external store (no Zustand dependency needed).
 *
 * React subscribes through `useSyncExternalStore`, so the tracking loop can run
 * at 60 FPS without ever triggering a React render: only discrete game events
 * dispatch actions.
 */
class Store {
  private state: GameState;
  private config: CampaignConfig;
  private listeners = new Set<Listener>();
  private configListeners = new Set<Listener>();
  private history: Array<{ from: string; to: string; action: string; t: number }> = [];

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.state = createInitialState({
      locale: this.config.locale,
      difficulty: this.config.difficulty,
      handMode: this.config.handMode,
      audioEnabled: this.config.enableAudio,
      debugOverlay: this.config.enableDebugOverlay,
      demoWatermark: this.config.demoMode,
    });
  }

  getState = (): GameState => this.state;
  getConfig = (): CampaignConfig => this.config;

  private get rules(): SessionRules {
    return { totalPitches: this.config.totalPitches, requiredCatches: this.config.requiredCatches };
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  subscribeConfig = (listener: Listener): (() => void) => {
    this.configListeners.add(listener);
    return () => this.configListeners.delete(listener);
  };

  dispatch = (action: GameAction): GameState => {
    const previous = this.state;
    const next = reduce(previous, action, this.rules);

    if (next === previous) {
      if (import.meta.env?.DEV && 'type' in action) {
        // A rejected transition is a design signal, not a crash.
        console.debug('[fsm] ignored', action.type, 'in', previous.app);
      }
      return previous;
    }

    if (next.app !== previous.app) {
      this.history.push({ from: previous.app, to: next.app, action: action.type, t: Date.now() });
      if (this.history.length > 80) this.history.shift();
    }

    this.state = next;

    // Keep derived config in sync with player-chosen preferences.
    if (next.difficulty !== previous.difficulty) {
      this.setConfig(withDifficulty(this.config, next.difficulty));
    }
    if (next.locale !== previous.locale) {
      this.setConfig({ ...this.config, locale: next.locale });
    }
    if (next.handMode !== previous.handMode) {
      this.setConfig({ ...this.config, handMode: next.handMode });
    }
    if (next.cameraFlipVertical !== previous.cameraFlipVertical) {
      this.setConfig({ ...this.config, cameraFlipVertical: next.cameraFlipVertical });
    }

    this.listeners.forEach((l) => l());
    return next;
  };

  setConfig = (config: CampaignConfig) => {
    this.config = config;
    this.configListeners.forEach((l) => l());
  };

  patchConfig = (patch: Partial<CampaignConfig>) => {
    this.setConfig({ ...this.config, ...patch });
  };

  /** Guarded helper for code that wants to know before dispatching. */
  can = (to: GameState['app']) => canTransition(this.state.app, to);

  getHistory = () => this.history;
}

export const store = new Store();

export function useGameState(): GameState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function useConfig(): CampaignConfig {
  return useSyncExternalStore(store.subscribeConfig, store.getConfig, store.getConfig);
}

export const dispatch = store.dispatch;
