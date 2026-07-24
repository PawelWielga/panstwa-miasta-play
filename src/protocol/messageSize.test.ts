import { describe, expect, it } from 'vitest';
import { isMessageWithinLimit } from './messageSize';
it('uses UTF-8 byte size and rejects messages above 64 KiB', () => {
  expect(isMessageWithinLimit({ type: 'x', value: 'ą' })).toBe(true);
  expect(isMessageWithinLimit({ type: 'x', value: 'a'.repeat(70_000) })).toBe(false);
});
