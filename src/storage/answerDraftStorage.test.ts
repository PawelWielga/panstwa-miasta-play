import { describe, expect, it } from 'vitest';
import {
  answerDraftStorageKey,
  readAnswerDraft,
  removeAnswerDraft,
  saveAnswerDraft,
  type AnswerDraftScope,
} from './answerDraftStorage';

class MemoryStorage {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}

const scope: AnswerDraftScope = {
  hostSessionId: 'HOST-SESSION',
  roomId: 'ABC234',
  gameId: 'game-1',
  roundNumber: 3,
  playerId: 'player-1',
};

describe('answer draft session storage', () => {
  it('restores only an exactly matching game/round/player scope', () => {
    const storage = new MemoryStorage();
    expect(saveAnswerDraft({ scope, answers: { city: 'Augustów' } }, storage)).toBe(true);
    expect(readAnswerDraft(scope, storage)?.answers).toEqual({ city: 'Augustów' });
    expect(readAnswerDraft({ ...scope, roundNumber: 4 }, storage)).toBeNull();
    expect(readAnswerDraft({ ...scope, roomId: 'XYZ234' }, storage)).toBeNull();
    expect(readAnswerDraft({ ...scope, playerId: 'player-2' }, storage)).toBeNull();
  });

  it('persists a frozen finalization response without changing its requestId or answers', () => {
    const storage = new MemoryStorage();
    const frozenFinalization = {
      gameId: scope.gameId,
      roundNumber: scope.roundNumber,
      finalizationId: 'final-3',
      requestId: 'request-fixed',
      answers: { city: 'Białystok' },
    };
    expect(saveAnswerDraft({ scope, answers: { city: 'Białystok' }, frozenFinalization }, storage)).toBe(true);
    expect(readAnswerDraft(scope, storage)).toEqual({ scope, answers: { city: 'Białystok' }, frozenFinalization });
  });

  it('rejects malformed or oversized draft data', () => {
    const storage = new MemoryStorage();
    expect(saveAnswerDraft({ ...({ scope: { ...scope, roundNumber: 0 }, answers: {} }) }, storage)).toBe(false);
    expect(saveAnswerDraft({ scope, answers: { ['k'.repeat(65)]: 'A' } }, storage)).toBe(false);
    expect(saveAnswerDraft({ scope, answers: { city: 'A'.repeat(61) } }, storage)).toBe(false);
    expect(saveAnswerDraft({
      scope,
      answers: { city: 'A' },
      frozenFinalization: {
        gameId: scope.gameId,
        roundNumber: scope.roundNumber,
        finalizationId: 'f'.repeat(129),
        requestId: 'request',
        answers: { city: 'A' },
      },
    }, storage)).toBe(false);
  });

  it('removes a completed round and handles unavailable storage', () => {
    const storage = new MemoryStorage();
    expect(saveAnswerDraft({ scope, answers: { city: 'Augustów' } }, storage)).toBe(true);
    removeAnswerDraft(scope, storage);
    expect(readAnswerDraft(scope, storage)).toBeNull();
    expect(storage.getItem(answerDraftStorageKey)).toBeNull();
    expect(saveAnswerDraft({ scope, answers: {} }, null)).toBe(false);
    expect(readAnswerDraft(scope, null)).toBeNull();
  });
});
