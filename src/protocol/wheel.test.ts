import fixtureText from '../test/fixtures/countries_cities_wheel_state_v1.json?raw';
import { describe, expect, it } from 'vitest';
import { parseWheelState } from './wheel';

const EXPECTED_FIXTURE_SHA256 = 'acd182719da31bf1f36300b0749cd08d7829968b9bb712135ae55c99c0dd2031';
const fixtureBytes = new TextEncoder().encode(fixtureText);
const fixture = JSON.parse(fixtureText) as WheelContractFixture;

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

  it('treats null optional waiting fields as absent', () => {
    expect(parseWheelState({
      ...waitingState,
      spinStartedAt: null,
      spinDurationMs: null,
      spinSeed: null,
      finalTurns: null,
      letter: null,
    })).toEqual(waitingState);
  });

  it('accepts a host-selected animation profile while waiting', () => {
    expect(parseWheelState({ ...waitingState, spinSeed: 12345, finalTurns: 7 })).toMatchObject({
      phase: 'waiting',
      spinSeed: 12345,
      finalTurns: 7,
    });
    expect(parseWheelState({ ...waitingState, spinSeed: -1, finalTurns: 7 })).toBeNull();
    expect(parseWheelState({ ...waitingState, spinSeed: 12345, finalTurns: 21 })).toBeNull();
  });

  it('parses the authoritative letter pool and rejects malformed pools', () => {
    expect(parseWheelState({ ...waitingState, letterPool: ['a', 'B', 'Ł'] })).toMatchObject({
      letterPool: ['A', 'B', 'Ł'],
    });
    expect(parseWheelState({ ...waitingState, letterPool: [] })).toBeNull();
    expect(parseWheelState({ ...waitingState, letterPool: ['A', 'A'] })).toBeNull();
    expect(parseWheelState({ ...waitingState, letterPool: ['AB'] })).toBeNull();
  });

  it('matches the shared Flutter and WWW wheel vectors', async () => {
    const digest = await crypto.subtle.digest('SHA-256', fixtureBytes);
    expect(toHex(digest)).toBe(EXPECTED_FIXTURE_SHA256);
    expect(fixture.schemaVersion).toBe(1);
    expect(fixture.contractId).toBe('countries-cities-wheel-state-v1');

    expect(parseWheelState(fixture.states.waiting)).toEqual(fixture.states.waiting);
    expect(parseWheelState(fixture.states.spinning)).toEqual(fixture.states.spinning);
    expect(parseWheelState(fixture.states.finished)).toEqual(fixture.states.finished);
    for (const vector of Object.values(fixture.invalidStates)) {
      expect(parseWheelState(vector)).toBeNull();
    }
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

interface WheelContractFixture {
  schemaVersion: number;
  contractId: string;
  states: {
    waiting: Record<string, unknown>;
    spinning: Record<string, unknown>;
    finished: Record<string, unknown>;
  };
  invalidStates: Record<string, Record<string, unknown>>;
}

function toHex(value: ArrayBuffer): string {
  return Array.from(
    new Uint8Array(value),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
}
