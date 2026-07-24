export interface PeerConnectionMetadata { room: string; protocol: number }
export function createPeerMetadata(roomId: string, protocolVersion: number): PeerConnectionMetadata {
  return { room: roomId.trim().toUpperCase(), protocol: protocolVersion };
}
