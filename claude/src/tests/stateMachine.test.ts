import { describe, expect, it } from 'vitest';
import {
  canTransition,
  createInitialState,
  hasWon,
  isSequenceComplete,
  reduce,
  type GameAction,
  type GameState,
  type SessionRules,
} from '../core/stateMachine';

const RULES: SessionRules = { totalPitches: 5, requiredCatches: 3 };

function run(state: GameState, actions: GameAction[]): GameState {
  return actions.reduce((acc, action) => reduce(acc, action, RULES), state);
}

/** Drives a full game: countdown, N pitches with the given outcomes, result. */
function playGame(outcomes: Array<'catch' | 'miss'>): GameState {
  let state = run(createInitialState(), [
    { type: 'BOOT_COMPLETE' },
    { type: 'CAMERA_SKIPPED' },
    { type: 'READY_UP' },
    { type: 'START_COUNTDOWN' },
    { type: 'START_PITCHING' },
  ]);

  for (const outcome of outcomes) {
    state = run(state, [
      { type: 'NEXT_PITCH' },
      { type: 'PITCH_RELEASED' },
      { type: 'PITCH_RESOLVED', outcome },
    ]);
  }
  return reduce(state, { type: 'GAME_COMPLETE' }, RULES);
}

describe('transition table', () => {
  it('allows only declared transitions', () => {
    expect(canTransition('BOOT', 'CAMERA_PERMISSION')).toBe(true);
    expect(canTransition('ATTRACT_MODE', 'READY')).toBe(true);
    expect(canTransition('BOOT', 'PITCHING')).toBe(false);
    expect(canTransition('GAME_RESULT', 'PITCHING')).toBe(false);
  });

  it('never treats a self-transition as valid', () => {
    expect(canTransition('PITCHING', 'PITCHING')).toBe(false);
  });
});

describe('game start guards', () => {
  it('only arms a game from attract mode', () => {
    const boot = createInitialState();
    expect(reduce(boot, { type: 'READY_UP' }, RULES).app).toBe('BOOT');
  });

  it('ignores a duplicate start once already running', () => {
    const state = run(createInitialState(), [
      { type: 'BOOT_COMPLETE' },
      { type: 'CAMERA_SKIPPED' },
      { type: 'READY_UP' },
    ]);
    const again = reduce(state, { type: 'READY_UP' }, RULES);
    expect(again.runId).toBe(state.runId);
    expect(again.app).toBe('READY');
  });
});

describe('pitch counting and scoring', () => {
  it('counts one release per pitch and stops at the configured total', () => {
    let state = run(createInitialState(), [
      { type: 'BOOT_COMPLETE' },
      { type: 'CAMERA_SKIPPED' },
      { type: 'READY_UP' },
      { type: 'START_COUNTDOWN' },
      { type: 'START_PITCHING' },
    ]);
    for (let i = 0; i < 8; i++) {
      state = run(state, [{ type: 'NEXT_PITCH' }, { type: 'PITCH_RELEASED' }, { type: 'PITCH_RESOLVED', outcome: 'miss' }]);
    }
    expect(state.pitchIndex).toBe(RULES.totalPitches);
    expect(state.outcomes).toHaveLength(RULES.totalPitches);
  });

  it('scores a pitch only once even if resolved twice', () => {
    let state = run(createInitialState(), [
      { type: 'BOOT_COMPLETE' },
      { type: 'CAMERA_SKIPPED' },
      { type: 'READY_UP' },
      { type: 'START_COUNTDOWN' },
      { type: 'START_PITCHING' },
      { type: 'PITCH_RELEASED' },
      { type: 'PITCH_RESOLVED', outcome: 'catch' },
    ]);
    state = reduce(state, { type: 'PITCH_RESOLVED', outcome: 'catch' }, RULES);
    expect(state.catches).toBe(1);
    expect(state.outcomes).toHaveLength(1);
  });
});

describe('win condition', () => {
  it('wins with three catches out of five', () => {
    const state = playGame(['catch', 'miss', 'catch', 'miss', 'catch']);
    expect(state.app).toBe('GAME_RESULT');
    expect(state.catches).toBe(3);
    expect(state.won).toBe(true);
  });

  it('loses with two catches', () => {
    const state = playGame(['catch', 'miss', 'catch', 'miss', 'miss']);
    expect(state.won).toBe(false);
  });

  it('exposes the raw predicate', () => {
    expect(hasWon(3, 3)).toBe(true);
    expect(hasWon(2, 3)).toBe(false);
  });

  it('knows when the sequence is complete', () => {
    const state = playGame(['miss', 'miss', 'miss', 'miss', 'miss']);
    expect(isSequenceComplete(state, RULES)).toBe(true);
  });
});

describe('coupon gating', () => {
  it('never opens the coupon screen after a loss', () => {
    const lost = playGame(['catch', 'miss', 'miss', 'miss', 'miss']);
    expect(reduce(lost, { type: 'SHOW_COUPON' }, RULES).app).toBe('GAME_RESULT');
  });

  it('opens the coupon screen after a win', () => {
    const won = playGame(['catch', 'catch', 'catch', 'miss', 'miss']);
    expect(reduce(won, { type: 'SHOW_COUPON' }, RULES).app).toBe('COUPON');
  });
});

describe('reset and replay', () => {
  it('clears progress and issues a new session id on reset', () => {
    const played = playGame(['catch', 'catch', 'catch', 'catch', 'catch']);
    const reset = reduce(played, { type: 'RESET', reason: 'inactivity' }, RULES);
    expect(reset.app).toBe('RESETTING');
    expect(reset.catches).toBe(0);
    expect(reset.outcomes).toEqual([]);
    expect(reset.sessionId).not.toBe(played.sessionId);

    const done = reduce(reset, { type: 'RESET_COMPLETE' }, RULES);
    expect(done.app).toBe('ATTRACT_MODE');
  });

  it('replays without losing player preferences', () => {
    const played = playGame(['catch', 'catch', 'catch', 'miss', 'miss']);
    const withPrefs = reduce(played, { type: 'SET_DIFFICULTY', difficulty: 'easy' }, RULES);
    const again = reduce(withPrefs, { type: 'PLAY_AGAIN' }, RULES);
    expect(again.app).toBe('READY');
    expect(again.catches).toBe(0);
    expect(again.difficulty).toBe('easy');
    expect(again.runId).toBe(played.runId + 1);
  });
});

describe('camera fallbacks', () => {
  it('falls back to mouse mode without dead-ending', () => {
    const denied = run(createInitialState(), [{ type: 'BOOT_COMPLETE' }, { type: 'CAMERA_DENIED', code: 'permission_denied' }]);
    expect(denied.app).toBe('CAMERA_ERROR');
    const mouse = reduce(denied, { type: 'CAMERA_SKIPPED' }, RULES);
    expect(mouse.app).toBe('ATTRACT_MODE');
    expect(mouse.inputMode).toBe('mouse');
  });
});
