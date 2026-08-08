import { describe, expect, it } from 'vitest';
import { parseWheelState } from './wheel';

const waitingState = {
  schemaVersion: 1,
  phase: 'waiting',
  hostSessionId: 'session-1',
  roundNumber: 2,
  spinId: 'spin-2',
  selectedPlayerId: 'player-1',
  waitingStartedAt: 1_000,
  waitingDeadlineAt: 11_000,
};

const spinningState = {
  ...waitingState,
  phase: 'spinning',
  spinStartedAt: 2_000,
  spinDurationMs: 6_000,
  spinSeed: 12345,
  finalTurns: 6,
};

describe('parseWheelState', () => {
  it('parses waiting, spinning and finished states', () => {
    expect(parseWheelState(waitingState)).toEqual(waitingState);
    expect(parseWheelState(spinningState)).toEqual(spinningState);
    expect(parseWheelState({ ...spinningState, phase: 'finished', letter: 'ą' })).toMatchObject({
      phase: 'finished',
      letter: 'Ą',
    });
  });

  it('does not expose a letter before finished', () => {
    expect(parseWheelState({ ...waitingState, letter: 'A' })).toBeNull();
    expect(parseWheelState({ ...spinningState, letter: 'A' })).toBeNull();
  });

  it('rejects unsupported versions and malformed animation parameters', () => {
    expect(parseWheelState({ ...waitingState, schemaVersion: 2 })).toBeNull();
    expect(parseWheelState({ ...spinningState, spinDurationMs: 249 })).toBeNull();
    expect(parseWheelState({ ...spinningState, finalTurns: 21 })).toBeNull();
    expect(parseWheelState({ ...waitingState, spinId: 'x'.repeat(129) })).toBeNull();
  });

  it('requires the result only after the spin is finished', () => {
    expect(parseWheelState({ ...spinningState, phase: 'finished' })).toBeNull();
  });
});
