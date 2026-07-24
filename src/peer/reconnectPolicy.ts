import { AUTO_RECONNECT_WINDOW_MS } from '../protocol/constants';
const delays = [500, 1_000, 2_000, 3_000, 3_500] as const;
export function reconnectDelay(attempt: number): number {
  const index = Math.min(Math.max(attempt, 0), delays.length - 1);
  return delays[index] ?? 3_500;
}
export function canAutoReconnect(startedAt: number, now: number): boolean { return now - startedAt < AUTO_RECONNECT_WINDOW_MS; }
