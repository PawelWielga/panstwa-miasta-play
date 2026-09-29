const KEY_PREFIX = 'panstwa-miasta.session-tab-lease.v1:';

export const sessionTabLeaseDurationMs = 8_000;
export const sessionTabLeaseHeartbeatMs = 2_000;

type LeaseStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface SessionTabLeaseScope {
  roomId: string;
  hostSessionId: string;
  playerId: string;
}

export interface SessionTabLease {
  readonly storageKey: string;
  acquire: () => boolean;
  renew: () => boolean;
  release: () => void;
  isOwner: () => boolean;
}

interface SessionTabLeaseOptions {
  storage?: LeaseStorage | null;
  ownerId?: string;
  durationMs?: number;
  now?: () => number;
}

interface StoredLease {
  ownerId: string;
  expiresAt: number;
}

export function createSessionTabLease(
  scope: SessionTabLeaseScope,
  options: SessionTabLeaseOptions = {},
): SessionTabLease {
  const storage = options.storage === undefined ? getLocalStorage() : options.storage;
  const ownerId = options.ownerId ?? `tab-${crypto.randomUUID()}`;
  const durationMs = options.durationMs ?? sessionTabLeaseDurationMs;
  const now = options.now ?? Date.now;
  const storageKey = sessionTabLeaseStorageKey(scope);

  const claim = (): boolean => {
    if (!storage) return true;
    const timestamp = now();
    const current = readLease(storage, storageKey);
    if (!current.available) return true;
    if (current.lease
      && current.lease.ownerId !== ownerId
      && current.lease.expiresAt > timestamp) return false;

    try {
      storage.setItem(storageKey, JSON.stringify({
        ownerId,
        expiresAt: timestamp + durationMs,
      } satisfies StoredLease));
    } catch {
      return true;
    }

    const verified = readLease(storage, storageKey);
    return !verified.available || verified.lease?.ownerId === ownerId;
  };

  return {
    storageKey,
    acquire: claim,
    renew: claim,
    release: () => {
      if (!storage) return;
      const current = readLease(storage, storageKey);
      if (!current.available || current.lease?.ownerId !== ownerId) return;
      try {
        storage.removeItem(storageKey);
      } catch {
        // Storage can become unavailable while the page is alive.
      }
    },
    isOwner: () => {
      if (!storage) return true;
      const current = readLease(storage, storageKey);
      if (!current.available) return true;
      return current.lease?.ownerId === ownerId && current.lease.expiresAt > now();
    },
  };
}

export function sessionTabLeaseStorageKey(scope: SessionTabLeaseScope): string {
  const values = [scope.hostSessionId, scope.roomId, scope.playerId]
    .map((value) => encodeURIComponent(value.trim()));
  return `${KEY_PREFIX}${values.join(':')}`;
}

function readLease(
  storage: LeaseStorage,
  storageKey: string,
): { available: boolean; lease: StoredLease | null } {
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return { available: true, lease: null };
    const value: unknown = JSON.parse(raw);
    if (!isStoredLease(value)) return { available: true, lease: null };
    return { available: true, lease: value };
  } catch {
    return { available: false, lease: null };
  }
}

function isStoredLease(value: unknown): value is StoredLease {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<StoredLease>;
  return typeof candidate.ownerId === 'string'
    && candidate.ownerId.length > 0
    && typeof candidate.expiresAt === 'number'
    && Number.isFinite(candidate.expiresAt);
}

function getLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}
