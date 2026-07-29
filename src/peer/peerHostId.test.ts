import { describe, expect, it } from 'vitest';
import { joinParameters, testOnlineJoinCode } from '../test/fixtures';
import { buildPeerJsHostId } from './peerHostId';

describe('buildPeerJsHostId', () => {
  it('matches the shared SHA-256 vector', async () => {
    await expect(buildPeerJsHostId(testOnlineJoinCode)).resolves.toBe('panstwa-miasta-room-v4-5965155548de8da8b74a1704f689c85e');
  });

  it('normalizes case and rejects malformed codes', async () => {
    await expect(buildPeerJsHostId(joinParameters.onlineJoinCode.toLowerCase()))
      .resolves.toBe('panstwa-miasta-room-v4-5965155548de8da8b74a1704f689c85e');
    await expect(buildPeerJsHostId('ABC123')).rejects.toThrow('nieobsługiwany format');
  });
});
