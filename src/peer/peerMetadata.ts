import type { PeerJsOnlineJoinCredentials } from './onlineJoinCredentials';
import {
  createPeerJsConnectionMetadata,
  type PeerConnectionMetadata,
} from './peerJsContract';

export type { PeerConnectionMetadata } from './peerJsContract';

export function createPeerMetadata(
  credentials: Pick<PeerJsOnlineJoinCredentials, 'hostSessionId'>,
): PeerConnectionMetadata {
  return createPeerJsConnectionMetadata(credentials);
}
