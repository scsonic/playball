import type { AppState, Difficulty, HandMode, Locale, PitchOutcome } from '../types';

/**
 * Explicit, table-driven state machine.
 *
 * Every transition must be declared here. Anything else is rejected (and
 * reported), which is what prevents duplicate game starts, double-scored
 * pitches and "stuck" kiosk sessions.
 */
export const TRANSITIONS: Record<AppState, AppState[]> = {
  BOOT: ['CAMERA_PERMISSION', 'CAMERA_ERROR'],
  CAMERA_PERMISSION: ['CAMERA_CALIBRATION', 'ATTRACT_MODE', 'CAMERA_ERROR'],
  CAMERA_CALIBRATION: ['ATTRACT_MODE', 'CAMERA_ERROR', 'CAMERA_PERMISSION'],
  ATTRACT_MODE: ['READY', 'CAMERA_PERMISSION', 'CAMERA_CALIBRATION', 'CAMERA_ERROR', 'RESETTING'],
  // GAME_RESULT is reachable from READY/COUNTDOWN so an operator can jump
  // straight to a simulated result during a sponsor walkthrough.
  READY: ['COUNTDOWN', 'ATTRACT_MODE', 'RESETTING', 'CAMERA_ERROR', 'GAME_RESULT'],
  COUNTDOWN: ['PITCHING', 'RESETTING', 'ATTRACT_MODE', 'CAMERA_ERROR', 'GAME_RESULT'],
  PITCHING: ['PITCH_RESULT', 'GAME_RESULT', 'RESETTING', 'CAMERA_ERROR'],
  PITCH_RESULT: ['PITCHING', 'GAME_RESULT', 'RESETTING', 'CAMERA_ERROR'],
  GAME_RESULT: ['COUPON', 'READY', 'ATTRACT_MODE', 'RESETTING'],
  COUPON: ['ATTRACT_MODE', 'READY', 'RESETTING'],
  RESETTING: ['ATTRACT_MODE', 'CAMERA_PERMISSION', 'CAMERA_ERROR'],
  CAMERA_ERROR: ['CAMERA_PERMISSION', 'ATTRACT_MODE', 'RESETTING'],
};

export function canTransition(from: AppState, to: AppState): boolean {
  if (from === to) return false;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export type InputMode = 'camera' | 'mouse';

export interface GameState {
  app: AppState;
  /** Number of pitches already released this session. */
  pitchIndex: number;
  catches: number;
  outcomes: PitchOutcome[];
  lastOutcome: PitchOutcome | null;
  won: boolean;
  sessionId: string;
  /** Increments on every new game, used to key engine runs. */
  runId: number;
  inputMode: InputMode;
  cameraReady: boolean;
  calibrated: boolean;
  locale: Locale;
  difficulty: Difficulty;
  handMode: HandMode;
  audioEnabled: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  debugOverlay: boolean;
  demoWatermark: boolean;
  errorCode: string | null;
  lastInteractionAt: number;
}

export type GameAction =
  | { type: 'BOOT_COMPLETE' }
  | { type: 'CAMERA_GRANTED' }
  | { type: 'CAMERA_DENIED'; code: string }
  | { type: 'CAMERA_SKIPPED' }
  | { type: 'RETRY_CAMERA' }
  | { type: 'CALIBRATED' }
  | { type: 'RECALIBRATE' }
  | { type: 'GO_ATTRACT' }
  | { type: 'READY_UP' }
  | { type: 'START_COUNTDOWN' }
  | { type: 'START_PITCHING' }
  | { type: 'PITCH_RELEASED' }
  | { type: 'PITCH_RESOLVED'; outcome: PitchOutcome }
  | { type: 'NEXT_PITCH' }
  | { type: 'GAME_COMPLETE' }
  | { type: 'SHOW_COUPON' }
  | { type: 'PLAY_AGAIN' }
  | { type: 'RESET'; reason: 'manual' | 'inactivity' | 'admin' | 'coupon_timeout' }
  | { type: 'RESET_COMPLETE' }
  | { type: 'SET_LOCALE'; locale: Locale }
  | { type: 'SET_DIFFICULTY'; difficulty: Difficulty }
  | { type: 'SET_HAND_MODE'; handMode: HandMode }
  | { type: 'TOGGLE_AUDIO' }
  | { type: 'TOGGLE_REDUCED_MOTION' }
  | { type: 'TOGGLE_HIGH_CONTRAST' }
  | { type: 'TOGGLE_DEBUG' }
  | { type: 'TOGGLE_WATERMARK' }
  | { type: 'SET_INPUT_MODE'; mode: InputMode }
  | { type: 'CAMERA_LOST'; code: string }
  | { type: 'TOUCH' }
  | { type: 'FORCE_RESULT'; won: boolean };

export interface SessionRules {
  totalPitches: number;
  requiredCatches: number;
}

export function createInitialState(overrides: Partial<GameState> = {}): GameState {
  return {
    app: 'BOOT',
    pitchIndex: 0,
    catches: 0,
    outcomes: [],
    lastOutcome: null,
    won: false,
    sessionId: createSessionId(),
    runId: 0,
    inputMode: 'camera',
    cameraReady: false,
    calibrated: false,
    locale: 'ja',
    difficulty: 'normal',
    handMode: 'left',
    audioEnabled: true,
    reducedMotion: false,
    highContrast: false,
    debugOverlay: false,
    demoWatermark: true,
    errorCode: null,
    lastInteractionAt: 0,
    ...overrides,
  };
}

export function createSessionId(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Clears per-game progress without touching player preferences. */
function resetProgress(state: GameState): GameState {
  return {
    ...state,
    pitchIndex: 0,
    catches: 0,
    outcomes: [],
    lastOutcome: null,
    won: false,
  };
}

function go(state: GameState, to: AppState): GameState {
  if (!canTransition(state.app, to)) return state;
  return { ...state, app: to };
}

/**
 * Pure reducer. All gameplay progression funnels through here so it can be
 * unit-tested without a browser, a canvas or a webcam.
 */
export function reduce(state: GameState, action: GameAction, rules: SessionRules): GameState {
  switch (action.type) {
    case 'BOOT_COMPLETE':
      return go(state, 'CAMERA_PERMISSION');

    case 'CAMERA_GRANTED':
      return go({ ...state, cameraReady: true, errorCode: null, inputMode: 'camera' }, 'CAMERA_CALIBRATION');

    case 'CAMERA_DENIED':
      return go({ ...state, cameraReady: false, errorCode: action.code }, 'CAMERA_ERROR');

    case 'CAMERA_SKIPPED':
      return go({ ...state, inputMode: 'mouse', cameraReady: false, calibrated: true }, 'ATTRACT_MODE');

    case 'RETRY_CAMERA':
      return go({ ...state, errorCode: null }, 'CAMERA_PERMISSION');

    case 'CALIBRATED':
      return go({ ...state, calibrated: true }, 'ATTRACT_MODE');

    case 'RECALIBRATE':
      return go({ ...state, calibrated: false }, 'CAMERA_CALIBRATION');

    case 'GO_ATTRACT':
      return go(resetProgress(state), 'ATTRACT_MODE');

    case 'READY_UP':
      // Guard against double starts: only ATTRACT_MODE may arm a new game.
      if (state.app !== 'ATTRACT_MODE') return state;
      return go({ ...resetProgress(state), runId: state.runId + 1 }, 'READY');

    case 'START_COUNTDOWN':
      return go(state, 'COUNTDOWN');

    case 'START_PITCHING':
      return go(state, 'PITCHING');

    case 'PITCH_RELEASED':
      if (state.app !== 'PITCHING') return state;
      if (state.pitchIndex >= rules.totalPitches) return state;
      return { ...state, pitchIndex: state.pitchIndex + 1 };

    case 'PITCH_RESOLVED': {
      if (state.app !== 'PITCHING') return state;
      // One pitch can only be scored once: outcomes length must trail pitchIndex.
      if (state.outcomes.length >= state.pitchIndex) return state;
      const outcomes = [...state.outcomes, action.outcome];
      const catches = state.catches + (action.outcome === 'catch' ? 1 : 0);
      return go({ ...state, outcomes, catches, lastOutcome: action.outcome }, 'PITCH_RESULT');
    }

    case 'NEXT_PITCH':
      return go(state, 'PITCHING');

    case 'GAME_COMPLETE': {
      const won = state.catches >= rules.requiredCatches;
      return go({ ...state, won }, 'GAME_RESULT');
    }

    case 'FORCE_RESULT':
      return go(
        {
          ...state,
          won: action.won,
          catches: action.won ? rules.requiredCatches : Math.max(0, rules.requiredCatches - 2),
          pitchIndex: rules.totalPitches,
        },
        'GAME_RESULT',
      );

    case 'SHOW_COUPON':
      if (!state.won) return state; // never issue a coupon from a losing result
      return go(state, 'COUPON');

    case 'PLAY_AGAIN':
      return go({ ...resetProgress(state), runId: state.runId + 1 }, 'READY');

    case 'RESET':
      return go({ ...resetProgress(state), sessionId: createSessionId() }, 'RESETTING');

    case 'RESET_COMPLETE':
      return go(state, state.cameraReady || state.inputMode === 'mouse' ? 'ATTRACT_MODE' : 'CAMERA_PERMISSION');

    case 'CAMERA_LOST':
      return go({ ...state, cameraReady: false, errorCode: action.code }, 'CAMERA_ERROR');

    case 'SET_LOCALE':
      return { ...state, locale: action.locale };
    case 'SET_DIFFICULTY':
      return { ...state, difficulty: action.difficulty };
    case 'SET_HAND_MODE':
      return { ...state, handMode: action.handMode };
    case 'TOGGLE_AUDIO':
      return { ...state, audioEnabled: !state.audioEnabled };
    case 'TOGGLE_REDUCED_MOTION':
      return { ...state, reducedMotion: !state.reducedMotion };
    case 'TOGGLE_HIGH_CONTRAST':
      return { ...state, highContrast: !state.highContrast };
    case 'TOGGLE_DEBUG':
      return { ...state, debugOverlay: !state.debugOverlay };
    case 'TOGGLE_WATERMARK':
      return { ...state, demoWatermark: !state.demoWatermark };
    case 'SET_INPUT_MODE':
      return { ...state, inputMode: action.mode };
    case 'TOUCH':
      return { ...state, lastInteractionAt: Date.now() };

    default:
      return state;
  }
}

/** Win condition helper — shared by the reducer, the UI and the coupon service. */
export function hasWon(catches: number, requiredCatches: number): boolean {
  return catches >= requiredCatches;
}

/** True once every configured pitch has been thrown and resolved. */
export function isSequenceComplete(state: GameState, rules: SessionRules): boolean {
  return state.outcomes.length >= rules.totalPitches;
}
