import { describe, expect, it, vi } from 'vitest';
import { createSessionTabLease } from './sessionTabLease';
import type { AnswerDraftScope } from './answerDraftStorage';
import {
  persistentAnswerDraftMaxCharacters,
  persistentAnswerDraftMaxEntries,
  persistentAnswerDraftStorageKey,
  persistentAnswerDraftTtlMs,
  readPersistentAnswerDraft,
  removePersistentAnswerDraftsForSession,
  savePersistentAnswerDraft,
} from './persistentAnswerDraftStorage';

class MemoryStorage {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}

const scope: AnswerDraftScope = {
  hostSessionId: 'host-session', roomId: 'ABC234', gameId: 'game-1', roundNumber: 1, playerId: 'player-1',
};

describe('persistent answer drafts', () => {
  it('uses the shared draft codec, including frozen response identity', () => {
    const storage = new MemoryStorage();
    const options = { storage, isOwner: () => true, now: () => 1000 };
    const draft = { scope, answers: { city: 'Augustów' }, frozenFinalization: {
      gameId: scope.gameId, roundNumber: 1, finalizationId: 'final-1', requestId: 'request-1', answers: { city: 'Augustów' },
    } };
    expect(savePersistentAnswerDraft(draft, options)).toBe(true);
    expect(readPersistentAnswerDraft(scope, options)).toEqual(draft);
    expect(savePersistentAnswerDraft({ scope, answers: { city: 'x'.repeat(61) } }, options)).toBe(false);
  });

  it('isolates host session, room and player and prunes a confirmed new round/game', () => {
    const storage = new MemoryStorage();
    const options = { storage, isOwner: () => true };
    savePersistentAnswerDraft({ scope, answers: { city: 'Augustów' } }, options);
    for (const change of [{ hostSessionId: 'other' }, { roomId: 'OTHER' }, { playerId: 'other' }]) {
      expect(readPersistentAnswerDraft({ ...scope, ...change }, options)).toBeNull();
      expect(readPersistentAnswerDraft(scope, options)?.answers.city).toBe('Augustów');
    }
    expect(readPersistentAnswerDraft({ ...scope, roundNumber: 2 }, options)).toBeNull();
    expect(readPersistentAnswerDraft(scope, options)).toBeNull();
    savePersistentAnswerDraft({ scope, answers: { city: 'Augustów' } }, options);
    expect(readPersistentAnswerDraft({ ...scope, gameId: 'game-2' }, options)).toBeNull();
    expect(readPersistentAnswerDraft(scope, options)).toBeNull();
  });

  it('expires at the exact TTL boundary and rejects future timestamps', () => {
    const storage = new MemoryStorage();
    let now = 1000;
    const options = { storage, isOwner: () => true, now: () => now };
    savePersistentAnswerDraft({ scope, answers: { city: 'Augustów' } }, options);
    now += persistentAnswerDraftTtlMs - 1;
    expect(readPersistentAnswerDraft(scope, options)).not.toBeNull();
    now++;
    expect(readPersistentAnswerDraft(scope, options)).toBeNull();
    expect(storage.getItem(persistentAnswerDraftStorageKey)).toBeNull();
    savePersistentAnswerDraft({ scope, answers: {} }, options);
    now = 0;
    expect(readPersistentAnswerDraft(scope, options)).toBeNull();
  });

  it('bounds records even when all updates have the same timestamp', () => {
    const storage = new MemoryStorage();
    const options = { storage, isOwner: () => true, now: () => 1000 };
    for (let index = 0; index < 20; index++) {
      savePersistentAnswerDraft({ scope: { ...scope, hostSessionId: `host-${String(index)}` }, answers: {} }, options);
    }
    const raw = storage.getItem(persistentAnswerDraftStorageKey) ?? '';
    expect(raw.length).toBeLessThanOrEqual(persistentAnswerDraftMaxCharacters);
    expect((JSON.parse(raw) as { entries: unknown[] }).entries).toHaveLength(persistentAnswerDraftMaxEntries);
    expect(readPersistentAnswerDraft({ ...scope, hostSessionId: 'host-19' }, options)).not.toBeNull();
    expect(readPersistentAnswerDraft({ ...scope, hostSessionId: 'host-0' }, options)).toBeNull();
  });

  it('cleans only the explicitly left session and handles corrupted/unavailable storage', () => {
    const storage = new MemoryStorage();
    const options = { storage, isOwner: () => true };
    savePersistentAnswerDraft({ scope, answers: {} }, options);
    savePersistentAnswerDraft({ scope: { ...scope, hostSessionId: 'other' }, answers: {} }, options);
    removePersistentAnswerDraftsForSession(scope, options);
    expect(readPersistentAnswerDraft(scope, options)).toBeNull();
    expect(readPersistentAnswerDraft({ ...scope, hostSessionId: 'other' }, options)).not.toBeNull();
    storage.setItem(persistentAnswerDraftStorageKey, 'x'.repeat(persistentAnswerDraftMaxCharacters + 1));
    expect(readPersistentAnswerDraft(scope, options)).toBeNull();
    expect(storage.getItem(persistentAnswerDraftStorageKey)).toBeNull();
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); }, removeItem: () => { throw new Error('denied'); } };
    expect(savePersistentAnswerDraft({ scope, answers: {} }, { ...options, storage: broken })).toBe(false);
    expect(readPersistentAnswerDraft(scope, { ...options, storage: broken })).toBeNull();
    expect(savePersistentAnswerDraft({ scope, answers: {} }, { ...options, storage: null })).toBe(false);
  });

  it('rejects writes and deletes from an expired old owner after another tab takes over', () => {
    const storage = new MemoryStorage();
    let now = 1000;
    const oldLease = createSessionTabLease(scope, { storage, ownerId: 'old', now: () => now });
    const newLease = createSessionTabLease(scope, { storage, ownerId: 'new', now: () => now });
    expect(oldLease.acquire()).toBe(true);
    savePersistentAnswerDraft({ scope, answers: { city: 'Old' } }, { storage, isOwner: oldLease.isOwner, now: () => now });
    now += 9000;
    expect(newLease.acquire()).toBe(true);
    const options = { storage, isOwner: newLease.isOwner, now: () => now };
    savePersistentAnswerDraft({ scope, answers: { city: 'New' } }, options);
    expect(savePersistentAnswerDraft({ scope, answers: { city: 'Stale' } }, { storage, isOwner: oldLease.isOwner })).toBe(false);
    removePersistentAnswerDraftsForSession(scope, { storage, isOwner: oldLease.isOwner });
    expect(readPersistentAnswerDraft(scope, options)?.answers.city).toBe('New');
    const losesOwnership = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);
    expect(savePersistentAnswerDraft({ scope, answers: {} }, { storage, isOwner: losesOwnership })).toBe(false);
    expect(readPersistentAnswerDraft(scope, options)?.answers.city).toBe('New');
  });
});
