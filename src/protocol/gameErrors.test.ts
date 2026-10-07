import { describe, expect, it } from 'vitest';
import { isTerminalJoinError } from './gameErrors';
import { parseHostMessage } from './parser';

describe('terminal join errors', () => {
  it.each(['pl', 'en'] as const)('preserves the %s room language and stops reconnect on mismatch', (gameLanguageCode) => {
    const result = parseHostMessage({ type: 'game:error', code: 'language_mismatch', message: 'Host text', gameLanguageCode });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.message).toMatchObject({ gameLanguageCode });
    expect(isTerminalJoinError(result.message)).toBe(true);
  });

  it('treats rejected reconnect credentials as terminal', () => {
    const result = parseHostMessage({
      type: 'game:error',
      code: 'invalid_reconnect_credential',
      message: 'Host text',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(isTerminalJoinError(result.message)).toBe(true);
  });
});
