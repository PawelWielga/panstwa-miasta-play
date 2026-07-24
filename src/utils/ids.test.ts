import { expect, it, vi } from 'vitest';
import { generateRequestId } from './ids';
it('generates a new request id for every mutation', () => {
  vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce('11111111-1111-4111-8111-111111111111').mockReturnValueOnce('22222222-2222-4222-8222-222222222222');
  expect(generateRequestId()).not.toBe(generateRequestId());
});
