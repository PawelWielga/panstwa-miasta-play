import { describe, expect, it } from 'vitest';
import { connectionFailureCodes, connectionFailureCodeValues, connectionFailureCodeForGameError } from './connectionFailure';

describe('connection failure contract', () => {
  it('keeps the Android and WWW wire values stable', () => {
    expect(connectionFailureCodeValues).toEqual([
      'invalid_join_code',
      'room_unavailable',
      'stale_host_session',
      'unsupported_version',
      'join_rejected',
      'room_full',
      'game_already_started',
      'connection_timeout',
      'p2p_network_blocked',
      'signaling_interrupted',
      'game_connection_lost',
      'cancelled',
      'unknown',
    ]);
  });

  it('maps host join rejection codes without using host copy', () => {
    expect(connectionFailureCodeForGameError('room_full')).toBe(connectionFailureCodes.roomFull);
    expect(connectionFailureCodeForGameError('game_already_started')).toBe(connectionFailureCodes.gameAlreadyStarted);
    expect(connectionFailureCodeForGameError('unexpected')).toBe(connectionFailureCodes.joinRejected);
  });
});
