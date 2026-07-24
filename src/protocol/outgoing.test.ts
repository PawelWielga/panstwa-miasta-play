import { describe, expect, it } from 'vitest';
import { SUPPORTED_GAME_PROTOCOL_VERSION } from './constants';
import { createPlayerHello, createRejoin } from './outgoing';

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
