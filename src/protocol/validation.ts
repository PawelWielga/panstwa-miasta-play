import {
  ANSWER_MAX_LENGTH,
  CATEGORY_ID_MAX_LENGTH,
  CATEGORY_NAME_MAX_LENGTH,
  MAX_COUNTRIES_CITIES_CATEGORIES,
  MAX_COUNTRIES_CITIES_PLAYERS,
  PLAYER_COLOR_MAX_LENGTH,
  PLAYER_EMOJI_MAX_LENGTH,
  PLAYER_ID_MAX_LENGTH,
  PLAYER_NAME_MAX_LENGTH,
  REQUEST_ID_MAX_LENGTH,
} from './constants';
import type {
  AnswerFinalizationTrigger,
  CountriesCitiesAnswerFinalization,
  CountriesCitiesAnswerResult,
  CountriesCitiesRound,
  CountriesCitiesSettings,
  CountriesCitiesSubmission,
  GameCategory,
  GamePhase,
  GameSnapshot,
  PlayerProfile,
  ReplicatedPlayerState,
} from './messages';
import { parseWheelState } from './wheel';

export type UnknownRecord = Record<string, unknown>;


export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isJsonValue(value: unknown): boolean {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

export function isBoundedString(value: unknown, max: number, allowEmpty = false): value is string {
  return typeof value === 'string' && value.length <= max && (allowEmpty || value.trim().length > 0);
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value);
}

export function hasValidMetadata(value: UnknownRecord): boolean {
  return (value.requestId === undefined || isBoundedString(value.requestId, REQUEST_ID_MAX_LENGTH, true))
    && (value.senderId === undefined || isBoundedString(value.senderId, PLAYER_ID_MAX_LENGTH, true))
    && (value.sentAt === undefined || isFiniteNumber(value.sentAt));
}

export function parsePlayerProfile(value: unknown): PlayerProfile | null {
  if (!isRecord(value)) return null;
  if (!isBoundedString(value.id, PLAYER_ID_MAX_LENGTH)) return null;
  if (!isBoundedString(value.name, PLAYER_NAME_MAX_LENGTH)) return null;
  if (!isBoundedString(value.color, PLAYER_COLOR_MAX_LENGTH)) return null;
  if (!isBoundedString(value.emoji, PLAYER_EMOJI_MAX_LENGTH)) return null;
  return { id: value.id.trim(), name: value.name.trim(), color: value.color.trim(), emoji: value.emoji.trim() };
}

export function parseCategory(value: unknown, fallbackOrder = 0): GameCategory | null {
  if (typeof value === 'string') {
    const name = value.trim();
    if (!name || name.length > CATEGORY_NAME_MAX_LENGTH) return null;
    const id = slug(name);
    if (id.length > CATEGORY_ID_MAX_LENGTH) return null;
    return { id, name, order: fallbackOrder };
  }
  if (!isRecord(value)) return null;
  const nameValue = typeof value.name === 'string' ? value.name : value.label;
  if (typeof nameValue !== 'string' || !nameValue.trim()) return null;
  const name = nameValue.trim();
  if (name.length > CATEGORY_NAME_MAX_LENGTH) return null;
  const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : slug(name);
  if (id.length > CATEGORY_ID_MAX_LENGTH) return null;
  const order = isInteger(value.order) ? value.order : fallbackOrder;
  return { id, name, order };
}

function slug(value: string): string {
  return value.toLocaleLowerCase('pl').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'category';
}

export function parseCategories(value: unknown): GameCategory[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_COUNTRIES_CITIES_CATEGORIES) return null;
  const categories = value.map((item, index) => parseCategory(item, index));
  if (categories.some((item) => item === null)) return null;
  return (categories as GameCategory[]).sort((left, right) => left.order - right.order);
}

export function parseSettings(value: unknown): CountriesCitiesSettings | null {
  if (!isRecord(value)) return null;
  if (!isFiniteNumber(value.answerDurationSeconds) || !isFiniteNumber(value.roundCount) || !isFiniteNumber(value.maxPlayers) || typeof value.speedBonusEnabled !== 'boolean') return null;
  return {
    answerDurationSeconds: value.answerDurationSeconds,
    roundCount: Math.trunc(value.roundCount),
    maxPlayers: Math.trunc(value.maxPlayers),
    speedBonusEnabled: value.speedBonusEnabled,
  };
}

export function parseStringMap(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'string') return null;
    result[key] = item;
  }
  return result;
}

export function parseNumberMap(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) return null;
  const result: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!isFiniteNumber(item)) return null;
    result[key] = item;
  }
  return result;
}

export function parseSubmissionAnswers(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > MAX_COUNTRIES_CITIES_CATEGORIES) return null;
  const answers: Record<string, string> = {};
  for (const [key, item] of entries) {
    if (!isBoundedString(key, CATEGORY_ID_MAX_LENGTH) || typeof item !== 'string' || item.length > ANSWER_MAX_LENGTH) return null;
    answers[key] = item;
  }
  return answers;
}

export function parseSubmission(value: unknown): CountriesCitiesSubmission | null {
  if (!isRecord(value) || !isBoundedString(value.playerId, PLAYER_ID_MAX_LENGTH) || !isBoundedString(value.playerName, PLAYER_NAME_MAX_LENGTH)) return null;
  const answers = parseSubmissionAnswers(value.answers);
  if (!answers) return null;
  return { playerId: value.playerId, playerName: value.playerName, answers };
}

export function parseAnswerResult(value: unknown): CountriesCitiesAnswerResult | null {
  if (!isRecord(value) || typeof value.winner !== 'string' || !isFiniteNumber(value.points)) return null;
  return { winner: value.winner, points: value.points };
}

export function parseAnswerResults(value: unknown): Record<string, CountriesCitiesAnswerResult> | null {
  if (!isRecord(value)) return null;
  const result: Record<string, CountriesCitiesAnswerResult> = {};
  for (const [key, item] of Object.entries(value)) {
    const parsed = parseAnswerResult(item);
    if (!parsed) return null;
    result[key] = parsed;
  }
  return result;
}

const phases = new Set<GamePhase>(['lobby', 'letterDraw', 'letterReveal', 'answering', 'categoryReview', 'categoryResults', 'roundSummary', 'gameFinished']);
const phaseAliases: Record<string, GamePhase> = { setup: 'lobby', input: 'answering', review: 'categoryReview', reveal: 'categoryResults', results: 'roundSummary' };
function parsePhase(value: unknown): GamePhase | null {
  if (typeof value !== 'string') return null;
  if (phases.has(value as GamePhase)) return value as GamePhase;
  return phaseAliases[value] ?? null;
}

function parseRound(value: unknown): CountriesCitiesRound | null {
  if (value === null) return null;
  if (!isRecord(value) || !isInteger(value.number) || typeof value.letter !== 'string' || !Array.isArray(value.usedLetters) || !value.usedLetters.every((item) => typeof item === 'string') || !isInteger(value.categoryIndex)) return null;
  const categories = parseCategories(value.categories);
  if (!categories) return null;
  const deadlineAt = value.deadlineAt === null || value.deadlineAt === undefined ? null : isFiniteNumber(value.deadlineAt) ? value.deadlineAt : undefined;
  const answeringStartedAt = value.answeringStartedAt === null || value.answeringStartedAt === undefined ? null : isFiniteNumber(value.answeringStartedAt) ? value.answeringStartedAt : undefined;
  if (deadlineAt === undefined || answeringStartedAt === undefined) return null;
  if (value.lastCallPlayerId !== null && value.lastCallPlayerId !== undefined && typeof value.lastCallPlayerId !== 'string') return null;
  return { number: value.number, letter: value.letter, usedLetters: [...value.usedLetters] as string[], categories, deadlineAt, answeringStartedAt, lastCallPlayerId: typeof value.lastCallPlayerId === 'string' ? value.lastCallPlayerId : null, categoryIndex: value.categoryIndex };
}

function parseReplicatedPlayer(value: unknown): ReplicatedPlayerState | null {
  if (!isRecord(value) || !isFiniteNumber(value.joinedAt) || (value.connected !== undefined && typeof value.connected !== 'boolean')) return null;
  const profile = parsePlayerProfile(value.profile);
  return profile ? { profile, joinedAt: value.joinedAt, connected: value.connected ?? true } : null;
}

function parseSubmissionMap(value: unknown): Record<string, CountriesCitiesSubmission> | null {
  if (!isRecord(value)) return null;
  const result: Record<string, CountriesCitiesSubmission> = {};
  for (const [key, item] of Object.entries(value)) {
    const parsed = parseSubmission(item);
    if (!parsed) return null;
    result[key] = parsed;
  }
  return result;
}

function parseNestedStringMap(value: unknown): Record<string, Record<string, string>> | null {
  if (!isRecord(value)) return null;
  const result: Record<string, Record<string, string>> = {};
  for (const [key, item] of Object.entries(value)) {
    const parsed = parseStringMap(item);
    if (!parsed) return null;
    result[key] = parsed;
  }
  return result;
}

function parseStringList(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) return null;
  return [...value] as string[];
}

function parseReviewReady(value: unknown): Record<string, string[]> | null {
  if (!isRecord(value)) return null;
  const result: Record<string, string[]> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!Array.isArray(item) || !item.every((entry) => typeof entry === 'string')) return null;
    result[key] = [...item] as string[];
  }
  return result;
}

const answerFinalizationTriggers = new Set<AnswerFinalizationTrigger>(['deadline', 'manual', 'all-submitted']);

function parseAnswerFinalization(
  value: unknown,
  players: ReplicatedPlayerState[],
): CountriesCitiesAnswerFinalization | null {
  if (!isRecord(value)
    || !isBoundedString(value.id, REQUEST_ID_MAX_LENGTH)
    || !isInteger(value.roundNumber)
    || value.roundNumber < 1
    || !isFiniteNumber(value.requestedAt)
    || !isFiniteNumber(value.expiresAt)
    || value.expiresAt < value.requestedAt
    || typeof value.trigger !== 'string'
    || !answerFinalizationTriggers.has(value.trigger as AnswerFinalizationTrigger)
    || !Array.isArray(value.expectedPlayerIds)
    || value.expectedPlayerIds.length > MAX_COUNTRIES_CITIES_PLAYERS
    || !value.expectedPlayerIds.every((playerId) => isBoundedString(playerId, PLAYER_ID_MAX_LENGTH))) return null;

  const expectedPlayerIds = [...value.expectedPlayerIds] as string[];
  if (new Set(expectedPlayerIds).size !== expectedPlayerIds.length) return null;
  const knownPlayerIds = new Set(players.map((player) => player.profile.id));
  if (!expectedPlayerIds.every((playerId) => knownPlayerIds.has(playerId))) return null;

  return {
    id: value.id,
    roundNumber: value.roundNumber,
    requestedAt: value.requestedAt,
    expiresAt: value.expiresAt,
    trigger: value.trigger as AnswerFinalizationTrigger,
    expectedPlayerIds,
  };
}

export function parseSnapshot(value: unknown): GameSnapshot | null {
  if (!isRecord(value) || typeof value.gameId !== 'string' || typeof value.roomId !== 'string' || !isInteger(value.sequenceNumber) || typeof value.hostPlayerId !== 'string' || typeof value.endMode !== 'string' || typeof value.timeMode !== 'string' || typeof value.hostControlsReview !== 'boolean') return null;
  const phase = parsePhase(value.phase);
  const players = Array.isArray(value.players) ? value.players.map(parseReplicatedPlayer) : [];
  const categories = parseCategories(value.categories);
  const settings = parseSettings(value.settings);
  const round = value.round === null ? null : parseRound(value.round);
  const wheelState = value.wheelState === undefined ? undefined : parseWheelState(value.wheelState);
  const parsedPlayers = players.filter((player): player is ReplicatedPlayerState => player !== null);
  const answerFinalization = value.answerFinalization === undefined ? undefined : parseAnswerFinalization(value.answerFinalization, parsedPlayers);
  const submissions = parseSubmissionMap(value.submissions ?? {});
  const submittedAtByPlayerId = parseNumberMap(value.submittedAtByPlayerId ?? {});
  const votes = parseNestedStringMap(value.votes ?? {});
  const hostVoteSuggestions = parseStringMap(value.hostVoteSuggestions ?? {});
  const reviewReady = parseReviewReady(value.reviewReady ?? {});
  const finalResults = parseAnswerResults(value.finalResults ?? {});
  const roundScores = parseNumberMap(value.roundScores ?? {});
  const finalScores = parseNumberMap(value.finalScores ?? {});
  const usedLetters = parseStringList(value.usedLetters);
  const letterHistory = parseStringList(value.letterHistory);
  const donePlayerIds = parseStringList(value.donePlayerIds);
  const speedBonusPlayerIds = parseStringList(value.speedBonusPlayerIds);
  if (!phase || players.some((item) => item === null) || !categories || !settings || (value.round !== null && !round) || (value.wheelState !== undefined && !wheelState) || (value.answerFinalization !== undefined && !answerFinalization) || !submissions || !submittedAtByPlayerId || !votes || !hostVoteSuggestions || !reviewReady || !finalResults || !roundScores || !finalScores || !usedLetters || !letterHistory || !donePlayerIds || !speedBonusPlayerIds) return null;
  if (answerFinalization && (phase !== 'answering' || !round || answerFinalization.roundNumber !== round.number)) return null;
  return {
    gameId: value.gameId, roomId: value.roomId, sequenceNumber: value.sequenceNumber, hostPlayerId: value.hostPlayerId, phase,
    players: parsedPlayers, categories, usedLetters, letterHistory, round,
    ...(wheelState ? { wheelState } : {}),
    ...(answerFinalization ? { answerFinalization } : {}),
    endMode: value.endMode, timeMode: value.timeMode, settings, hostControlsReview: value.hostControlsReview, submissions, submittedAtByPlayerId,
    donePlayerIds, votes, hostVoteSuggestions, reviewReady, finalResults, roundScores, finalScores,
    speedBonusPlayerIds,
  };
}
