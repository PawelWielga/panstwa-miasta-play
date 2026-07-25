import { SUPPORTED_GAME_PROTOCOL_VERSION } from '../protocol/constants';

const PEER_JS_ROOM_HOST_ID_PREFIX = 'panstwa-miasta-room-v';

export function buildPeerJsHostId(roomId: string): string {
  const normalizedRoomId = roomId.trim().toLowerCase();
  if (!normalizedRoomId) throw new Error('Kod pokoju nie może być pusty.');
  if (!/^[a-z0-9]+$/.test(normalizedRoomId)) {
    throw new Error('Kod pokoju zawiera nieobsługiwane znaki.');
  }
  return `${PEER_JS_ROOM_HOST_ID_PREFIX}${String(SUPPORTED_GAME_PROTOCOL_VERSION)}-${normalizedRoomId}`;
}
