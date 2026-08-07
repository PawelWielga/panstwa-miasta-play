import { describe, expect, it } from 'vitest';
import { parseOnlineJoinCode } from '../peer/onlineJoinCredentials';
import {
  readLatestUnfinishedMultiplayerSession,
  readUnfinishedMultiplayerSessions,
  saveUnfinishedMultiplayerSession,
  unfinishedMultiplayerSessionMaxAgeMs,
  unfinishedMultiplayerSessionMaxEntries,
  unfinishedMultiplayerSessionStorageKey,
  type UnfinishedMultiplayerSession,
} from './unfinishedMultiplayerSessionStorage';

class MemoryStorage {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}

function createSession(
  code: string,
  lastUsedAt: number,
  overrides: Partial<Omit<UnfinishedMultiplayerSession, 'target' | 'lastUsedAt'>> = {},
): UnfinishedMultiplayerSession {
  return {
    target: parseOnlineJoinCode(code),
    playerId: 'p-player',
    reconnectToken: 'r-original',
    lastSeenSequenceNumber: 12,
    lastUsedAt,
    ...overrides,
  };
}

describe('unfinished multiplayer session storage', () => {
  it('persists a versioned PeerJS resume record and restores full credentials', () => {
    const storage = new MemoryStorage();
    const now = Date.UTC(2026, 7, 7, 20, 0, 0);
    const session = createSession('ABC234', now);

    expect(saveUnfinishedMultiplayerSession(session, storage, now)).toBe(true);
    expect(readLatestUnfinishedMultiplayerSession(storage, now)).toEqual(session);

    const raw = storage.getItem(unfinishedMultiplayerSessionStorageKey) ?? '';
    expect(JSON.parse(raw)).toMatchObject({ version: 1 });
    expect(raw).toContain('ABC234');
    expect(raw).not.toContain('PM4-');
  });

  it('keeps the original reconnect token and the highest sequence for the same host slot', () => {
    const storage = new MemoryStorage();
    const now = Date.UTC(2026, 7, 7, 20, 0, 0);
    expect(saveUnfinishedMultiplayerSession(createSession('ABC234', now), storage, now)).toBe(true);
    expect(saveUnfinishedMultiplayerSession(createSession('ABC234', now + 1_000, {
      reconnectToken: 'r-replaced',
      lastSeenSequenceNumber: 5,
    }), storage, now + 1_000)).toBe(true);

    const restored = readLatestUnfinishedMultiplayerSession(storage, now + 1_000);
    expect(restored?.reconnectToken).toBe('r-original');
    expect(restored?.lastSeenSequenceNumber).toBe(12);
    expect(restored?.lastUsedAt).toBe(now + 1_000);
  });

  it('removes records older than 24 hours and rejects excessive future clock skew', () => {
    const storage = new MemoryStorage();
    const now = Date.UTC(2026, 7, 7, 20, 0, 0);
    expect(saveUnfinishedMultiplayerSession(createSession('ABC234', now), storage, now)).toBe(true);
    expect(readUnfinishedMultiplayerSessions(storage, now + unfinishedMultiplayerSessionMaxAgeMs + 1)).toEqual([]);
    expect(storage.getItem(unfinishedMultiplayerSessionStorageKey)).toBeNull();

    const future = createSession('ABC235', now + 5 * 60 * 1_000 + 1);
    expect(saveUnfinishedMultiplayerSession(future, storage, now)).toBe(false);
  });

  it('retains only the newest eight sessions', () => {
    const storage = new MemoryStorage();
    const now = Date.UTC(2026, 7, 7, 20, 0, 0);
    for (let index = 0; index < unfinishedMultiplayerSessionMaxEntries + 1; index += 1) {
      const code = `AB${String(2300 + index)}`;
      expect(saveUnfinishedMultiplayerSession(createSession(code, now + index), storage, now + index)).toBe(true);
    }

    const sessions = readUnfinishedMultiplayerSessions(storage, now + unfinishedMultiplayerSessionMaxEntries);
    expect(sessions).toHaveLength(unfinishedMultiplayerSessionMaxEntries);
    expect(sessions.map((session) => session.target.roomId)).not.toContain('AB2300');
  });

  it('falls back safely when storage is unavailable or rejects writes', () => {
    const now = Date.UTC(2026, 7, 7, 20, 0, 0);
    const session = createSession('ABC234', now);
    expect(saveUnfinishedMultiplayerSession(session, null, now)).toBe(false);
    expect(readUnfinishedMultiplayerSessions(null, now)).toEqual([]);

    const blocked = {
      getItem: () => null,
      setItem: () => { throw new DOMException('Blocked', 'SecurityError'); },
      removeItem: () => undefined,
    };
    expect(saveUnfinishedMultiplayerSession(session, blocked, now)).toBe(false);
  });

  it('rejects a target whose host session does not match its join code', () => {
    const storage = new MemoryStorage();
    const now = Date.UTC(2026, 7, 7, 20, 0, 0);
    const session = createSession('ABC234', now);
    const invalid = {
      ...session,
      target: { ...session.target, hostSessionId: 'WRONG' },
    };
    expect(saveUnfinishedMultiplayerSession(invalid, storage, now)).toBe(false);
    expect(readUnfinishedMultiplayerSessions(storage, now)).toEqual([]);
  });
});
