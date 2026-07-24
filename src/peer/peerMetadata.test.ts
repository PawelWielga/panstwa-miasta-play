import { expect, it } from 'vitest';
import { SUPPORTED_GAME_PROTOCOL_VERSION } from '../protocol/constants';
import { createPeerMetadata } from './peerMetadata';

it('creates Flutter-compatible PeerJS metadata from the room code only', () => {
  expect(createPeerMetadata(' abC123 ')).toEqual({ room: 'ABC123', protocol: SUPPORTED_GAME_PROTOCOL_VERSION });
});
