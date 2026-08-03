import fixtureText from '../test/fixtures/peerjs_contract_v4.json?raw';
import { describe, expect, it } from 'vitest';
import {
  createPeerJsBridgeAuthenticateMessage,
  parsePeerJsBridgeChallengeMessage,
  parsePeerJsBridgeReadyMessage,
} from './bridgeProtocol';
import {
  buildPeerJsHostId,
  createPeerJsProof,
  parseOnlineJoinCode,
} from './onlineJoinCredentials';
import { createPeerMetadata } from './peerMetadata';
import {
  createPeerRtcConfiguration,
  PEER_JS_AUTHENTICATION_CONTEXT,
  PEER_JS_AUTHENTICATION_FAILED_ERROR_CODE,
  PEER_JS_AUTHENTICATION_NONCE_HEX_LENGTH,
  PEER_JS_AUTHENTICATION_PROOF_HEX_LENGTH,
  PEER_JS_BRIDGE_AUTHENTICATE_MESSAGE_TYPE,
  PEER_JS_BRIDGE_CHALLENGE_MESSAGE_TYPE,
  PEER_JS_BRIDGE_READY_MESSAGE_TYPE,
  PEER_JS_GAME_ALREADY_STARTED_ERROR_CODE,
  PEER_JS_GAME_CONNECTION_LABEL,
  PEER_JS_HOST_ID_HASH_HEX_LENGTH,
  PEER_JS_HOST_SESSION_ID_LENGTH,
  PEER_JS_ONLINE_JOIN_CODE_PREFIX,
  PEER_JS_ONLINE_PROTOCOL_VERSION,
  PEER_JS_ONLINE_ROOM_ID_LENGTH,
  PEER_JS_ONLINE_SECRET_LENGTH,
  PEER_JS_MAX_MESSAGE_BYTES,
  PEER_JS_MAX_PEER_ID_LENGTH,
  PEER_JS_ROOM_FULL_ERROR_CODE,
  PEER_JS_UNSUPPORTED_PROTOCOL_ERROR_CODE,
} from './peerJsContract';

const EXPECTED_FIXTURE_SHA256 = '511d759248509a097fe80f9c2d25d2bd4c1101bb3177454fedbd376d8afe1234';
const fixtureBytes = new TextEncoder().encode(fixtureText);
const fixture = JSON.parse(fixtureText) as ContractFixture;

describe('PeerJS v4 shared contract vectors', () => {
  it('keeps an immutable fixture checksum', async () => {
    const digest = await crypto.subtle.digest('SHA-256', fixtureBytes);
    expect(toHex(digest)).toBe(EXPECTED_FIXTURE_SHA256);
    expect(fixture.schemaVersion).toBe(1);
    expect(fixture.contractId).toBe(PEER_JS_AUTHENTICATION_CONTEXT);
  });

  it('matches all runtime contract constants', () => {
    expect(PEER_JS_ONLINE_PROTOCOL_VERSION).toBe(fixture.protocolVersion);
    expect(PEER_JS_ONLINE_JOIN_CODE_PREFIX).toBe(fixture.joinCodePrefix);
    expect(PEER_JS_GAME_CONNECTION_LABEL).toBe(fixture.connectionLabel);
    expect(PEER_JS_AUTHENTICATION_CONTEXT).toBe(fixture.authenticationContext);
    expect(PEER_JS_ONLINE_ROOM_ID_LENGTH).toBe(fixture.roomIdLength);
    expect(PEER_JS_HOST_SESSION_ID_LENGTH).toBe(fixture.hostSessionIdLength);
    expect(PEER_JS_ONLINE_SECRET_LENGTH).toBe(fixture.onlineSecretLength);
    expect(PEER_JS_AUTHENTICATION_NONCE_HEX_LENGTH).toBe(fixture.nonceHexLength);
    expect(PEER_JS_AUTHENTICATION_PROOF_HEX_LENGTH).toBe(fixture.proofHexLength);
    expect(PEER_JS_HOST_ID_HASH_HEX_LENGTH).toBe(fixture.peerIdHashHexLength);
    expect(PEER_JS_MAX_PEER_ID_LENGTH).toBe(fixture.maxPeerIdLength);
    expect(PEER_JS_MAX_MESSAGE_BYTES).toBe(fixture.maxMessageBytes);
    expect(PEER_JS_BRIDGE_CHALLENGE_MESSAGE_TYPE).toBe(fixture.messageTypes.challenge);
    expect(PEER_JS_BRIDGE_AUTHENTICATE_MESSAGE_TYPE).toBe(fixture.messageTypes.authenticate);
    expect(PEER_JS_BRIDGE_READY_MESSAGE_TYPE).toBe(fixture.messageTypes.ready);
  });

  it('matches credentials, Peer ID and HMAC vectors', async () => {
    const credentials = parseOnlineJoinCode(fixture.credentials.onlineJoinCode);
    expect(credentials.roomId).toBe(fixture.credentials.roomId);
    expect(credentials.hostSessionId).toBe(fixture.credentials.hostSessionId);
    await expect(buildPeerJsHostId(credentials.onlineJoinCode))
      .resolves.toBe(fixture.credentials.peerId);
    await expect(createPeerJsProof(
      'host', credentials, fixture.credentials.nonce, fixture.credentials.peerId,
    )).resolves.toBe(fixture.credentials.hostProof);
    await expect(createPeerJsProof(
      'client', credentials, fixture.credentials.nonce, fixture.credentials.peerId,
    )).resolves.toBe(fixture.credentials.clientProof);
  });

  it('matches metadata and bridge message vectors', () => {
    const credentials = parseOnlineJoinCode(fixture.credentials.onlineJoinCode);
    expect(createPeerMetadata(credentials)).toEqual(fixture.metadata);
    expect(parsePeerJsBridgeChallengeMessage(fixture.challengeMessage))
      .toEqual(fixture.challengeMessage);
    expect(createPeerJsBridgeAuthenticateMessage(
      fixture.challengeMessage,
      fixture.credentials.clientProof,
    )).toEqual(fixture.authenticateMessage);
    expect(parsePeerJsBridgeReadyMessage(fixture.readyMessage))
      .toEqual(fixture.readyMessage);
  });

  it('matches STUN-only ICE and stable public error codes', () => {
    expect(createPeerRtcConfiguration()).toEqual({
      iceServers: [{ urls: fixture.ice.stunUrl }],
      sdpSemantics: fixture.ice.sdpSemantics,
    });
    expect(JSON.stringify(createPeerRtcConfiguration())).not.toContain('turn:');
    expect(JSON.stringify(createPeerRtcConfiguration())).not.toContain('turns:');
    expect(fixture.ice.turnAllowed).toBe(false);
    expect(PEER_JS_UNSUPPORTED_PROTOCOL_ERROR_CODE)
      .toBe(fixture.publicErrorCodes.unsupportedProtocol);
    expect(PEER_JS_ROOM_FULL_ERROR_CODE).toBe(fixture.publicErrorCodes.roomFull);
    expect(PEER_JS_GAME_ALREADY_STARTED_ERROR_CODE)
      .toBe(fixture.publicErrorCodes.gameAlreadyStarted);
    expect(PEER_JS_AUTHENTICATION_FAILED_ERROR_CODE)
      .toBe(fixture.publicErrorCodes.authenticationFailed);
  });
});

interface ContractFixture {
  schemaVersion: number;
  contractId: string;
  protocolVersion: number;
  joinCodePrefix: string;
  connectionLabel: string;
  authenticationContext: string;
  roomIdLength: number;
  hostSessionIdLength: number;
  onlineSecretLength: number;
  nonceHexLength: number;
  proofHexLength: number;
  peerIdHashHexLength: number;
  maxPeerIdLength: number;
  maxMessageBytes: number;
  messageTypes: { challenge: string; authenticate: string; ready: string };
  ice: { stunUrl: string; sdpSemantics: string; turnAllowed: boolean };
  credentials: {
    onlineJoinCode: string;
    roomId: string;
    hostSessionId: string;
    peerId: string;
    nonce: string;
    hostProof: string;
    clientProof: string;
  };
  metadata: { hostSessionId: string; protocol: number };
  challengeMessage: {
    type: 'bridge:challenge';
    appVersion: string;
    buildNumber: number;
    protocolVersion: number;
    hostSessionId: string;
    nonce: string;
    peerId: string;
    hostProof: string;
  };
  authenticateMessage: {
    type: 'bridge:authenticate';
    protocolVersion: number;
    hostSessionId: string;
    nonce: string;
    clientProof: string;
  };
  readyMessage: {
    type: 'bridge:ready';
    appVersion: string;
    buildNumber: number;
    protocolVersion: number;
    hostSessionId: string;
  };
  publicErrorCodes: {
    unsupportedProtocol: string;
    roomFull: string;
    gameAlreadyStarted: string;
    authenticationFailed: string;
  };
}

function toHex(value: ArrayBuffer): string {
  return Array.from(
    new Uint8Array(value),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
}
