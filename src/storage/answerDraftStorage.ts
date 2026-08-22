import { PLAYER_ID_MAX_LENGTH, REQUEST_ID_MAX_LENGTH } from '../protocol/constants';
import { isBoundedString, isInteger, isRecord, parseSubmissionAnswers } from '../protocol/validation';

const KEY = 'panstwa-miasta.answer-drafts.v1';
const SCHEMA_VERSION = 1;
const SCOPE_ID_MAX_LENGTH = 128;

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface AnswerDraftScope {
  hostSessionId: string;
  roomId: string;
  gameId: string;
  roundNumber: number;
  playerId: string;
}

export interface FrozenFinalizationResponse {
  gameId: string;
  roundNumber: number;
  finalizationId: string;
  requestId: string;
  answers: Record<string, string>;
}

export interface StoredAnswerDraft {
  scope: AnswerDraftScope;
  answers: Record<string, string>;
  frozenFinalization?: FrozenFinalizationResponse;
}

export function saveAnswerDraft(
  draft: StoredAnswerDraft,
  storage: DraftStorage | null = getSessionStorage(),
): boolean {
  if (!storage) return false;
  const normalized = normalizeDraft(draft);
  if (!normalized) return false;
  const entries = readEntries(storage);
  entries.set(scopeKey(normalized.scope), normalized);
  return writeEntries(storage, entries);
}

export function readAnswerDraft(
  scope: AnswerDraftScope,
  storage: DraftStorage | null = getSessionStorage(),
): StoredAnswerDraft | null {
  if (!storage) return null;
  const normalizedScope = normalizeScope(scope);
  if (!normalizedScope) return null;
  return readEntries(storage).get(scopeKey(normalizedScope)) ?? null;
}

export function removeAnswerDraft(
  scope: AnswerDraftScope,
  storage: DraftStorage | null = getSessionStorage(),
): void {
  if (!storage) return;
  const normalizedScope = normalizeScope(scope);
  if (!normalizedScope) return;
  const entries = readEntries(storage);
  if (!entries.delete(scopeKey(normalizedScope))) return;
  writeEntries(storage, entries);
}

function normalizeDraft(value: StoredAnswerDraft): StoredAnswerDraft | null {
  const scope = normalizeScope(value.scope);
  const answers = parseSubmissionAnswers(value.answers);
  if (!scope || !answers) return null;
  const frozenFinalization = value.frozenFinalization === undefined
    ? undefined
    : normalizeFrozenFinalization(value.frozenFinalization, scope);
  if (value.frozenFinalization !== undefined && !frozenFinalization) return null;
  return { scope, answers, ...(frozenFinalization ? { frozenFinalization } : {}) };
}

function normalizeScope(value: AnswerDraftScope): AnswerDraftScope | null {
  if (!isBoundedString(value.hostSessionId, SCOPE_ID_MAX_LENGTH)
    || !isBoundedString(value.roomId, SCOPE_ID_MAX_LENGTH)
    || !isBoundedString(value.gameId, SCOPE_ID_MAX_LENGTH)
    || !isInteger(value.roundNumber)
    || value.roundNumber < 1
    || !isBoundedString(value.playerId, PLAYER_ID_MAX_LENGTH)) return null;
  return {
    hostSessionId: value.hostSessionId.trim(),
    roomId: value.roomId.trim(),
    gameId: value.gameId.trim(),
    roundNumber: value.roundNumber,
    playerId: value.playerId.trim(),
  };
}

function normalizeFrozenFinalization(
  value: FrozenFinalizationResponse,
  scope: AnswerDraftScope,
): FrozenFinalizationResponse | null {
  if (value.gameId !== scope.gameId
    || value.roundNumber !== scope.roundNumber
    || !isBoundedString(value.finalizationId, REQUEST_ID_MAX_LENGTH)
    || !isBoundedString(value.requestId, REQUEST_ID_MAX_LENGTH)) return null;
  const answers = parseSubmissionAnswers(value.answers);
  if (!answers) return null;
  return {
    gameId: scope.gameId,
    roundNumber: scope.roundNumber,
    finalizationId: value.finalizationId.trim(),
    requestId: value.requestId.trim(),
    answers,
  };
}

function readEntries(storage: DraftStorage): Map<string, StoredAnswerDraft> {
  let raw: string | null;
  try {
    raw = storage.getItem(KEY);
  } catch {
    return new Map();
  }
  if (!raw?.trim()) return new Map();
  try {
    const decoded: unknown = JSON.parse(raw);
    if (!isRecord(decoded) || decoded.version !== SCHEMA_VERSION || !isRecord(decoded.entries)) {
      removeDamagedStorage(storage);
      return new Map();
    }
    const result = new Map<string, StoredAnswerDraft>();
    for (const [storedKey, value] of Object.entries(decoded.entries)) {
      const draft = decodeDraft(value);
      if (draft && scopeKey(draft.scope) === storedKey) result.set(storedKey, draft);
    }
    return result;
  } catch {
    removeDamagedStorage(storage);
    return new Map();
  }
}

function decodeDraft(value: unknown): StoredAnswerDraft | null {
  if (!isRecord(value) || !isRecord(value.scope)) return null;
  if (typeof value.scope.hostSessionId !== 'string'
    || typeof value.scope.roomId !== 'string'
    || typeof value.scope.gameId !== 'string'
    || typeof value.scope.roundNumber !== 'number'
    || typeof value.scope.playerId !== 'string') return null;
  const scope = normalizeScope({
    hostSessionId: value.scope.hostSessionId,
    roomId: value.scope.roomId,
    gameId: value.scope.gameId,
    roundNumber: value.scope.roundNumber,
    playerId: value.scope.playerId,
  });
  const answers = parseSubmissionAnswers(value.answers);
  if (!scope || !answers) return null;
  if (value.frozenFinalization === undefined) return { scope, answers };
  if (!isRecord(value.frozenFinalization)) return null;
  if (typeof value.frozenFinalization.gameId !== 'string'
    || typeof value.frozenFinalization.roundNumber !== 'number'
    || typeof value.frozenFinalization.finalizationId !== 'string'
    || typeof value.frozenFinalization.requestId !== 'string'
    || !isRecord(value.frozenFinalization.answers)) return null;
  const frozenFinalization = normalizeFrozenFinalization({
    gameId: value.frozenFinalization.gameId,
    roundNumber: value.frozenFinalization.roundNumber,
    finalizationId: value.frozenFinalization.finalizationId,
    requestId: value.frozenFinalization.requestId,
    answers: value.frozenFinalization.answers as Record<string, string>,
  }, scope);
  return frozenFinalization ? { scope, answers, frozenFinalization } : null;
}

function writeEntries(storage: DraftStorage, entries: Map<string, StoredAnswerDraft>): boolean {
  try {
    if (entries.size === 0) {
      storage.removeItem(KEY);
      return true;
    }
    storage.setItem(KEY, JSON.stringify({ version: SCHEMA_VERSION, entries: Object.fromEntries(entries) }));
    return true;
  } catch {
    return false;
  }
}

function scopeKey(scope: AnswerDraftScope): string {
  return JSON.stringify([scope.hostSessionId, scope.roomId, scope.gameId, scope.roundNumber, scope.playerId]);
}

function removeDamagedStorage(storage: DraftStorage): void {
  try { storage.removeItem(KEY); } catch { /* storage may be unavailable */ }
}

function getSessionStorage(): Storage | null {
  try { return globalThis.sessionStorage; } catch { return null; }
}

export const answerDraftStorageKey = KEY;
