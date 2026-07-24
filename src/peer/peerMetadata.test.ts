import { describe, expect, it } from 'vitest';
import { createPeerMetadata } from './peerMetadata';
it('creates Flutter-compatible PeerJS metadata', () => expect(createPeerMetadata(' abC234 ', 3)).toEqual({ room: 'ABC234', protocol: 3 }));
