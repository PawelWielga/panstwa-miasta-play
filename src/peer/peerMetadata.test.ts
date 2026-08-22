import { expect, it } from 'vitest';
import { PEER_JS_ONLINE_PROTOCOL_VERSION } from '../protocol/constants';
import { joinParameters } from '../test/fixtures';
import { createPeerMetadata } from './peerMetadata';

it('creates session-scoped PeerJS metadata without the join secret', () => {
  expect(createPeerMetadata(joinParameters)).toEqual({
    hostSessionId: joinParameters.hostSessionId,
    protocol: PEER_JS_ONLINE_PROTOCOL_VERSION,
  });
  expect(JSON.stringify(createPeerMetadata(joinParameters))).not.toContain(joinParameters.onlineJoinCode);
});
