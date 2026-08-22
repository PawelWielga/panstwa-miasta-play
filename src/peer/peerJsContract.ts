export const PEER_JS_ONLINE_PROTOCOL_VERSION = 4;
export const PEER_JS_ONLINE_JOIN_CODE_PREFIX = 'PM4';
export const PEER_JS_ONLINE_ROOM_ID_LENGTH = 6;
export const PEER_JS_HOST_SESSION_ID_LENGTH = 26;
export const PEER_JS_ONLINE_SECRET_LENGTH = 20;
export const PEER_JS_AUTHENTICATION_NONCE_HEX_LENGTH = 32;
export const PEER_JS_AUTHENTICATION_PROOF_HEX_LENGTH = 64;
export const PEER_JS_HOST_ID_HASH_HEX_LENGTH = 32;
export const PEER_JS_MAX_PEER_ID_LENGTH = 128;
export const PEER_JS_MAX_MESSAGE_BYTES = 64 * 1024;

export const PEER_JS_AUTHENTICATION_CONTEXT = 'panstwa-miasta-peerjs-v4';
export const PEER_JS_GAME_CONNECTION_LABEL = 'panstwa-miasta-game-v4';
export const PEER_JS_BRIDGE_CHALLENGE_MESSAGE_TYPE = 'bridge:challenge';
export const PEER_JS_BRIDGE_AUTHENTICATE_MESSAGE_TYPE = 'bridge:authenticate';
export const PEER_JS_BRIDGE_READY_MESSAGE_TYPE = 'bridge:ready';

export const PEER_JS_METADATA_HOST_SESSION_ID_KEY = 'hostSessionId';
export const PEER_JS_METADATA_PROTOCOL_KEY = 'protocol';
export const PEER_JS_STUN_SERVER_URL = 'stun:stun.l.google.com:19302';
export const PEER_JS_SDP_SEMANTICS = 'unified-plan';

export const PEER_JS_UNSUPPORTED_PROTOCOL_ERROR_CODE = 'unsupported-protocol-version';
export const PEER_JS_ROOM_FULL_ERROR_CODE = 'room-full';
export const PEER_JS_ROOM_FULL_ERROR_CODES = [
  PEER_JS_ROOM_FULL_ERROR_CODE,
  'room_full',
  'too-many-players',
] as const;
export const PEER_JS_GAME_ALREADY_STARTED_ERROR_CODE = 'game-already-started';
export const PEER_JS_GAME_ALREADY_STARTED_ERROR_CODES = [
  PEER_JS_GAME_ALREADY_STARTED_ERROR_CODE,
  'game_already_started',
  'game-in-progress',
] as const;
export const PEER_JS_AUTHENTICATION_FAILED_ERROR_CODE = 'authentication-failed';
export const PEER_JS_AUTHENTICATION_ERROR_CODES = [
  PEER_JS_AUTHENTICATION_FAILED_ERROR_CODE,
  'invalid-reconnect-token',
  'invalid_reconnect_credential',
] as const;

export const PEER_JS_FRIENDLY_BASE32_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/;

export type PeerJsProofRole = 'host' | 'client';

export interface PeerJsSessionDescriptor {
  hostSessionId: string;
}

export interface PeerConnectionMetadata {
  hostSessionId: string;
  protocol: number;
}

export interface PeerJsBridgeAuthenticatePayload {
  type: typeof PEER_JS_BRIDGE_AUTHENTICATE_MESSAGE_TYPE;
  protocolVersion: number;
  hostSessionId: string;
  nonce: string;
  clientProof: string;
}

export interface PeerRtcConfiguration extends RTCConfiguration {
  sdpSemantics?: typeof PEER_JS_SDP_SEMANTICS;
}

export function createPeerJsConnectionMetadata(
  session: PeerJsSessionDescriptor,
  protocolVersion = PEER_JS_ONLINE_PROTOCOL_VERSION,
): PeerConnectionMetadata {
  return {
    [PEER_JS_METADATA_HOST_SESSION_ID_KEY]: session.hostSessionId,
    [PEER_JS_METADATA_PROTOCOL_KEY]: protocolVersion,
  };
}

export function createPeerJsBridgeAuthenticatePayload(
  hostSessionId: string,
  nonce: string,
  clientProof: string,
  protocolVersion = PEER_JS_ONLINE_PROTOCOL_VERSION,
): PeerJsBridgeAuthenticatePayload {
  return {
    type: PEER_JS_BRIDGE_AUTHENTICATE_MESSAGE_TYPE,
    protocolVersion,
    hostSessionId,
    nonce,
    clientProof,
  };
}

export function createPeerJsAuthenticationCanonicalValue(
  role: PeerJsProofRole,
  nonce: string,
  hostSessionId: string,
  peerId: string,
  protocolVersion = PEER_JS_ONLINE_PROTOCOL_VERSION,
): string {
  return [
    PEER_JS_AUTHENTICATION_CONTEXT,
    role,
    nonce.toLowerCase(),
    hostSessionId,
    peerId,
    String(protocolVersion),
  ].join('\n');
}

export function createPeerRtcConfiguration(): PeerRtcConfiguration {
  return {
    iceServers: [{ urls: PEER_JS_STUN_SERVER_URL }],
    sdpSemantics: PEER_JS_SDP_SEMANTICS,
  };
}
