import { PEER_JS_ONLINE_PROTOCOL_VERSION } from '../protocol/constants';
import type { PeerJsOnlineJoinCredentials } from './onlineJoinCredentials';

export interface PeerConnectionMetadata { hostSessionId: string; protocol: number }

export function createPeerMetadata(credentials: PeerJsOnlineJoinCredentials): PeerConnectionMetadata {
  return {
    hostSessionId: credentials.hostSessionId,
    protocol: PEER_JS_ONLINE_PROTOCOL_VERSION,
  };
}
