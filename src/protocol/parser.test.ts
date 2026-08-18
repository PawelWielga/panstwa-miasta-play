import { describe, expect, it } from 'vitest';
import { MAX_MESSAGE_BYTES, SNAPSHOT_CHUNK_RAW_BYTES } from './constants';
import type { GameSnapshot, GameSnapshotChunkHostMessage } from './messages';
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

function maxSupportedSnapshot(): GameSnapshot {
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
  const host = players.at(0);
  const lastPlayer = players.at(-1);
  if (!host || !lastPlayer) throw new Error('Invalid maximum snapshot fixture.');

  const hostId = host.profile.id;
  const submissions = Object.fromEntries(players.map(({ profile }) => [
    profile.id,
    {
      playerId: profile.id,
      playerName: profile.name,
      answers: Object.fromEntries(categories.map((category) => [category.id, 'A'.repeat(60)])),
    },
  ]));
  const answerIds = categories.flatMap((category) =>
    players.map(({ profile }) => `${profile.id}::${category.id}`));

  return {
    ...snapshot,
    gameId: 'g-max-chunked',
    sequenceNumber: 807,
    hostPlayerId: hostId,
    phase: 'categoryResults',
    players,
    categories,
    round: {
      ...snapshot.round,
      number: 22,
      categories,
      categoryIndex: 29,
      deadlineAt: 123_456_789,
      answeringStartedAt: 123_450_000,
      lastCallPlayerId: lastPlayer.profile.id,
    },
    settings: { answerDurationSeconds: 180, roundCount: 22, maxPlayers: 12, speedBonusEnabled: true },
    submissions,
    submittedAtByPlayerId: Object.fromEntries(players.map(({ profile }) => [profile.id, 123_456_000])),
    donePlayerIds: players.map(({ profile }) => profile.id),
    votes: Object.fromEntries(answerIds.map((answerId) => [answerId, { [hostId]: 'ok' }])),
    hostVoteSuggestions: Object.fromEntries(answerIds.map((answerId) => [answerId, 'ok'])),
    reviewReady: Object.fromEntries(categories.map((_, index) => [
      String(index),
      players.map(({ profile }) => profile.id),
    ])),
    finalResults: Object.fromEntries(answerIds.map((answerId) => [answerId, { winner: 'ok', points: 10 }])),
    roundScores: Object.fromEntries(players.map(({ profile }) => [profile.id, 300])),
    finalScores: Object.fromEntries(players.map(({ profile }) => [profile.id, 6_600])),
    speedBonusPlayerIds: players.slice(0, 3).map(({ profile }) => profile.id),
  };
}

function snapshotChunks(value: GameSnapshot): GameSnapshotChunkHostMessage[] {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const chunkCount = Math.ceil(bytes.byteLength / SNAPSHOT_CHUNK_RAW_BYTES);
  return Array.from({ length: chunkCount }, (_, chunkIndex) => {
    const start = chunkIndex * SNAPSHOT_CHUNK_RAW_BYTES;
    const end = Math.min(start + SNAPSHOT_CHUNK_RAW_BYTES, bytes.byteLength);
    return {
      type: 'game:snapshot-chunk',
      gameId: value.gameId,
      sequenceNumber: value.sequenceNumber,
      chunkIndex,
      chunkCount,
      payload: bytesToBase64(bytes.slice(start, end)),
    };
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return globalThis.btoa(binary);
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

  it('reassembles a realistic 30-category snapshot while every chunk stays below 64 KiB', () => {
    const largeSnapshot = maxSupportedSnapshot();
    const legacyMessage = { type: 'game:snapshot', snapshot: largeSnapshot };
    const legacyBytes = new TextEncoder().encode(JSON.stringify(legacyMessage));
    const chunks = snapshotChunks(largeSnapshot);

    expect(legacyBytes.byteLength).toBeGreaterThan(MAX_MESSAGE_BYTES);
    expect(parseHostMessage(legacyMessage).ok).toBe(false);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(new TextEncoder().encode(JSON.stringify(chunk)).byteLength).toBeLessThanOrEqual(MAX_MESSAGE_BYTES);
    }

    const duplicate = parseHostMessage(chunks.at(-1));
    expect(duplicate.ok && duplicate.message.type).toBe('game:snapshot-chunk');
    const sameDuplicate = parseHostMessage(chunks.at(-1));
    expect(sameDuplicate.ok && sameDuplicate.message.type).toBe('game:snapshot-chunk');

    let assembled: GameSnapshot | null = null;
    for (const chunk of [...chunks].reverse().slice(1)) {
      const result = parseHostMessage(chunk);
      if (result.ok && result.message.type === 'game:snapshot') assembled = result.message.snapshot;
    }

    expect(assembled).toEqual(largeSnapshot);
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

  it('accepts category names and ids at the 64-character boundary', () => {
    const name = 'N'.repeat(64);
    const id = 'i'.repeat(64);

    expect(parseCategories([{ id, name, order: 0 }])).toEqual([{ id, name, order: 0 }]);
    expect(parseCategories([name])).toHaveLength(1);
  });

  it('rejects category names and ids longer than 64 characters', () => {
    const validName = 'N'.repeat(64);

    expect(parseCategories([{ id: 'id', name: `${validName}!`, order: 0 }])).toBeNull();
    expect(parseCategories([{ id: 'i'.repeat(65), name: validName, order: 0 }])).toBeNull();
    expect(parseCategories([`${validName}!`])).toBeNull();
  });

  it('rejects an empty category list', () => {
    expect(parseCategories([])).toBeNull();
  });

  it('rejects 31 categories', () => {
    expect(parseCategories(createCategories(31))).toBeNull();
  });
});
