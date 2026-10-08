import { decodeAnswerDraft, type AnswerDraftScope, type DraftStorage, type StoredAnswerDraft } from './answerDraftStorage';
import { isRecord } from '../protocol/validation';

export const persistentAnswerDraftStorageKey = 'panstwa-miasta.persistent-answer-drafts.v1';
export const persistentAnswerDraftTtlMs = 24 * 60 * 60 * 1000;
export const persistentAnswerDraftMaxEntries = 8;
export const persistentAnswerDraftMaxCharacters = 128_000;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export interface PersistentDraftOptions {
  // Recheck the live session lease immediately before every shared mutation.
  isOwner: () => boolean;
  storage?: DraftStorage | null;
  now?: () => number;
}

interface Entry {
  draft: StoredAnswerDraft;
  updatedAt: number;
}

type SessionScope = Pick<AnswerDraftScope, 'hostSessionId' | 'roomId' | 'playerId'>;

export function savePersistentAnswerDraft(draft: StoredAnswerDraft, options: PersistentDraftOptions): boolean {
  const normalized = decodeAnswerDraft(draft);
  const storage = resolveStorage(options);
  if (!normalized || !storage || !options.isOwner()) return false;
  const now = (options.now ?? Date.now)();
  const entries = readEntries(storage, now);
  // Only one current round per player/session survives a host-confirmed transition.
  const retained = entries.filter((entry) => !sameSession(entry.draft.scope, normalized.scope));
  retained.unshift({ draft: normalized, updatedAt: now });
  return writeEntries(storage, retained, options);
}

/** Call only after a fresh host snapshot confirms admission and the current round. */
export function readPersistentAnswerDraft(scope: AnswerDraftScope, options: PersistentDraftOptions): StoredAnswerDraft | null {
  const storage = resolveStorage(options);
  if (!storage || !options.isOwner()) return null;
  const entries = readEntries(storage, (options.now ?? Date.now)());
  const retained = entries.filter((entry) => !sameSession(entry.draft.scope, scope) || sameRound(entry.draft.scope, scope));
  writeEntries(storage, retained, options);
  return retained.find((entry) => sameSession(entry.draft.scope, scope) && sameRound(entry.draft.scope, scope))?.draft ?? null;
}

export function removePersistentAnswerDraftsForSession(scope: SessionScope, options: PersistentDraftOptions): void {
  const storage = resolveStorage(options);
  if (!storage || !options.isOwner()) return;
  const entries = readEntries(storage, (options.now ?? Date.now)());
  writeEntries(storage, entries.filter((entry) => !sameSession(entry.draft.scope, scope)), options);
}

function sameSession(a: SessionScope, b: SessionScope): boolean {
  return a.hostSessionId === b.hostSessionId && a.roomId === b.roomId && a.playerId === b.playerId;
}

function sameRound(a: AnswerDraftScope, b: AnswerDraftScope): boolean {
  return a.gameId === b.gameId && a.roundNumber === b.roundNumber;
}

function resolveStorage(options: PersistentDraftOptions): DraftStorage | null {
  try { return options.storage === undefined ? globalThis.localStorage : options.storage; } catch { return null; }
}

function readEntries(storage: DraftStorage, now: number): Entry[] {
  try {
    const raw = storage.getItem(persistentAnswerDraftStorageKey);
    if (!raw || raw.length > persistentAnswerDraftMaxCharacters) return [];
    const decoded: unknown = JSON.parse(raw);
    if (!isRecord(decoded) || decoded.version !== 1 || !Array.isArray(decoded.entries)) return [];
    const entries: Entry[] = [];
    for (const value of decoded.entries) {
      if (!isRecord(value) || typeof value.updatedAt !== 'number' || !Number.isFinite(value.updatedAt)
        || value.updatedAt > now + FUTURE_TOLERANCE_MS || now - value.updatedAt >= persistentAnswerDraftTtlMs) continue;
      const draft = decodeAnswerDraft(value.draft);
      if (draft) entries.push({ draft, updatedAt: value.updatedAt });
    }
    return entries;
  } catch { return []; }
}

function writeEntries(storage: DraftStorage, entries: Entry[], options: PersistentDraftOptions): boolean {
  if (!options.isOwner()) return false;
  const bounded = entries.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, persistentAnswerDraftMaxEntries);
  let raw = JSON.stringify({ version: 1, entries: bounded });
  while (raw.length > persistentAnswerDraftMaxCharacters && bounded.length > 0) {
    bounded.pop();
    raw = JSON.stringify({ version: 1, entries: bounded });
  }
  try {
    if (bounded.length === 0) storage.removeItem(persistentAnswerDraftStorageKey);
    else storage.setItem(persistentAnswerDraftStorageKey, raw);
    return true;
  } catch { return false; }
}
