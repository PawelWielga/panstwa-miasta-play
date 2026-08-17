import { describe, expect, it } from 'vitest';
import { MAX_MESSAGE_BYTES } from './constants';
import { parseHostMessage } from './parser';
import { parseCategories } from './validation';

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

function createCategories(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `category-${String(index + 1)}`,
    name: `Kategoria ${String(index + 1)}`,
    order: index,
  }));
}

function snapshotWithCategories(count: number) {
  const categories = createCategories(count);
  return {
    ...snapshot,
    categories,
    round: { ...snapshot.round, categories },
  };
}

function maxSupportedSnapshot() {
  const categories = createCategories(30);
  const players = Array.from({ length: 12 }, (_, index) => {
    const id = `p${index.toString(16).padStart(32, '0')}`;
    return {
      profile: {
        id,
        name: `Gracz ${String(index + 1)}`.padEnd(24, 'x'),
        color: '#2563eb',
        emoji: '🦊',
      },
      joinedAt: index + 1,
      connected: true,
    };
  });
  const hostId = players[0]!.profile.id;
  const currentCategory = categories[0]!;
  const submissions = Object.fromEntries(players.map(({ profile }) => [
    profile.id,
    {
      playerId: profile.id,
      playerName: profile.name,
      answers: Object.fromEntries(categories.map((category) => [category.id, 'A'.repeat(60)])),
    },
  ]));
  const answerIds = players.map(({ profile }) => `${profile.id}::${currentCategory.id}`);

  return {
    ...snapshot,
    hostPlayerId: hostId,
    phase: 'categoryResults',
    players,
    categories,
    round: {
      ...snapshot.round,
      categories,
      deadlineAt: 123_456_789,
      answeringStartedAt: 123_450_000,
      lastCallPlayerId: players.at(-1)!.profile.id,
    },
    settings: { answerDurationSeconds: 180, roundCount: 22, maxPlayers: 12, speedBonusEnabled: true },
    submissions,
    submittedAtByPlayerId: Object.fromEntries(players.map(({ profile }) => [profile.id, 123_456_000])),
    donePlayerIds: players.map(({ profile }) => profile.id),
    votes: Object.fromEntries(answerIds.map((answerId) => [answerId, { [hostId]: 'ok' }])),
    hostVoteSuggestions: Object.fromEntries(answerIds.map((answerId) => [answerId, 'ok'])),
    reviewReady: { 0: players.map(({ profile }) => profile.id) },
    finalResults: Object.fromEntries(answerIds.map((answerId) => [answerId, { winner: 'ok', points: 10 }])),
    roundScores: Object.fromEntries(players.map(({ profile }) => [profile.id, 10])),
    finalScores: Object.fromEntries(players.map(({ profile }) => [profile.id, 100])),
    speedBonusPlayerIds: players.slice(0, 3).map(({ profile }) => profile.id),
    reconnectCredentialFingerprintsByPlayerId: Object.fromEntries(
      players.map(({ profile }) => [profile.id, 'a'.repeat(64)]),
    ),
  };
}

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

  it.each([13, 30])('accepts a snapshot with %i categories', (count) => {
    expect(parseHostMessage({ type: 'game:snapshot', snapshot: snapshotWithCategories(count) }).ok).toBe(true);
  });

  it('keeps the maximum 30-category snapshot below the transport limit', () => {
    const message = { type: 'game:snapshot', snapshot: maxSupportedSnapshot() };
    const bytes = new TextEncoder().encode(JSON.stringify(message));

    expect(bytes.byteLength).toBeLessThan(MAX_MESSAGE_BYTES);
    expect(parseHostMessage(message).ok).toBe(true);
  });

  it('rejects a snapshot with 31 categories', () => {
    expect(parseHostMessage({ type: 'game:snapshot', snapshot: snapshotWithCategories(31) }).ok).toBe(false);
  });

  it('rejects malformed reserved messages', () => expect(parseHostMessage({ type: 'game:snapshot', snapshot: { phase: 'hacked' } }).ok).toBe(false));
  it('rejects unknown types', () => expect(parseHostMessage({ type: 'custom:event' }).ok).toBe(false));
});

describe('parseCategories', () => {
  it.each([12, 13, 30])('accepts %i categories', (count) => {
    expect(parseCategories(createCategories(count))).toHaveLength(count);
  });

  it('rejects an empty category list', () => {
    expect(parseCategories([])).toBeNull();
  });

  it('rejects 31 categories', () => {
    expect(parseCategories(createCategories(31))).toBeNull();
  });
});
