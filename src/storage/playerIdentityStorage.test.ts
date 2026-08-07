import { describe, expect, it, vi } from 'vitest';
import { createPlayerIdentity, loadPlayerIdentity, playerIdentityStorageKey, savePlayerIdentity } from './playerIdentityStorage';

describe('player identity storage', () => {
  it('stores public profile and private reconnect identity separately', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce('11111111-1111-4111-8111-111111111111').mockReturnValueOnce('22222222-2222-4222-8222-222222222222');
    const identity = createPlayerIdentity({ playerName: 'Ala' });
    expect(identity.playerId).not.toBe(identity.reconnectToken);
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) };
    savePlayerIdentity(identity, storage);
    expect(loadPlayerIdentity(storage)).toEqual(identity);
    const storedValue = data.get(playerIdentityStorageKey);
    expect(storedValue).toBeDefined();
    expect(JSON.parse(storedValue ?? '{}')).not.toHaveProperty('profile');
  });

  it('falls back to an ephemeral identity when storage is unavailable', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce('33333333-3333-4333-8333-333333333333').mockReturnValueOnce('44444444-4444-4444-8444-444444444444');
    const identity = loadPlayerIdentity(null);
    expect(identity.playerId).toBe('p33333333333343338333333333333333');
    expect(identity.reconnectToken).toBe('r44444444444444448444444444444444');
  });

  it('does not fail when browser storage rejects writes', () => {
    const identity = createPlayerIdentity({ playerName: 'Ala' });
    const storage = { setItem: () => { throw new DOMException('Blocked', 'SecurityError'); } };
    expect(() => savePlayerIdentity(identity, storage)).not.toThrow();
  });
});
