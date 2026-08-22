import { PLAYER_ID_MAX_LENGTH, RECONNECT_TOKEN_MAX_LENGTH } from '../protocol/constants';
import { isBoundedString, isInteger, isRecord } from '../protocol/validation';
import { parseOnlineJoinCode, type PeerJsOnlineJoinCredentials } from '../peer/onlineJoinCredentials';

const KEY = 'panstwa-miasta.unfinished-sessions.v1';
const SCHEMA_VERSION = 1;
const FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;
export const unfinishedMultiplayerSessionMaxAgeMs = 24 * 60 * 60 * 1000;
export const unfinishedMultiplayerSessionMaxEntries = 8;

type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface UnfinishedMultiplayerSession {
  target: PeerJsOnlineJoinCredentials;
  playerId: string;
  reconnectToken: string;
  lastSeenSequenceNumber: number;
  lastUsedAt: number;
}

export function saveUnfinishedMultiplayerSession(
  session: UnfinishedMultiplayerSession,
  storage: SessionStorage | null = getLocalStorage(),
  now = Date.now(),
): boolean {
  if (!storage) return false;
  const normalized = normalizeSession(session);
  const key = normalized ? sessionKey(normalized) : null;
  if (!normalized || !key || isExpired(normalized, now)) return false;

  const sessions = readSessionMap(storage);
  removeExpired(sessions, now);
  sessions.set(key, mergeSessions(sessions.get(key), normalized));
  removeExpired(sessions, now);
  limitSessions(sessions);
  return writeSessionMap(storage, sessions);
}

export function readUnfinishedMultiplayerSessions(
  storage: SessionStorage | null = getLocalStorage(),
  now = Date.now(),
): UnfinishedMultiplayerSession[] {
  if (!storage) return [];
  const sessions = readSessionMap(storage);
  const previousSize = sessions.size;
  removeExpired(sessions, now);
  limitSessions(sessions);
  if (sessions.size !== previousSize) writeSessionMap(storage, sessions);
  return [...sessions.values()].sort(compareSessions);
}

export function readLatestUnfinishedMultiplayerSession(
  storage: SessionStorage | null = getLocalStorage(),
  now = Date.now(),
): UnfinishedMultiplayerSession | null {
  return readUnfinishedMultiplayerSessions(storage, now)[0] ?? null;
}

export function removeUnfinishedMultiplayerSession(
  target: PeerJsOnlineJoinCredentials,
  playerId: string,
  storage: SessionStorage | null = getLocalStorage(),
): void {
  if (!storage) return;
  const normalized = normalizeSession({
    target,
    playerId,
    reconnectToken: 'placeholder',
    lastSeenSequenceNumber: 0,
    lastUsedAt: 0,
  });
  const key = normalized ? sessionKey(normalized) : null;
  if (!key) return;
  const sessions = readSessionMap(storage);
  if (!sessions.delete(key)) return;
  writeSessionMap(storage, sessions);
}

export function clearUnfinishedMultiplayerSessions(storage: SessionStorage | null = getLocalStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(KEY);
  } catch { /* storage can be blocked in private/shared browser modes */ }
}

function readSessionMap(storage: SessionStorage): Map<string, UnfinishedMultiplayerSession> {
  let raw: string | null;
  try {
    raw = storage.getItem(KEY);
  } catch {
    return new Map();
  }
  if (!raw?.trim()) return new Map();

  try {
    const decoded: unknown = JSON.parse(raw);
    if (!isRecord(decoded) || decoded.version !== SCHEMA_VERSION || !isRecord(decoded.entries)) {
      removeDamagedStorage(storage);
      return new Map();
    }
    const sessions = new Map<string, UnfinishedMultiplayerSession>();
    for (const [storedKey, value] of Object.entries(decoded.entries)) {
      const session = decodeSession(value);
      const expectedKey = session ? sessionKey(session) : null;
      if (session && expectedKey === storedKey) sessions.set(storedKey, session);
    }
    return sessions;
  } catch {
    removeDamagedStorage(storage);
    return new Map();
  }
}

function writeSessionMap(storage: SessionStorage, sessions: Map<string, UnfinishedMultiplayerSession>): boolean {
  try {
    if (sessions.size === 0) {
      storage.removeItem(KEY);
      return true;
    }
    const entries: Record<string, unknown> = {};
    for (const [key, session] of sessions) entries[key] = encodeSession(session);
    storage.setItem(KEY, JSON.stringify({ version: SCHEMA_VERSION, entries }));
    return true;
  } catch {
    return false;
  }
}

function decodeSession(value: unknown): UnfinishedMultiplayerSession | null {
  if (!isRecord(value) || !isRecord(value.target)) return null;
  if (!isBoundedString(value.playerId, PLAYER_ID_MAX_LENGTH)) return null;
  if (!isBoundedString(value.reconnectToken, RECONNECT_TOKEN_MAX_LENGTH)) return null;
  if (!isInteger(value.lastSeenSequenceNumber) || value.lastSeenSequenceNumber < 0) return null;
  if (typeof value.lastUsedAt !== 'number' || !Number.isFinite(value.lastUsedAt)) return null;
  if (!isBoundedString(value.target.roomId, 128)) return null;
  if (!isBoundedString(value.target.hostSessionId, 128)) return null;
  if (!isBoundedString(value.target.joinCode, 512)) return null;

  try {
    const target = parseOnlineJoinCode(value.target.joinCode);
    if (target.roomId !== value.target.roomId.trim().toUpperCase()
      || target.hostSessionId !== value.target.hostSessionId.trim().toUpperCase()) return null;
    return normalizeSession({
      target,
      playerId: value.playerId,
      reconnectToken: value.reconnectToken,
      lastSeenSequenceNumber: value.lastSeenSequenceNumber,
      lastUsedAt: value.lastUsedAt,
    });
  } catch {
    return null;
  }
}

function encodeSession(session: UnfinishedMultiplayerSession): Record<string, unknown> {
  return {
    target: {
      roomId: session.target.roomId,
      hostSessionId: session.target.hostSessionId,
      joinCode: minimalJoinCode(session.target),
    },
    playerId: session.playerId,
    reconnectToken: session.reconnectToken,
    lastSeenSequenceNumber: session.lastSeenSequenceNumber,
    lastUsedAt: session.lastUsedAt,
  };
}

function minimalJoinCode(target: PeerJsOnlineJoinCredentials): string {
  try {
    const derived = parseOnlineJoinCode(target.roomId);
    const normalized = parseOnlineJoinCode(target.onlineJoinCode);
    if (derived.hostSessionId === normalized.hostSessionId
      && derived.onlineJoinCode === normalized.onlineJoinCode) return target.roomId;
  } catch { /* validated by normalizeSession; keep legacy code below */ }
  return target.onlineJoinCode;
}

function normalizeSession(session: UnfinishedMultiplayerSession): UnfinishedMultiplayerSession | null {
  if (!isBoundedString(session.playerId, PLAYER_ID_MAX_LENGTH)
    || !isBoundedString(session.reconnectToken, RECONNECT_TOKEN_MAX_LENGTH)
    || !Number.isInteger(session.lastSeenSequenceNumber)
    || session.lastSeenSequenceNumber < 0
    || !Number.isFinite(session.lastUsedAt)) return null;

  try {
    const target = parseOnlineJoinCode(session.target.onlineJoinCode);
    if (target.roomId !== session.target.roomId.trim().toUpperCase()
      || target.hostSessionId !== session.target.hostSessionId.trim().toUpperCase()) return null;
    return {
      target,
      playerId: session.playerId.trim(),
      reconnectToken: session.reconnectToken.trim(),
      lastSeenSequenceNumber: session.lastSeenSequenceNumber,
      lastUsedAt: session.lastUsedAt,
    };
  } catch {
    return null;
  }
}

function sessionKey(session: UnfinishedMultiplayerSession): string | null {
  const roomId = session.target.roomId.trim().toUpperCase();
  const hostSessionId = session.target.hostSessionId.trim().toUpperCase();
  const playerId = session.playerId.trim();
  if (!roomId || !hostSessionId || !playerId) return null;
  return `peerJs:${hostSessionId}:${roomId}:${playerId}`;
}

function mergeSessions(
  existing: UnfinishedMultiplayerSession | undefined,
  incoming: UnfinishedMultiplayerSession,
): UnfinishedMultiplayerSession {
  if (!existing) return incoming;
  const newest = incoming.lastUsedAt > existing.lastUsedAt ? incoming : existing;
  return {
    ...newest,
    reconnectToken: existing.reconnectToken,
    lastSeenSequenceNumber: Math.max(existing.lastSeenSequenceNumber, incoming.lastSeenSequenceNumber),
    lastUsedAt: Math.max(existing.lastUsedAt, incoming.lastUsedAt),
  };
}

function removeExpired(sessions: Map<string, UnfinishedMultiplayerSession>, now: number): void {
  for (const [key, session] of sessions) {
    if (isExpired(session, now)) sessions.delete(key);
  }
}

function isExpired(session: UnfinishedMultiplayerSession, now: number): boolean {
  return session.lastUsedAt > now + FUTURE_CLOCK_SKEW_MS
    || now - session.lastUsedAt > unfinishedMultiplayerSessionMaxAgeMs;
}

function limitSessions(sessions: Map<string, UnfinishedMultiplayerSession>): void {
  if (sessions.size <= unfinishedMultiplayerSessionMaxEntries) return;
  const retained = [...sessions.entries()]
    .sort((left, right) => compareSessions(left[1], right[1]) || left[0].localeCompare(right[0]))
    .slice(0, unfinishedMultiplayerSessionMaxEntries);
  sessions.clear();
  for (const [key, session] of retained) sessions.set(key, session);
}

function compareSessions(left: UnfinishedMultiplayerSession, right: UnfinishedMultiplayerSession): number {
  return right.lastUsedAt - left.lastUsedAt;
}

function removeDamagedStorage(storage: SessionStorage): void {
  try {
    storage.removeItem(KEY);
  } catch { /* ignore unavailable storage */ }
}

function getLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export const unfinishedMultiplayerSessionStorageKey = KEY;
