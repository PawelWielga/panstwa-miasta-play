import { describe, expect, it } from 'vitest';
import { SUPPORTED_GAME_PROTOCOL_VERSION } from '../../protocol/constants';
import {
  INCOMPATIBLE_GAME_VERSION_MESSAGE,
  normalizeRoomId,
  parseJoinParameters,
  validateJoinParameters,
} from './joinParams';

describe('join parameters', () => {
  it('accepts a room-only invitation and normalizes the room code', () => {
    expect(parseJoinParameters('?room=%20abc123%20').value).toEqual({ roomId: 'ABC123' });
  });

  it('does not require peer or protocol parameters', () => {
    const result = parseJoinParameters('?room=ABC123');
    expect(result.errors).toEqual({});
    expect(result.value).toEqual({ roomId: 'ABC123' });
  });

  it('ignores a legacy peer parameter', () => {
    expect(parseJoinParameters('?room=ABC123&peer=overridden-host').value).toEqual({ roomId: 'ABC123' });
  });

  it('accepts a compatible legacy protocol parameter', () => {
    const result = parseJoinParameters(`?room=ABC123&protocol=${String(SUPPORTED_GAME_PROTOCOL_VERSION)}`);
    expect(result.errors).toEqual({});
    expect(result.value).toEqual({ roomId: 'ABC123' });
  });

  it('rejects an incompatible legacy protocol parameter with a user-friendly message', () => {
    const result = parseJoinParameters('?room=ABC123&protocol=999');
    expect(result.value).toBeNull();
    expect(result.errors.protocol).toBe(INCOMPATIBLE_GAME_VERSION_MESSAGE);
  });

  it('normalizes case and surrounding whitespace', () => {
    expect(normalizeRoomId('  aBc123  ')).toBe('ABC123');
  });

  it('rejects an empty room code', () => {
    expect(() => normalizeRoomId('   ')).toThrow('Kod pokoju nie może być pusty.');
  });

  it('rejects unsupported characters', () => {
    expect(() => normalizeRoomId('ABC-23')).toThrow('Kod pokoju musi mieć dokładnie 6 liter lub cyfr.');
    expect(validateJoinParameters({ roomId: 'ABC-12' }).room).toBeTypeOf('string');
  });
});
