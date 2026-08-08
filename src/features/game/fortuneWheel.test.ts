import { describe, expect, it } from 'vitest';
import type { CountriesCitiesWheelState } from '../../protocol/messages';
import {
  COUNTRIES_CITIES_LETTERS,
  FULL_TURN,
  hiddenTargetLetter,
  initialWheelRotation,
  rotationForIndex,
  wheelRotation,
  wheelSpinProgress,
} from './fortuneWheel';

const spinningState: CountriesCitiesWheelState = {
  schemaVersion: 1,
  phase: 'spinning',
  hostSessionId: 'session-1',
  roundNumber: 1,
  spinId: 'spin-1',
  selectedPlayerId: 'player-1',
  waitingStartedAt: 1_000,
  waitingDeadlineAt: 11_000,
  spinStartedAt: 2_000,
  spinDurationMs: 6_000,
  spinSeed: 4,
  finalTurns: 6,
};

describe('fortune wheel math', () => {
  it('derives animation progress only from host timestamps', () => {
    expect(wheelSpinProgress(spinningState, 2_000)).toBe(0);
    expect(wheelSpinProgress(spinningState, 5_000)).toBeCloseTo(0.5);
    expect(wheelSpinProgress(spinningState, 8_000)).toBe(1);
    expect(wheelSpinProgress(spinningState, 20_000)).toBe(1);
  });

  it('keeps the same trajectory for repeated snapshots', () => {
    const first = wheelRotation(spinningState, 4_250);
    const repeated = wheelRotation({ ...spinningState }, 4_250);
    expect(repeated).toBeCloseTo(first, 10);
    expect(first).toBeGreaterThan(initialWheelRotation(spinningState));
  });

  it('uses spinSeed for the hidden target without exposing a result letter', () => {
    expect(hiddenTargetLetter(spinningState)).toBe(COUNTRIES_CITIES_LETTERS[4]);
    expect(spinningState.letter).toBeUndefined();
  });

  it('ends on the host-revealed letter', () => {
    const finished: CountriesCitiesWheelState = { ...spinningState, phase: 'finished', letter: 'R' };
    const index = COUNTRIES_CITIES_LETTERS.indexOf('R');
    expect(wheelRotation(finished, 50_000)).toBeCloseTo(rotationForIndex(COUNTRIES_CITIES_LETTERS, index));
  });

  it('includes the configured full turns before the target offset', () => {
    const initial = initialWheelRotation(spinningState);
    const finalDuringSpin = wheelRotation(spinningState, 8_000);
    expect(finalDuringSpin - initial).toBeGreaterThanOrEqual(6 * FULL_TURN);
    expect(finalDuringSpin - initial).toBeLessThan(7 * FULL_TURN);
  });
});
