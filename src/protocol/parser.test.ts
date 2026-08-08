import { describe, expect, it } from 'vitest';
import { parseHostMessage } from './parser';

const snapshot = {
  gameId: 'g1', roomId: 'ABC234', sequenceNumber: 7, hostPlayerId: 'host', phase: 'answering',
  players: [{ profile: { id: 'host', name: 'Host', color: '#000', emoji: '🎲' }, joinedAt: 1, connected: true }],
  categories: [{ id: 'city', name: 'Miasto', order: 0 }], usedLetters: ['A'], letterHistory: ['A'],
  round: { number: 1, letter: 'A', usedLetters: ['A'], categories: [{ id: 'city', name: 'Miasto', order: 0 }], deadlineAt: 1000, answeringStartedAt: 1, lastCallPlayerId: null, categoryIndex: 0 },
  endMode: 'timer', timeMode: 'per-answer-10s', settings: { answerDurationSeconds: 90, roundCount: 5, maxPlayers: 8, speedBonusEnabled: false },
  hostControlsReview: true, submissions: {}, submittedAtByPlayerId: {}, donePlayerIds: [], votes: {}, hostVoteSuggestions: {}, reviewReady: {}, finalResults: {}, roundScores: {}, finalScores: {}, speedBonusPlayerIds: [],
};

const wheelState = {
  schemaVersion: 1,
  phase: 'spinning',
  hostSessionId: 'session-1',
  roundNumber: 1,
  spinId: 'spin-1',
  selectedPlayerId: 'host',
  waitingStartedAt: 100,
  waitingDeadlineAt: 10_100,
  spinStartedAt: 1_000,
  spinDurationMs: 6_000,
  spinSeed: 123,
  finalTurns: 6,
};

describe('parseHostMessage', () => {
  it('parses a valid snapshot', () => {
    const result = parseHostMessage({ type: 'game:snapshot', snapshot });
    expect(result.ok && result.message.type).toBe('game:snapshot');
  });

  it('parses an optional synchronized wheel state', () => {
    const result = parseHostMessage({ type: 'game:snapshot', snapshot: { ...snapshot, phase: 'letterDraw', wheelState } });
    expect(result.ok).toBe(true);
    if (!result.ok || result.message.type !== 'game:snapshot') return;
    expect(result.message.snapshot.wheelState).toEqual(wheelState);
  });

  it('rejects a malformed wheel state instead of silently dropping it', () => {
    const result = parseHostMessage({
      type: 'game:snapshot',
      snapshot: { ...snapshot, phase: 'letterDraw', wheelState: { ...wheelState, letter: 'A' } },
    });
    expect(result.ok).toBe(false);
  });

  it('keeps snapshots from older hosts valid when wheelState is absent', () => {
    expect(parseHostMessage({ type: 'game:snapshot', snapshot }).ok).toBe(true);
  });

  it('rejects malformed reserved messages', () => expect(parseHostMessage({ type: 'game:snapshot', snapshot: { phase: 'hacked' } }).ok).toBe(false));
  it('rejects unknown types', () => expect(parseHostMessage({ type: 'custom:event' }).ok).toBe(false));
});
