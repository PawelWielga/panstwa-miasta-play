import type { HostVersionInfo } from '../config/hostCompatibility';
import { PEER_JS_ONLINE_PROTOCOL_VERSION } from '../protocol/constants';
import { validateNonce } from './onlineJoinCredentials';

export const PEER_JS_BRIDGE_CHALLENGE_MESSAGE_TYPE = 'bridge:challenge';
export const PEER_JS_BRIDGE_AUTHENTICATE_MESSAGE_TYPE = 'bridge:authenticate';
export const PEER_JS_BRIDGE_READY_MESSAGE_TYPE = 'bridge:ready';

export interface PeerJsBridgeChallengeMessage extends HostVersionInfo {
  type: typeof PEER_JS_BRIDGE_CHALLENGE_MESSAGE_TYPE;
  hostSessionId: string;
  nonce: string;
  peerId: string;
  hostProof: string;
}

export interface PeerJsBridgeAuthenticateMessage {
  type: typeof PEER_JS_BRIDGE_AUTHENTICATE_MESSAGE_TYPE;
  protocolVersion: number;
  hostSessionId: string;
  nonce: string;
  clientProof: string;
}

export interface PeerJsBridgeReadyMessage extends HostVersionInfo {
  type: typeof PEER_JS_BRIDGE_READY_MESSAGE_TYPE;
  hostSessionId: string;
}

export function createPeerJsBridgeAuthenticateMessage(
  challenge: PeerJsBridgeChallengeMessage,
  clientProof: string,
): PeerJsBridgeAuthenticateMessage {
  return {
    type: PEER_JS_BRIDGE_AUTHENTICATE_MESSAGE_TYPE,
    protocolVersion: PEER_JS_ONLINE_PROTOCOL_VERSION,
    hostSessionId: challenge.hostSessionId,
    nonce: challenge.nonce,
    clientProof,
  };
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
    || !/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{26}$/.test(candidate.hostSessionId)
    || typeof candidate.nonce !== 'string'
    || typeof candidate.peerId !== 'string'
    || candidate.peerId.length < 1
    || candidate.peerId.length > 128
    || typeof candidate.hostProof !== 'string'
    || !/^[0-9a-f]{64}$/.test(candidate.hostProof)) return null;
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
    || !/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{26}$/.test(candidate.hostSessionId)) return null;
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
