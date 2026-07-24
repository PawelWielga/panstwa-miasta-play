import { describe, expect, it } from 'vitest';
import { parseJoinParameters } from './joinParams';

describe('parseJoinParameters', () => {
  it('parses a valid invitation', () => {
    expect(parseJoinParameters('?room=abc234&peer=host-peer&protocol=3').value).toEqual({ roomId: 'ABC234', hostPeerId: 'host-peer', protocolVersion: 3 });
  });
  it('reports missing and malformed values', () => {
    const result = parseJoinParameters('?room=O0I111&peer=bad%20peer&protocol=x');
    expect(result.value).toBeNull();
    expect(typeof result.errors.room).toBe('string');
    expect(typeof result.errors.peer).toBe('string');
    expect(typeof result.errors.protocol).toBe('string');
  });
});
