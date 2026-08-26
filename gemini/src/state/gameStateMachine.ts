import { GameState, Difficulty, Locale, PitchData } from '../types/game';
import { DEFAULT_CAMPAIGN_CONFIG, DIFFICULTY_PRESETS } from '../config/campaign.config';

export interface GameStoreState {
  currentState: GameState;
  difficulty: Difficulty;
  locale: Locale;
  audioEnabled: boolean;
  mouseDemoMode: boolean;
  totalPitches: number;
  requiredCatches: number;
  currentPitchIndex: number;
  catchesCount: number;
  missCount: number;
  pitches: PitchData[];
  lastPitchResult: 'caught' | 'missed' | null;
  sessionId: string;
  inactivityTimer: number;
  debugOverlayEnabled: boolean;
}

const VALID_TRANSITIONS: Record<GameState, GameState[]> = {
  BOOT: ['CAMERA_PERMISSION', 'CAMERA_CALIBRATION', 'ATTRACT_MODE', 'CAMERA_ERROR'],
  CAMERA_PERMISSION: ['CAMERA_CALIBRATION', 'ATTRACT_MODE', 'CAMERA_ERROR', 'BOOT'],
  CAMERA_CALIBRATION: ['ATTRACT_MODE', 'READY', 'CAMERA_ERROR', 'BOOT'],
  ATTRACT_MODE: ['READY', 'CAMERA_CALIBRATION', 'BOOT', 'RESETTING'],
  READY: ['COUNTDOWN', 'ATTRACT_MODE', 'RESETTING'],
  COUNTDOWN: ['PITCHING', 'ATTRACT_MODE', 'RESETTING'],
  PITCHING: ['PITCH_RESULT', 'GAME_RESULT', 'ATTRACT_MODE', 'RESETTING'],
  PITCH_RESULT: ['PITCHING', 'GAME_RESULT', 'ATTRACT_MODE', 'RESETTING'],
  GAME_RESULT: ['COUPON', 'ATTRACT_MODE', 'READY', 'RESETTING'],
  COUPON: ['ATTRACT_MODE', 'READY', 'RESETTING'],
  RESETTING: ['ATTRACT_MODE', 'BOOT', 'READY'],
  CAMERA_ERROR: ['CAMERA_PERMISSION', 'ATTRACT_MODE', 'BOOT']
};

class GameStateMachine {
  private state: GameStoreState;
  private listeners: Set<(state: GameStoreState) => void> = new Set();

  constructor() {
    this.state = {
      currentState: 'BOOT',
      difficulty: 'normal',
      locale: DEFAULT_CAMPAIGN_CONFIG.locale,
      audioEnabled: DEFAULT_CAMPAIGN_CONFIG.enableAudio,
      mouseDemoMode: false,
      totalPitches: DEFAULT_CAMPAIGN_CONFIG.totalPitches,
      requiredCatches: DEFAULT_CAMPAIGN_CONFIG.requiredCatches,
      currentPitchIndex: 0,
      catchesCount: 0,
      missCount: 0,
      pitches: [],
      lastPitchResult: null,
      sessionId: this.generateSessionId(),
      inactivityTimer: DEFAULT_CAMPAIGN_CONFIG.inactivityResetSeconds,
      debugOverlayEnabled: DEFAULT_CAMPAIGN_CONFIG.enableDebugOverlay
    };
  }

  public generateSessionId(): string {
    return 'ses_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
  }

  public getState(): GameStoreState {
    return { ...this.state };
  }

  public subscribe(listener: (state: GameStoreState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach((l) => l(currentState));
  }

  public transitionTo(nextState: GameState): boolean {
    const allowed = VALID_TRANSITIONS[this.state.currentState];
    if (!allowed || !allowed.includes(nextState)) {
      console.warn(`[GameStateMachine] Invalid transition: ${this.state.currentState} -> ${nextState}`);
      return false;
    }
    this.state.currentState = nextState;
    this.notify();
    return true;
  }

  public setDifficulty(difficulty: Difficulty) {
    this.state.difficulty = difficulty;
    this.notify();
  }

  public setLocale(locale: Locale) {
    this.state.locale = locale;
    this.notify();
  }

  public setAudioEnabled(enabled: boolean) {
    this.state.audioEnabled = enabled;
    this.notify();
  }

  public setMouseDemoMode(enabled: boolean) {
    this.state.mouseDemoMode = enabled;
    this.notify();
  }

  public toggleDebugOverlay() {
    this.state.debugOverlayEnabled = !this.state.debugOverlayEnabled;
    this.notify();
  }

  public startNewGame() {
    this.state.sessionId = this.generateSessionId();
    this.state.currentPitchIndex = 0;
    this.state.catchesCount = 0;
    this.state.missCount = 0;
    this.state.pitches = [];
    this.state.lastPitchResult = null;
    this.state.currentState = 'READY';
    this.notify();
  }

  public recordCatch() {
    this.state.catchesCount += 1;
    this.state.lastPitchResult = 'caught';
    this.notify();
  }

  public recordMiss() {
    this.state.missCount += 1;
    this.state.lastPitchResult = 'missed';
    this.notify();
  }

  public advancePitch(nextPitchIndex: number) {
    this.state.currentPitchIndex = nextPitchIndex;
    this.notify();
  }

  public isGameWon(): boolean {
    return this.state.catchesCount >= this.state.requiredCatches;
  }

  public resetToAttract() {
    this.state.currentPitchIndex = 0;
    this.state.catchesCount = 0;
    this.state.missCount = 0;
    this.state.pitches = [];
    this.state.lastPitchResult = null;
    this.state.currentState = 'ATTRACT_MODE';
    this.notify();
  }
}

export const gameStateMachine = new GameStateMachine();
