import { describe, expect, it } from 'vitest';
import { connectionFailureCodes } from '../protocol/connectionFailure';
import { classifyConnectTimeout } from './PeerJsGameTransport';

describe('PeerJsGameTransport timeout classification', () => {
  it('treats completed SDP negotiation with stuck ICE as blocked direct P2P', () => {
    expect(classifyConnectTimeout({
      signalingState: 'stable',
      iceConnectionState: 'checking',
      iceGatheringState: 'complete',
    })).toBe(connectionFailureCodes.p2pNetworkBlocked);
  });

  it('keeps a timeout before a remote SDP answer as a generic timeout', () => {
    expect(classifyConnectTimeout({
      signalingState: 'have-local-offer',
      iceConnectionState: 'new',
      iceGatheringState: 'complete',
    })).toBe(connectionFailureCodes.connectionTimeout);
  });

  it('keeps a timeout without WebRTC state as a generic timeout', () => {
    expect(classifyConnectTimeout()).toBe(connectionFailureCodes.connectionTimeout);
  });
});
