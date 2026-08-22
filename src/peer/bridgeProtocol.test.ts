import { describe, expect, it } from 'vitest';
import {
  createPeerJsBridgeAuthenticateMessage,
  isPeerJsTransportMessage,
  parsePeerJsBridgeChallengeMessage,
  parsePeerJsBridgeReadyMessage,
} from './bridgeProtocol';
import { joinParameters } from '../test/fixtures';

const nonce = '00112233445566778899aabbccddeeff';
const peerId = 'panstwa-miasta-room-v4-5965155548de8da8b74a1704f689c85e';

describe('PeerJS bridge protocol', () => {
  it('parses a complete challenge and creates a scoped response', () => {
    const challenge = parsePeerJsBridgeChallengeMessage({
      type: 'bridge:challenge', appVersion: '1.1.7', buildNumber: 10, protocolVersion: 4,
      hostSessionId: joinParameters.hostSessionId, nonce, peerId, hostProof: 'a'.repeat(64),
    });
    if (challenge === null) throw new Error('Expected valid challenge.');
    expect(createPeerJsBridgeAuthenticateMessage(challenge, 'b'.repeat(64))).toEqual({
      type: 'bridge:authenticate', protocolVersion: 4,
      hostSessionId: joinParameters.hostSessionId, nonce, clientProof: 'b'.repeat(64),
    });
  });

  it('rejects malformed challenge and recognizes transport messages', () => {
    expect(parsePeerJsBridgeChallengeMessage({ type: 'bridge:challenge' })).toBeNull();
    expect(isPeerJsTransportMessage({ type: 'bridge:challenge' })).toBe(true);
    expect(isPeerJsTransportMessage({ type: 'game:snapshot' })).toBe(false);
  });

  it('requires session id in bridge ready', () => {
    expect(parsePeerJsBridgeReadyMessage({
      type: 'bridge:ready', appVersion: '1.1.7', buildNumber: 10, protocolVersion: 4,
      hostSessionId: joinParameters.hostSessionId,
    })).not.toBeNull();
    expect(parsePeerJsBridgeReadyMessage({ type: 'bridge:ready' })).toBeNull();
  });
});
