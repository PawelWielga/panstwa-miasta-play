import { describe, expect, it } from 'vitest';
import {
  createSessionTabLease,
  sessionTabLeaseStorageKey,
} from './sessionTabLease';

const scope = {
  roomId: 'ABC123',
  hostSessionId: 'SESSION123',
  playerId: 'player-1',
};

describe('session tab lease', () => {
  it('allows only one live owner for the same player session', () => {
    const storage = new MemoryStorage();
    let now = 1_000;
    const first = createSessionTabLease(scope, {
      storage,
      ownerId: 'tab-a',
      now: () => now,
      durationMs: 1_000,
    });
    const second = createSessionTabLease(scope, {
      storage,
      ownerId: 'tab-b',
      now: () => now,
      durationMs: 1_000,
    });

    expect(first.acquire()).toBe(true);
    expect(second.acquire()).toBe(false);

    now = 2_001;
    expect(second.acquire()).toBe(true);
    expect(first.renew()).toBe(false);
  });

  it('does not let a stale owner release a newer lease', () => {
    const storage = new MemoryStorage();
    let now = 1_000;
    const first = createSessionTabLease(scope, {
      storage,
      ownerId: 'tab-a',
      now: () => now,
      durationMs: 1_000,
    });
    const second = createSessionTabLease(scope, {
      storage,
      ownerId: 'tab-b',
      now: () => now,
      durationMs: 1_000,
    });

    expect(first.acquire()).toBe(true);
    now = 2_001;
    expect(second.acquire()).toBe(true);

    first.release();

    expect(second.isOwner()).toBe(true);
  });

  it('separates leases for different sessions', () => {
    const storage = new MemoryStorage();
    const first = createSessionTabLease(scope, { storage, ownerId: 'tab-a' });
    const second = createSessionTabLease(
      { ...scope, hostSessionId: 'SESSION456' },
      { storage, ownerId: 'tab-b' },
    );

    expect(first.acquire()).toBe(true);
    expect(second.acquire()).toBe(true);
    expect(first.storageKey).not.toBe(second.storageKey);
  });

  it('keeps joining available when browser storage is unavailable', () => {
    const unavailableStorage = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    };

    const lease = createSessionTabLease(scope, {
      storage: unavailableStorage,
      ownerId: 'tab-a',
    });

    expect(lease.acquire()).toBe(true);
    expect(lease.renew()).toBe(true);
    expect(lease.isOwner()).toBe(true);
    expect(() => lease.release()).not.toThrow();
  });

  it('uses the exact session and player in the storage key', () => {
    expect(sessionTabLeaseStorageKey(scope)).toBe(
      'panstwa-miasta.session-tab-lease.v1:SESSION123:ABC123:player-1',
    );
  });
});

class MemoryStorage {
  private readonly entries = new Map<string, string>();

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }
}
