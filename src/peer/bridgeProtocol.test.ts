import { describe, expect, it } from 'vitest';
import { isPeerJsBridgeReadyMessage, parsePeerJsBridgeReadyMessage } from './bridgeProtocol';

describe('PeerJS bridge protocol', () => {
  it('parses typed host version metadata', () => {
    expect(parsePeerJsBridgeReadyMessage({
      type: 'bridge:ready',
      appVersion: '1.1.7',
      buildNumber: 10,
      protocolVersion: 3,
    })).toEqual({
      type: 'bridge:ready',
      appVersion: '1.1.7',
      buildNumber: 10,
      protocolVersion: 3,
    });
  });

  it('recognizes malformed bridge control messages without accepting their metadata', () => {
    const message = { type: 'bridge:ready' };
    expect(isPeerJsBridgeReadyMessage(message)).toBe(true);
    expect(parsePeerJsBridgeReadyMessage(message)).toBeNull();
  });
});
