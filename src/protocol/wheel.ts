import { REQUEST_ID_MAX_LENGTH } from './constants';
import type { CountriesCitiesWheelPhase, CountriesCitiesWheelState } from './messages';

export const COUNTRIES_CITIES_WHEEL_SCHEMA_VERSION = 1 as const;

const wheelPhases = new Set<CountriesCitiesWheelPhase>(['waiting', 'spinning', 'finished']);

export function parseWheelState(value: unknown): CountriesCitiesWheelState | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== COUNTRIES_CITIES_WHEEL_SCHEMA_VERSION) return null;
  if (typeof value.phase !== 'string' || !wheelPhases.has(value.phase as CountriesCitiesWheelPhase)) return null;
  if (!isBoundedString(value.hostSessionId, REQUEST_ID_MAX_LENGTH)) return null;
  if (!isInteger(value.roundNumber) || value.roundNumber <= 0) return null;
  if (!isBoundedString(value.spinId, REQUEST_ID_MAX_LENGTH)) return null;
  if (!isBoundedString(value.selectedPlayerId, REQUEST_ID_MAX_LENGTH)) return null;
  if (!isFiniteNumber(value.waitingStartedAt) || value.waitingStartedAt < 0) return null;
  if (!isFiniteNumber(value.waitingDeadlineAt) || value.waitingDeadlineAt < value.waitingStartedAt) return null;

  const phase = value.phase as CountriesCitiesWheelPhase;
  if (phase === 'waiting') {
    if (value.spinStartedAt !== undefined || value.spinDurationMs !== undefined || value.spinSeed !== undefined || value.finalTurns !== undefined || value.letter !== undefined) return null;
    return {
      schemaVersion: COUNTRIES_CITIES_WHEEL_SCHEMA_VERSION,
      phase,
      hostSessionId: value.hostSessionId,
      roundNumber: value.roundNumber,
      spinId: value.spinId,
      selectedPlayerId: value.selectedPlayerId,
      waitingStartedAt: value.waitingStartedAt,
      waitingDeadlineAt: value.waitingDeadlineAt,
    };
  }

  if (!isFiniteNumber(value.spinStartedAt) || value.spinStartedAt < 0) return null;
  if (!isInteger(value.spinDurationMs) || value.spinDurationMs < 250 || value.spinDurationMs > 60_000) return null;
  if (!isInteger(value.spinSeed) || value.spinSeed < 0) return null;
  if (!isInteger(value.finalTurns) || value.finalTurns < 1 || value.finalTurns > 20) return null;

  if (phase === 'spinning' && value.letter !== undefined) return null;
  const revealedLetter = phase === 'finished' && typeof value.letter === 'string'
    ? value.letter.trim().toUpperCase()
    : undefined;
  if (phase === 'finished' && (!revealedLetter || revealedLetter.length > 4)) return null;

  return {
    schemaVersion: COUNTRIES_CITIES_WHEEL_SCHEMA_VERSION,
    phase,
    hostSessionId: value.hostSessionId,
    roundNumber: value.roundNumber,
    spinId: value.spinId,
    selectedPlayerId: value.selectedPlayerId,
    waitingStartedAt: value.waitingStartedAt,
    waitingDeadlineAt: value.waitingDeadlineAt,
    spinStartedAt: value.spinStartedAt,
    spinDurationMs: value.spinDurationMs,
    spinSeed: value.spinSeed,
    finalTurns: value.finalTurns,
    ...(revealedLetter ? { letter: revealedLetter } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBoundedString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value);
}
