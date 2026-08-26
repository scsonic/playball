import { describe, it, expect, beforeEach } from 'vitest';
import { gameStateMachine } from '../state/gameStateMachine';

describe('GameStateMachine', () => {
  beforeEach(() => {
    gameStateMachine.resetToAttract();
  });

  it('initializes in a valid state and allows starting a new game', () => {
    gameStateMachine.startNewGame();
    expect(gameStateMachine.getState().currentState).toBe('READY');
    expect(gameStateMachine.getState().catchesCount).toBe(0);
    expect(gameStateMachine.getState().totalPitches).toBe(5);
    expect(gameStateMachine.getState().requiredCatches).toBe(3);
  });

  it('correctly records catches and advances pitch index', () => {
    gameStateMachine.startNewGame();
    gameStateMachine.transitionTo('COUNTDOWN');
    gameStateMachine.transitionTo('PITCHING');

    gameStateMachine.recordCatch();
    expect(gameStateMachine.getState().catchesCount).toBe(1);
    expect(gameStateMachine.getState().lastPitchResult).toBe('caught');

    gameStateMachine.recordMiss();
    expect(gameStateMachine.getState().missCount).toBe(1);
    expect(gameStateMachine.getState().lastPitchResult).toBe('missed');
  });

  it('determines win condition correctly (at least 3 catches)', () => {
    gameStateMachine.startNewGame();
    expect(gameStateMachine.isGameWon()).toBe(false);

    gameStateMachine.recordCatch();
    gameStateMachine.recordCatch();
    expect(gameStateMachine.isGameWon()).toBe(false);

    gameStateMachine.recordCatch();
    expect(gameStateMachine.isGameWon()).toBe(true);
  });

  it('blocks invalid state transitions', () => {
    gameStateMachine.resetToAttract();
    // Cannot jump straight from ATTRACT_MODE to PITCH_RESULT
    const success = gameStateMachine.transitionTo('PITCH_RESULT');
    expect(success).toBe(false);
    expect(gameStateMachine.getState().currentState).toBe('ATTRACT_MODE');
  });
});
