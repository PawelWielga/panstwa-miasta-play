export type ConnectionDiagnosticLevel = 'info' | 'warning' | 'error';
export type ConnectionDiagnosticValue = string | number | boolean | null;
export type ConnectionDiagnosticDetails = Readonly<Record<string, ConnectionDiagnosticValue>>;

export interface ConnectionDiagnosticEntry {
  id: number;
  timestamp: string;
  level: ConnectionDiagnosticLevel;
  event: string;
  details: ConnectionDiagnosticDetails;
}

const STORAGE_KEY = 'pm.connection-diagnostics.v1';
const MAX_ENTRIES = 80;
const sensitiveDetailKeys = new Set(['reconnecttoken', 'playername', 'answers', 'payload', 'data']);
const listeners = new Set<() => void>();
let nextId = 1;
let entries: readonly ConnectionDiagnosticEntry[] = readStoredEntries();

export function recordConnectionDiagnostic(
  event: string,
  level: ConnectionDiagnosticLevel = 'info',
  details: ConnectionDiagnosticDetails = {},
): void {
  const entry: ConnectionDiagnosticEntry = {
    id: nextId,
    timestamp: new Date().toISOString(),
    level,
    event,
    details: sanitizeDetails(details),
  };
  nextId += 1;
  entries = [...entries, entry].slice(-MAX_ENTRIES);
  persistEntries();
  writeToConsole(entry);
  listeners.forEach((listener) => listener());
}

export function getConnectionDiagnostics(): readonly ConnectionDiagnosticEntry[] {
  return entries;
}

export function subscribeConnectionDiagnostics(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearConnectionDiagnostics(): void {
  entries = [];
  nextId = 1;
  try {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Diagnostics must never affect the connection flow.
  }
  listeners.forEach((listener) => listener());
}

export function getConnectionRuntimeDetails(roomId?: string): ConnectionDiagnosticDetails {
  return {
    roomId: roomId ?? null,
    online: typeof navigator === 'undefined' ? null : navigator.onLine,
    secureContext: typeof window === 'undefined' ? null : window.isSecureContext,
    visibility: typeof document === 'undefined' ? null : document.visibilityState,
    origin: typeof window === 'undefined' ? null : window.location.origin,
    path: typeof window === 'undefined' ? null : window.location.pathname,
    userAgent: typeof navigator === 'undefined' ? null : navigator.userAgent,
    peerConnectionAvailable: typeof RTCPeerConnection !== 'undefined',
    webSocketAvailable: typeof WebSocket !== 'undefined',
  };
}

export function getDiagnosticErrorDetails(error: unknown): ConnectionDiagnosticDetails {
  const value = isRecord(error) ? error : null;
  const errorType = value && 'type' in value ? toDiagnosticValue(value.type) : null;
  const errorName = error instanceof Error ? error.name : null;
  const errorMessage = error instanceof Error ? error.message : String(error);
  return { errorType, errorName, errorMessage };
}

export function formatConnectionDiagnostics(
  diagnostics: readonly ConnectionDiagnosticEntry[] = entries,
): string {
  const runtime = getConnectionRuntimeDetails();
  const header = [
    'Państwa Miasta WWW - diagnostyka połączenia',
    `Wygenerowano: ${new Date().toISOString()}`,
    `Środowisko: ${formatDetails(runtime)}`,
    '',
  ];
  const lines = diagnostics.map((entry) =>
    `${entry.timestamp} [${entry.level.toUpperCase()}] ${entry.event}${formatEntryDetails(entry.details)}`,
  );
  return [...header, ...(lines.length > 0 ? lines : ['Brak zapisanych zdarzeń.'])].join('\n');
}

function readStoredEntries(): readonly ConnectionDiagnosticEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const restored = parsed.filter(isConnectionDiagnosticEntry).slice(-MAX_ENTRIES);
    nextId = Math.max(0, ...restored.map((entry) => entry.id)) + 1;
    return restored;
  } catch {
    return [];
  }
}

function persistEntries(): void {
  try {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Private mode or storage limits must not affect gameplay.
  }
}

function sanitizeDetails(details: ConnectionDiagnosticDetails): ConnectionDiagnosticDetails {
  return Object.fromEntries(
    Object.entries(details).filter(([key]) => !sensitiveDetailKeys.has(key.toLowerCase())),
  );
}

function writeToConsole(entry: ConnectionDiagnosticEntry): void {
  const label = `[PM connection] ${entry.event}`;
  if (entry.level === 'error') console.error(label, entry.details);
  else if (entry.level === 'warning') console.warn(label, entry.details);
  else console.info(label, entry.details);
}

function formatEntryDetails(details: ConnectionDiagnosticDetails): string {
  const formatted = formatDetails(details);
  return formatted ? ` | ${formatted}` : '';
}

function formatDetails(details: ConnectionDiagnosticDetails): string {
  return Object.entries(details)
    .map(([key, value]) => `${key}=${value === null ? 'null' : String(value)}`)
    .join(', ');
}

function isConnectionDiagnosticEntry(value: unknown): value is ConnectionDiagnosticEntry {
  if (!isRecord(value) || !isRecord(value.details)) return false;
  return typeof value.id === 'number'
    && typeof value.timestamp === 'string'
    && (value.level === 'info' || value.level === 'warning' || value.level === 'error')
    && typeof value.event === 'string'
    && Object.values(value.details).every(isDiagnosticValue);
}

function isDiagnosticValue(value: unknown): value is ConnectionDiagnosticValue {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function toDiagnosticValue(value: unknown): ConnectionDiagnosticValue {
  return isDiagnosticValue(value) ? value : typeof value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
