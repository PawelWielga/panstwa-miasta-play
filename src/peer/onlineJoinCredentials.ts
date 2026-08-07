import {
  createPeerJsAuthenticationCanonicalValue,
  PEER_JS_AUTHENTICATION_NONCE_HEX_LENGTH,
  PEER_JS_AUTHENTICATION_PROOF_HEX_LENGTH,
  PEER_JS_FRIENDLY_BASE32_PATTERN,
  PEER_JS_HOST_ID_HASH_HEX_LENGTH,
  PEER_JS_HOST_SESSION_ID_LENGTH,
  PEER_JS_ONLINE_JOIN_CODE_PREFIX,
  PEER_JS_ONLINE_PROTOCOL_VERSION,
  PEER_JS_ONLINE_ROOM_ID_LENGTH,
  PEER_JS_ONLINE_SECRET_LENGTH,
  type PeerJsProofRole,
} from './peerJsContract';

export interface PeerJsOnlineJoinCredentials {
  roomId: string;
  hostSessionId: string;
  onlineJoinCode: string;
}

const shortOnlineJoinCodePattern = /^[A-Z0-9]{6}$/;

export function normalizeOnlineJoinCode(rawCode: string): string {
  return rawCode.trim().toUpperCase();
}

export function parseOnlineJoinCode(rawCode: string): PeerJsOnlineJoinCredentials {
  const onlineJoinCode = normalizeOnlineJoinCode(rawCode);
  if (!onlineJoinCode) throw new Error('Kod dołączenia nie może być pusty.');

  if (shortOnlineJoinCodePattern.test(onlineJoinCode)) {
    return deriveOnlineJoinCredentials(onlineJoinCode);
  }

  const parts = onlineJoinCode.split('-');
  if (parts.length !== 4 || parts[0] !== PEER_JS_ONLINE_JOIN_CODE_PREFIX) {
    throw new Error('Kod dołączenia ma nieobsługiwany format. Poproś prowadzącego o nowy kod.');
  }
  const roomId = parts[1] ?? '';
  const hostSessionId = parts[2] ?? '';
  const secret = parts[3] ?? '';
  if (!new RegExp(`^[A-Z0-9]{${String(PEER_JS_ONLINE_ROOM_ID_LENGTH)}}$`).test(roomId)) {
    throw new Error('Kod dołączenia zawiera nieprawidłowy identyfikator pokoju.');
  }
  if (hostSessionId.length !== PEER_JS_HOST_SESSION_ID_LENGTH
    || !PEER_JS_FRIENDLY_BASE32_PATTERN.test(hostSessionId)) {
    throw new Error('Kod dołączenia zawiera nieprawidłową sesję hosta.');
  }
  if (secret.length !== PEER_JS_ONLINE_SECRET_LENGTH
    || !PEER_JS_FRIENDLY_BASE32_PATTERN.test(secret)) {
    throw new Error('Kod dołączenia zawiera nieprawidłowy sekret.');
  }
  return { roomId, hostSessionId, onlineJoinCode };
}

export function validateOnlineJoinCredentials(credentials: PeerJsOnlineJoinCredentials): void {
  const parsed = parseOnlineJoinCode(credentials.onlineJoinCode);
  if (parsed.roomId !== credentials.roomId.trim().toUpperCase()
    || parsed.hostSessionId !== credentials.hostSessionId.trim().toUpperCase()) {
    throw new Error('Dane dołączenia nie opisują tej samej sesji hosta.');
  }
}

export async function buildPeerJsHostId(onlineJoinCode: string): Promise<string> {
  const normalizedCode = parseOnlineJoinCode(onlineJoinCode).onlineJoinCode;
  const digest = await crypto.subtle.digest('SHA-256', utf8(normalizedCode));
  return `panstwa-miasta-room-v${String(PEER_JS_ONLINE_PROTOCOL_VERSION)}-${toHex(digest).slice(0, PEER_JS_HOST_ID_HASH_HEX_LENGTH)}`;
}

export async function createPeerJsProof(
  role: PeerJsProofRole,
  credentials: PeerJsOnlineJoinCredentials,
  nonce: string,
  peerId: string,
): Promise<string> {
  validateOnlineJoinCredentials(credentials);
  validateNonce(nonce);
  const key = await crypto.subtle.importKey(
    'raw',
    utf8(credentials.onlineJoinCode),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const canonical = createPeerJsAuthenticationCanonicalValue(
    role,
    nonce,
    credentials.hostSessionId,
    peerId,
  );
  return toHex(await crypto.subtle.sign('HMAC', key, utf8(canonical)));
}

export async function verifyPeerJsProof(
  expectedRole: PeerJsProofRole,
  credentials: PeerJsOnlineJoinCredentials,
  nonce: string,
  peerId: string,
  actualProof: string,
): Promise<boolean> {
  if (!new RegExp(`^[0-9a-f]{${String(PEER_JS_AUTHENTICATION_PROOF_HEX_LENGTH)}}$`).test(actualProof)) return false;
  const expectedProof = await createPeerJsProof(expectedRole, credentials, nonce, peerId);
  return constantTimeEqual(fromHex(expectedProof), fromHex(actualProof));
}

export function validateNonce(nonce: string): void {
  if (!new RegExp(`^[0-9a-f]{${String(PEER_JS_AUTHENTICATION_NONCE_HEX_LENGTH)}}$`).test(nonce)) throw new Error('Host wysłał nieprawidłowe wyzwanie uwierzytelniające.');
}

export function shortSessionId(hostSessionId: string): string {
  return hostSessionId.length <= 8 ? hostSessionId : `${hostSessionId.slice(0, 8)}…`;
}

function deriveOnlineJoinCredentials(roomId: string): PeerJsOnlineJoinCredentials {
  const normalizedRoomId = normalizeOnlineJoinCode(roomId);
  if (!shortOnlineJoinCodePattern.test(normalizedRoomId)) {
    throw new Error('Kod pokoju musi mieć dokładnie 6 liter lub cyfr.');
  }

  const friendlySeed = normalizedRoomId
    .replaceAll('0', '2')
    .replaceAll('1', '3')
    .replaceAll('I', 'J')
    .replaceAll('O', 'P');
  const hostSessionId = repeatToLength(friendlySeed, PEER_JS_HOST_SESSION_ID_LENGTH);
  const secret = repeatToLength(
    [...friendlySeed].reverse().join(''),
    PEER_JS_ONLINE_SECRET_LENGTH,
  );
  const onlineJoinCode = [
    PEER_JS_ONLINE_JOIN_CODE_PREFIX,
    normalizedRoomId,
    hostSessionId,
    secret,
  ].join('-');

  return { roomId: normalizedRoomId, hostSessionId, onlineJoinCode };
}

function repeatToLength(value: string, length: number): string {
  return value.repeat(Math.ceil(length / value.length)).slice(0, length);
}

function utf8(value: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(value);
}

function toHex(value: ArrayBuffer): string {
  return Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}
