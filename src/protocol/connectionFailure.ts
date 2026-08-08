export const connectionFailureCodes = {
  invalidJoinCode: 'invalid_join_code',
  roomUnavailable: 'room_unavailable',
  staleHostSession: 'stale_host_session',
  unsupportedVersion: 'unsupported_version',
  joinRejected: 'join_rejected',
  roomFull: 'room_full',
  gameAlreadyStarted: 'game_already_started',
  connectionTimeout: 'connection_timeout',
  p2pNetworkBlocked: 'p2p_network_blocked',
  signalingInterrupted: 'signaling_interrupted',
  gameConnectionLost: 'game_connection_lost',
  cancelled: 'cancelled',
  unknown: 'unknown',
} as const;

export type ConnectionFailureCode = typeof connectionFailureCodes[keyof typeof connectionFailureCodes];

export const connectionFailureCodeValues: readonly ConnectionFailureCode[] = Object.values(connectionFailureCodes);

export function connectionFailureCodeForGameError(code?: string): ConnectionFailureCode {
  switch (code) {
    case 'room_full': return connectionFailureCodes.roomFull;
    case 'game_already_started': return connectionFailureCodes.gameAlreadyStarted;
    default: return connectionFailureCodes.joinRejected;
  }
}
