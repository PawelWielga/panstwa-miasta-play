import type { HostVersionInfo } from '../config/hostCompatibility';
import { validateNonce } from './onlineJoinCredentials';
import {
  createPeerJsBridgeAuthenticatePayload,
  PEER_JS_AUTHENTICATION_PROOF_HEX_LENGTH,
  PEER_JS_BRIDGE_AUTHENTICATE_MESSAGE_TYPE,
  PEER_JS_BRIDGE_CHALLENGE_MESSAGE_TYPE,
  PEER_JS_BRIDGE_READY_MESSAGE_TYPE,
  PEER_JS_HOST_SESSION_ID_LENGTH,
  PEER_JS_MAX_PEER_ID_LENGTH,
  type PeerJsBridgeAuthenticatePayload,
} from './peerJsContract';

export {
  PEER_JS_BRIDGE_AUTHENTICATE_MESSAGE_TYPE,
  PEER_JS_BRIDGE_CHALLENGE_MESSAGE_TYPE,
  PEER_JS_BRIDGE_READY_MESSAGE_TYPE,
} from './peerJsContract';

export interface PeerJsBridgeChallengeMessage extends HostVersionInfo {
  type: typeof PEER_JS_BRIDGE_CHALLENGE_MESSAGE_TYPE;
  hostSessionId: string;
  nonce: string;
  peerId: string;
  hostProof: string;
}

export type PeerJsBridgeAuthenticateMessage =
  PeerJsBridgeAuthenticatePayload;

export interface PeerJsBridgeReadyMessage extends HostVersionInfo {
  type: typeof PEER_JS_BRIDGE_READY_MESSAGE_TYPE;
  hostSessionId: string;
}

export function createPeerJsBridgeAuthenticateMessage(
  challenge: PeerJsBridgeChallengeMessage,
  clientProof: string,
): PeerJsBridgeAuthenticateMessage {
  return createPeerJsBridgeAuthenticatePayload(
    challenge.hostSessionId,
    challenge.nonce,
    clientProof,
  );
}

export function isPeerJsTransportMessage(value: unknown): boolean {
  const type = getMessageType(value);
  return type === PEER_JS_BRIDGE_CHALLENGE_MESSAGE_TYPE
    || type === PEER_JS_BRIDGE_AUTHENTICATE_MESSAGE_TYPE
    || type === PEER_JS_BRIDGE_READY_MESSAGE_TYPE;
}

export function parsePeerJsBridgeChallengeMessage(value: unknown): PeerJsBridgeChallengeMessage | null {
  if (getMessageType(value) !== PEER_JS_BRIDGE_CHALLENGE_MESSAGE_TYPE) return null;
  const candidate = value as Partial<Record<keyof PeerJsBridgeChallengeMessage, unknown>>;
  const version = parseHostVersion(candidate);
  if (version === null
    || typeof candidate.hostSessionId !== 'string'
    || !new RegExp(`^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{${String(PEER_JS_HOST_SESSION_ID_LENGTH)}}$`)
      .test(candidate.hostSessionId)
    || typeof candidate.nonce !== 'string'
    || typeof candidate.peerId !== 'string'
    || candidate.peerId.length < 1
    || candidate.peerId.length > PEER_JS_MAX_PEER_ID_LENGTH
    || typeof candidate.hostProof !== 'string'
    || !new RegExp(`^[0-9a-f]{${String(PEER_JS_AUTHENTICATION_PROOF_HEX_LENGTH)}}$`)
      .test(candidate.hostProof)) return null;
  try { validateNonce(candidate.nonce); } catch { return null; }
  return {
    type: PEER_JS_BRIDGE_CHALLENGE_MESSAGE_TYPE,
    ...version,
    hostSessionId: candidate.hostSessionId,
    nonce: candidate.nonce,
    peerId: candidate.peerId,
    hostProof: candidate.hostProof,
  };
}

export function parsePeerJsBridgeReadyMessage(value: unknown): PeerJsBridgeReadyMessage | null {
  if (getMessageType(value) !== PEER_JS_BRIDGE_READY_MESSAGE_TYPE) return null;
  const candidate = value as Partial<Record<keyof PeerJsBridgeReadyMessage, unknown>>;
  const version = parseHostVersion(candidate);
  if (version === null
    || typeof candidate.hostSessionId !== 'string'
    || !new RegExp(`^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{${String(PEER_JS_HOST_SESSION_ID_LENGTH)}}$`)
      .test(candidate.hostSessionId)) return null;
  return {
    type: PEER_JS_BRIDGE_READY_MESSAGE_TYPE,
    ...version,
    hostSessionId: candidate.hostSessionId,
  };
}

function parseHostVersion(candidate: Partial<Record<keyof HostVersionInfo, unknown>>): HostVersionInfo | null {
  if (typeof candidate.appVersion !== 'string' || candidate.appVersion.trim().length === 0) return null;
  if (typeof candidate.buildNumber !== 'number'
    || !Number.isSafeInteger(candidate.buildNumber)
    || candidate.buildNumber < 1) return null;
  if (typeof candidate.protocolVersion !== 'number'
    || !Number.isSafeInteger(candidate.protocolVersion)
    || candidate.protocolVersion < 1) return null;
  return {
    appVersion: candidate.appVersion.trim(),
    buildNumber: candidate.buildNumber,
    protocolVersion: candidate.protocolVersion,
  };
}

function getMessageType(value: unknown): unknown {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as { type?: unknown }).type
    : null;
}
