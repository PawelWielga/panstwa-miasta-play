import { describe, expect, it } from 'vitest';
import { buildPeerJsHostId } from './peerHostId';

describe('buildPeerJsHostId', () => {
  it('builds the exact Flutter-compatible host identifier', () => {
    expect(buildPeerJsHostId('ABC123')).toBe('panstwa-miasta-room-v3-abc123');
  });

  it('trims whitespace and ignores letter case', () => {
    expect(buildPeerJsHostId('  aBc123  ')).toBe('panstwa-miasta-room-v3-abc123');
  });

  it('rejects empty and unsupported room identifiers', () => {
    expect(() => buildPeerJsHostId('')).toThrow('Kod pokoju nie może być pusty.');
    expect(() => buildPeerJsHostId('ABC-123')).toThrow('Kod pokoju zawiera nieobsługiwane znaki.');
  });
});
