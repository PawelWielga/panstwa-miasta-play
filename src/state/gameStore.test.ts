import { describe, expect, it, vi } from 'vitest';
import type { GameSnapshot, PlayerProfile } from '../protocol/messages';
import { connectionFailureCodes } from '../protocol/connectionFailure';
import { createPlayerIdentity } from '../storage/playerIdentityStorage';
import { createInitialState, gameReducer } from './gameStore';

function createSnapshot(
  player: PlayerProfile,
  sequenceNumber: number,
  phase: GameSnapshot['phase'],
): GameSnapshot {
  const categories = [{ id: 'city', name: 'Miasto', order: 0 }];
  return {
    gameId: 'game-1',
    roomId: 'ABC123',
    sequenceNumber,
    hostPlayerId: 'host',
    phase,
    players: [
      { profile: player, joinedAt: 1, connected: true },
      {
        profile: { id: 'host', name: 'Host', color: '#000000', emoji: '🎲' },
        joinedAt: 0,
        connected: true,
      },
    ],
    categories,
    usedLetters: phase === 'lobby' ? [] : ['B'],
    letterHistory: phase === 'lobby' ? [] : ['B'],
    round: phase === 'lobby'
      ? null
      : {
          number: 1,
          letter: 'B',
          usedLetters: ['B'],
          categories,
          deadlineAt: 90_000,
          answeringStartedAt: 0,
          lastCallPlayerId: null,
          categoryIndex: 0,
        },
    endMode: 'rounds',
    timeMode: 'fixed',
    settings: {
      answerDurationSeconds: 90,
      roundCount: 5,
      maxPlayers: 8,
      speedBonusEnabled: false,
    },
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

describe('gameReducer', () => {
  it('applies host messages without calculating scores locally', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111');
    const initial = createInitialState(createPlayerIdentity({ playerName: 'Ala' }), null);
    const state = gameReducer(initial, { type: 'host-message', receivedAt: 10, message: { type: 'countries-cities:results', finalResults: {}, roundScores: { [initial.identity.playerId]: 10 }, finalScores: { [initial.identity.playerId]: 25 } } });
    expect(state.finalScores[initial.identity.playerId]).toBe(25);
  });
  it('stores a stable code instead of host-provided text for terminal join rejection', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111');
    const initial = createInitialState(createPlayerIdentity(), null);
    const state = gameReducer(initial, {
      type: 'host-message',
      receivedAt: 10,
      message: { type: 'game:error', code: 'room_full', message: 'technical host details' },
    });
    expect(state.connectionError).toBe(connectionFailureCodes.roomFull);
    expect(state.notice).toBeNull();
  });

  it('keeps unsent answers in memory across rerenders', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111');
    const initial = createInitialState(createPlayerIdentity(), null);
    expect(gameReducer(initial, { type: 'answer', categoryId: 'city', value: 'Augustów' }).answers.city).toBe('Augustów');
  });

  it('ignores a game snapshot older than the highest host sequence', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111');
    const initial = createInitialState(createPlayerIdentity(), null);
    const current = gameReducer(initial, {
      type: 'host-message',
      receivedAt: 20,
      message: {
        type: 'game:snapshot',
        snapshot: createSnapshot(initial.identity.profile, 8, 'answering'),
      },
    });

    const stale = gameReducer(current, {
      type: 'host-message',
      receivedAt: 30,
      message: {
        type: 'game:snapshot',
        snapshot: createSnapshot(initial.identity.profile, 7, 'lobby'),
      },
    });

    expect(stale.snapshot?.sequenceNumber).toBe(8);
    expect(stale.snapshot?.phase).toBe('answering');
    expect(stale.currentLetter).toBe('B');
    expect(stale.lastSeenSequenceNumber).toBe(8);
    expect(stale.lastHostActivityAt).toBe(30);
  });

  it('ignores a duplicate game snapshot that has already been applied', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111');
    const initial = createInitialState(createPlayerIdentity(), null);
    const current = gameReducer(initial, {
      type: 'host-message',
      receivedAt: 20,
      message: {
        type: 'game:snapshot',
        snapshot: createSnapshot(initial.identity.profile, 8, 'answering'),
      },
    });

    const duplicate = gameReducer(current, {
      type: 'host-message',
      receivedAt: 30,
      message: {
        type: 'game:snapshot',
        snapshot: createSnapshot(initial.identity.profile, 8, 'lobby'),
      },
    });

    expect(duplicate.snapshot?.sequenceNumber).toBe(8);
    expect(duplicate.snapshot?.phase).toBe('answering');
    expect(duplicate.currentLetter).toBe('B');
    expect(duplicate.lastSeenSequenceNumber).toBe(8);
    expect(duplicate.lastHostActivityAt).toBe(30);
  });

  it('accepts a snapshot matching a heartbeat sequence when that snapshot was not applied yet', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111');
    const initial = createInitialState(createPlayerIdentity(), null);
    const heartbeat = gameReducer(initial, {
      type: 'host-message',
      receivedAt: 20,
      message: {
        type: 'host:heartbeat',
        gameId: 'game-1',
        sequenceNumber: 8,
      },
    });

    expect(heartbeat.snapshot).toBeNull();
    expect(heartbeat.lastSeenSequenceNumber).toBe(8);

    const current = gameReducer(heartbeat, {
      type: 'host-message',
      receivedAt: 30,
      message: {
        type: 'game:snapshot',
        snapshot: createSnapshot(initial.identity.profile, 8, 'answering'),
      },
    });

    expect(current.snapshot?.sequenceNumber).toBe(8);
    expect(current.snapshot?.phase).toBe('answering');
    expect(current.currentLetter).toBe('B');
    expect(current.lastSeenSequenceNumber).toBe(8);
    expect(current.lastHostActivityAt).toBe(30);
  });

  it('ignores stale host migration without regressing the snapshot or showing a notice', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111');
    const initial = createInitialState(createPlayerIdentity(), null);
    const current = gameReducer(initial, {
      type: 'host-message',
      receivedAt: 20,
      message: {
        type: 'game:snapshot',
        snapshot: createSnapshot(initial.identity.profile, 8, 'answering'),
      },
    });

    const stale = gameReducer(current, {
      type: 'host-message',
      receivedAt: 30,
      message: {
        type: 'host:migrated',
        gameId: 'game-1',
        newHostPlayerId: 'old-host',
        newHostIp: '192.168.0.10',
        newHostPort: 4040,
        sequenceNumber: 7,
        snapshot: createSnapshot(initial.identity.profile, 7, 'lobby'),
      },
    });

    expect(stale.snapshot?.sequenceNumber).toBe(8);
    expect(stale.snapshot?.phase).toBe('answering');
    expect(stale.lastSeenSequenceNumber).toBe(8);
    expect(stale.notice).toBeNull();
    expect(stale.lastHostActivityAt).toBe(30);
  });
});
