import { expect, it } from 'vitest';
import { canAutoReconnect, reconnectDelay } from './reconnectPolicy';
it('uses bounded exponential delays', () => {
  expect([0, 1, 2, 3, 10].map(reconnectDelay)).toEqual([500, 1000, 2000, 3000, 3500]);
  expect(canAutoReconnect(1_000, 10_999)).toBe(true);
  expect(canAutoReconnect(1_000, 11_000)).toBe(false);
});
