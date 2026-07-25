import { SUPPORTED_GAME_PROTOCOL_VERSION } from '../protocol/constants';

export interface PeerConnectionMetadata { room: string; protocol: number }
export function createPeerMetadata(roomId: string): PeerConnectionMetadata {
  return { room: roomId.trim().toUpperCase(), protocol: SUPPORTED_GAME_PROTOCOL_VERSION };
}
