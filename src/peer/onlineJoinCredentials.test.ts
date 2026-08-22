import { describe, expect, it } from 'vitest';
import { joinParameters, testOnlineJoinCode } from '../test/fixtures';
import {
  buildPeerJsHostId,
  createPeerJsProof,
  normalizeShortOnlineJoinCodeInput,
  parseOnlineJoinCode,
  verifyPeerJsProof,
} from './onlineJoinCredentials';

const nonce = '00112233445566778899aabbccddeeff';
const peerId = 'panstwa-miasta-room-v4-5965155548de8da8b74a1704f689c85e';
const hostProof = 'f2af71e0c49059d2a4e3d6ae6174fd7230444595d0b91f2646a7a5f2acea8444';
const clientProof = 'd00558fdb53aa8d655e271340cc8982f5a4a7580ed5fa73f5fa509ffd674fe3a';
const shortRoomCode = 'ABC234';
const derivedOnlineJoinCode = 'PM4-ABC234-ABC234ABC234ABC234ABC234AB-432CBA432CBA432CBA43';
const derivedPeerId = 'panstwa-miasta-room-v4-d7fee74e05cf19a0c1b97b4486a7b738';

describe('PeerJS online credentials', () => {
  it('matches the shared legacy token and SHA-256 Peer ID vector', async () => {
    expect(parseOnlineJoinCode(testOnlineJoinCode)).toEqual(joinParameters);
    await expect(buildPeerJsHostId(testOnlineJoinCode)).resolves.toBe(peerId);
  });

  it('expands the six-character room code to the shared Android vector', async () => {
    expect(parseOnlineJoinCode(shortRoomCode)).toEqual({
      roomId: shortRoomCode,
      hostSessionId: 'ABC234ABC234ABC234ABC234AB',
      onlineJoinCode: derivedOnlineJoinCode,
    });
    await expect(buildPeerJsHostId(shortRoomCode)).resolves.toBe(derivedPeerId);
    await expect(buildPeerJsHostId(derivedOnlineJoinCode)).resolves.toBe(derivedPeerId);
  });

  it('normalizes separators in manually entered short codes', () => {
    expect(normalizeShortOnlineJoinCodeInput(' ab-c 23d ')).toBe('ABC23D');
  });

  it('rejects ambiguous short-code characters', () => {
    for (const code of ['ABC01D', 'ABCI2D', 'ABCO2D']) {
      expect(() => parseOnlineJoinCode(code)).toThrow();
    }
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