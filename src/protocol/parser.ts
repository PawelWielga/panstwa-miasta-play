import { hostMessageTypes, MAX_MESSAGE_BYTES, PROTOCOL_VERSION } from './constants';
import { encodedMessageSize } from './messageSize';
import type { HostMessage, JsonValue } from './messages';
import {
  hasValidMetadata, isBoundedString, isFiniteNumber, isInteger, isJsonValue, isRecord,
  parseAnswerResults, parseCategories, parseNumberMap, parsePlayerProfile, parseSettings,
  parseSnapshot, parseSubmission,
} from './validation';

const knownTypes = new Set<string>(hostMessageTypes);

export type HostMessageParseResult = { ok: true; message: HostMessage } | { ok: false; reason: string };

export function parseHostMessage(data: unknown): HostMessageParseResult {
  if (!isJsonValue(data)) return { ok: false, reason: 'Wiadomość nie jest poprawnym JSON-em.' };
  if (encodedMessageSize(data as JsonValue) > MAX_MESSAGE_BYTES) return { ok: false, reason: 'Wiadomość przekracza limit 64 KiB.' };
  if (!isRecord(data) || typeof data.type !== 'string' || !knownTypes.has(data.type) || !hasValidMetadata(data)) return { ok: false, reason: 'Nieobsługiwany lub niepoprawny typ wiadomości.' };
  const metadata = pickMetadata(data);
  switch (data.type) {
    case 'room:players': {
      if (data.protocolVersion !== PROTOCOL_VERSION || !Array.isArray(data.players)) return invalid();
      const players = data.players.map(parsePlayerProfile);
      if (players.some((player) => player === null)) return invalid();
      return ok({ type: data.type, protocolVersion: data.protocolVersion, players: players as NonNullable<(typeof players)[number]>[], ...metadata });
    }
    case 'game:reset': case 'game:start': return ok({ type: data.type, ...metadata });
    case 'game:error':
      return typeof data.message === 'string' && (data.code === undefined || typeof data.code === 'string') ? ok({ type: data.type, message: data.message, ...(typeof data.code === 'string' ? { code: data.code } : {}), ...metadata }) : invalid();
    case 'host:heartbeat':
      return typeof data.gameId === 'string' && isInteger(data.sequenceNumber) ? ok({ type: data.type, gameId: data.gameId, sequenceNumber: data.sequenceNumber, ...metadata }) : invalid();
    case 'host:lost':
      return typeof data.gameId === 'string' && typeof data.lostHostPlayerId === 'string' && isInteger(data.sequenceNumber) ? ok({ type: data.type, gameId: data.gameId, lostHostPlayerId: data.lostHostPlayerId, sequenceNumber: data.sequenceNumber, ...metadata }) : invalid();
    case 'host:migration-started':
      return typeof data.gameId === 'string' && typeof data.lostHostPlayerId === 'string' && typeof data.candidateHostPlayerId === 'string' && isInteger(data.sequenceNumber) ? ok({ type: data.type, gameId: data.gameId, lostHostPlayerId: data.lostHostPlayerId, candidateHostPlayerId: data.candidateHostPlayerId, sequenceNumber: data.sequenceNumber, ...metadata }) : invalid();
    case 'host:migrated': {
      const snapshot = parseSnapshot(data.snapshot);
      return typeof data.gameId === 'string' && typeof data.newHostPlayerId === 'string' && typeof data.newHostIp === 'string' && isInteger(data.newHostPort) && isInteger(data.sequenceNumber) && snapshot ? ok({ type: data.type, gameId: data.gameId, newHostPlayerId: data.newHostPlayerId, newHostIp: data.newHostIp, newHostPort: data.newHostPort, sequenceNumber: data.sequenceNumber, snapshot, ...metadata }) : invalid();
    }
    case 'game:snapshot': {
      const snapshot = parseSnapshot(data.snapshot); return snapshot ? ok({ type: data.type, snapshot, ...metadata }) : invalid();
    }
    case 'countries-cities:settings': {
      const categories = parseCategories(data.categories); const settings = parseSettings(data.settings);
      return categories && settings && typeof data.endMode === 'string' && typeof data.timeMode === 'string' && typeof data.hostControlsReview === 'boolean' ? ok({ type: data.type, categories, settings, endMode: data.endMode, timeMode: data.timeMode, hostControlsReview: data.hostControlsReview, ...metadata }) : invalid();
    }
    case 'countries-cities:start-round':
      return typeof data.letter === 'string' && Array.isArray(data.usedLetters) && data.usedLetters.every((item) => typeof item === 'string') ? ok({ type: data.type, letter: data.letter, usedLetters: [...data.usedLetters] as string[], ...metadata }) : invalid();
    case 'countries-cities:deadline':
      return isFiniteNumber(data.deadlineAt) ? ok({ type: data.type, deadlineAt: data.deadlineAt, ...metadata }) : invalid();
    case 'countries-cities:review': {
      if (!Array.isArray(data.submissions) || !isInteger(data.categoryIndex)) return invalid();
      const submissions = data.submissions.map(parseSubmission); if (submissions.some((item) => item === null)) return invalid();
      return ok({ type: data.type, submissions: submissions as NonNullable<(typeof submissions)[number]>[], categoryIndex: data.categoryIndex, ...metadata });
    }
    case 'countries-cities:vote':
      return typeof data.answerId === 'string' && typeof data.vote === 'string' ? ok({ type: data.type, answerId: data.answerId, vote: data.vote, ...metadata }) : invalid();
    case 'countries-cities:review-ready':
      return isInteger(data.categoryIndex) && isBoundedString(data.playerId, 64) ? ok({ type: data.type, categoryIndex: data.categoryIndex, playerId: data.playerId, ...metadata }) : invalid();
    case 'countries-cities:reveal': {
      const finalResults = parseAnswerResults(data.finalResults); return isInteger(data.categoryIndex) && finalResults ? ok({ type: data.type, categoryIndex: data.categoryIndex, finalResults, ...metadata }) : invalid();
    }
    case 'countries-cities:results': {
      const finalResults = parseAnswerResults(data.finalResults); const roundScores = parseNumberMap(data.roundScores); const finalScores = parseNumberMap(data.finalScores);
      return finalResults && roundScores && finalScores ? ok({ type: data.type, finalResults, roundScores, finalScores, ...metadata }) : invalid();
    }
  }
}

function pickMetadata(value: Record<string, unknown>): { requestId?: string; senderId?: string; sentAt?: number } {
  return {
    ...(typeof value.requestId === 'string' ? { requestId: value.requestId } : {}),
    ...(typeof value.senderId === 'string' ? { senderId: value.senderId } : {}),
    ...(typeof value.sentAt === 'number' ? { sentAt: value.sentAt } : {}),
  };
}
function ok(message: HostMessage): HostMessageParseResult { return { ok: true, message }; }
function invalid(): HostMessageParseResult { return { ok: false, reason: 'Wiadomość hosta ma niepoprawną strukturę.' }; }
