import { describe, expect, it } from 'vitest';
import { PEER_JS_ONLINE_PROTOCOL_VERSION } from '../../protocol/constants';
import { joinParameters, testOnlineJoinCode } from '../../test/fixtures';
import {
  INCOMPATIBLE_GAME_VERSION_MESSAGE,
  normalizeOnlineJoinCode,
  parseJoinParameters,
  parseOnlineJoinCode,
  sanitizedJoinInvitationPath,
  validateOnlineJoinCode,
} from './joinParams';

describe('join parameters', () => {
  it('parses a versioned online invitation', () => {
    expect(parseJoinParameters(`?code=${testOnlineJoinCode}&protocol=${String(PEER_JS_ONLINE_PROTOCOL_VERSION)}`).value)
      .toEqual(joinParameters);
  });

  it('normalizes case and surrounding whitespace', () => {
    expect(normalizeOnlineJoinCode(`  ${testOnlineJoinCode.toLowerCase()}  `)).toBe(testOnlineJoinCode);
    expect(parseOnlineJoinCode(testOnlineJoinCode.toLowerCase())).toEqual(joinParameters);
  });

  it('rejects a legacy room-only invitation without downgrade', () => {
    const result = parseJoinParameters('?room=ABC123&protocol=3');
    expect(result.value).toBeNull();
    expect(result.errors.protocol).toBe(INCOMPATIBLE_GAME_VERSION_MESSAGE);
  });

  it('rejects an incompatible online protocol', () => {
    const result = parseJoinParameters(`?code=${testOnlineJoinCode}&protocol=999`);
    expect(result.value).toBeNull();
    expect(result.errors.protocol).toBe(INCOMPATIBLE_GAME_VERSION_MESSAGE);
  });



  it('rejects duplicate invitation parameters', () => {
    const duplicateCode = parseJoinParameters(
      `?code=${testOnlineJoinCode}&code=${testOnlineJoinCode}&protocol=4`,
    );
    expect(duplicateCode.value).toBeNull();
    expect(duplicateCode.errors.code).toContain('więcej niż jeden');

    const duplicateProtocol = parseJoinParameters(
      `?code=${testOnlineJoinCode}&protocol=4&protocol=4`,
    );
    expect(duplicateProtocol.value).toBeNull();
    expect(duplicateProtocol.errors.protocol).toBe(INCOMPATIBLE_GAME_VERSION_MESSAGE);
  });

  it('removes invitation secrets while preserving unrelated URL state', () => {
    expect(sanitizedJoinInvitationPath(
      `https://gra.dihor.pl/play?lang=pl&code=${testOnlineJoinCode}&protocol=4&peer=legacy#lobby`,
    )).toBe('/play?lang=pl#lobby');
  });

  it('rejects malformed and truncated secrets', () => {
    expect(validateOnlineJoinCode('').code).toBeTypeOf('string');
    expect(validateOnlineJoinCode('PM4-ABC123-TOO-SHORT').code).toBeTypeOf('string');
    expect(() => parseOnlineJoinCode('PM4-ABC123-ABCDEFGHJKLMNPQRSTUVWXYZ23-INVALID-O')).toThrow();
  });
});
