import { describe, expect, it } from 'vitest';
import { SUPPORTED_GAME_PROTOCOL_VERSION } from './constants';
import { createPlayerHello, createRejoin, createStartWheelSpin } from './outgoing';

const profile = { id: 'player-1', name: 'Ala', color: '#6d4aff', emoji: '🦊' };

describe('outgoing protocol version', () => {
  it('uses the internal version for player hello', () => {
    expect(createPlayerHello({ profile, reconnectToken: 'reconnect-token' })).toMatchObject({
      type: 'player:hello',
      protocolVersion: SUPPORTED_GAME_PROTOCOL_VERSION,
    });
  });

  it('uses the internal version for reconnect', () => {
    expect(createRejoin(profile, 7)).toMatchObject({
      type: 'client:rejoin',
      protocolVersion: SUPPORTED_GAME_PROTOCOL_VERSION,
    });
  });
});

describe('wheel intent', () => {
  it('copies only authoritative wheel identifiers into the start intent', () => {
    const message = createStartWheelSpin(profile.id, {
      schemaVersion: 1,
      phase: 'waiting',
      hostSessionId: 'session-1',
      roundNumber: 3,
      spinId: 'spin-3',
      selectedPlayerId: profile.id,
      waitingStartedAt: 1_000,
      waitingDeadlineAt: 11_000,
    });

    expect(message).toMatchObject({
      type: 'player:startWheelSpin',
      senderId: profile.id,
      hostSessionId: 'session-1',
      roundNumber: 3,
      spinId: 'spin-3',
    });
    expect(message).toHaveProperty('requestId');
    expect(message).toHaveProperty('sentAt');
  });
});
