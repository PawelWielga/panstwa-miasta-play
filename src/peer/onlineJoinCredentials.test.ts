import { describe, expect, it } from 'vitest';
import { joinParameters, testOnlineJoinCode } from '../test/fixtures';
import {
  buildPeerJsHostId,
  createPeerJsProof,
  parseOnlineJoinCode,
  verifyPeerJsProof,
} from './onlineJoinCredentials';

const nonce = '00112233445566778899aabbccddeeff';
const peerId = 'panstwa-miasta-room-v4-5965155548de8da8b74a1704f689c85e';
const hostProof = 'f2af71e0c49059d2a4e3d6ae6174fd7230444595d0b91f2646a7a5f2acea8444';
const clientProof = 'd00558fdb53aa8d655e271340cc8982f5a4a7580ed5fa73f5fa509ffd674fe3a';

describe('PeerJS online credentials', () => {
  it('matches the shared token and SHA-256 Peer ID vector', async () => {
    expect(parseOnlineJoinCode(testOnlineJoinCode)).toEqual(joinParameters);
    await expect(buildPeerJsHostId(testOnlineJoinCode)).resolves.toBe(peerId);
  });

  it('matches the shared host and client HMAC vectors', async () => {
    await expect(createPeerJsProof('host', joinParameters, nonce, peerId)).resolves.toBe(hostProof);
    await expect(createPeerJsProof('client', joinParameters, nonce, peerId)).resolves.toBe(clientProof);
  });

  it('uses constant-time proof verification semantics and rejects malformed proofs', async () => {
    await expect(verifyPeerJsProof('host', joinParameters, nonce, peerId, hostProof)).resolves.toBe(true);
    await expect(verifyPeerJsProof('host', joinParameters, nonce, peerId, clientProof)).resolves.toBe(false);
    await expect(verifyPeerJsProof('host', joinParameters, nonce, peerId, 'invalid')).resolves.toBe(false);
  });
});
