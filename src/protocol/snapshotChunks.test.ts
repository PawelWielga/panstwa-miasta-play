import { describe, expect, it } from 'vitest';
import type { GameSnapshot, GameSnapshotChunkHostMessage } from './messages';
import { GameSnapshotChunkAssembler } from './snapshotChunks';

function smallSnapshot(sequenceNumber = 1): GameSnapshot {
  return {
    gameId: 'g-chunks',
    roomId: 'ABC234',
    sequenceNumber,
    hostPlayerId: 'host',
    phase: 'answering',
    players: [{ profile: { id: 'host', name: 'Host', color: '#000', emoji: '🎲' }, joinedAt: 1, connected: true }],
    categories: [{ id: 'city', name: 'Miasto', order: 0 }],
    usedLetters: ['A'],
    letterHistory: ['A'],
    round: {
      number: 1,
      letter: 'A',
      usedLetters: ['A'],
      categories: [{ id: 'city', name: 'Miasto', order: 0 }],
      deadlineAt: 1000,
      answeringStartedAt: 1,
      lastCallPlayerId: null,
      categoryIndex: 0,
    },
    endMode: 'timer',
    timeMode: 'per-answer-10s',
    settings: { answerDurationSeconds: 90, roundCount: 5, maxPlayers: 8, speedBonusEnabled: false },
    hostControlsReview: true,
    submissions: {},
    submittedAtByPlayerId: {},
    donePlayerIds: [],
    votes: {},
    hostVoteSuggestions: {},
    reviewReady: {},
    finalResults: {},
    roundScores: {},
    finalScores: {},
    speedBonusPlayerIds: [],
  };
}

function twoChunks(snapshot: GameSnapshot): [GameSnapshotChunkHostMessage, GameSnapshotChunkHostMessage] {
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
  const splitAt = Math.ceil(bytes.byteLength / 2);
  const parts = [bytes.slice(0, splitAt), bytes.slice(splitAt)];
  return parts.map((part, chunkIndex) => ({
    type: 'game:snapshot-chunk' as const,
    gameId: snapshot.gameId,
    sequenceNumber: snapshot.sequenceNumber,
    chunkIndex,
    chunkCount: 2,
    payload: bytesToBase64(part),
  })) as [GameSnapshotChunkHostMessage, GameSnapshotChunkHostMessage];
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return globalThis.btoa(binary);
}

describe('GameSnapshotChunkAssembler', () => {
  it('expires an incomplete assembly before accepting a late chunk', () => {
    let now = 0;
    const assembler = new GameSnapshotChunkAssembler(() => now, 100, 4);
    const [first, second] = twoChunks(smallSnapshot(10));

    expect(assembler.add(first)).toBeNull();
    expect(assembler.pendingAssemblyCount).toBe(1);

    now = 101;
    expect(assembler.add(second)).toBeNull();
    expect(assembler.pendingAssemblyCount).toBe(1);
  });

  it('drops an assembly when a duplicate chunk has conflicting bytes', () => {
    const assembler = new GameSnapshotChunkAssembler();
    const [first] = twoChunks(smallSnapshot(11));
    const conflicting = { ...first, payload: bytesToBase64(new TextEncoder().encode('conflict')) };

    expect(assembler.add(first)).toBeNull();
    expect(assembler.pendingAssemblyCount).toBe(1);
    expect(assembler.add(conflicting)).toBeNull();
    expect(assembler.pendingAssemblyCount).toBe(0);
  });
});
