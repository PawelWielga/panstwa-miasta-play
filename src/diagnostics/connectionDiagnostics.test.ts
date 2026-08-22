import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearConnectionDiagnostics,
  formatConnectionDiagnostics,
  getConnectionDiagnostics,
  getDiagnosticErrorDetails,
  recordConnectionDiagnostic,
} from './connectionDiagnostics';

describe('connectionDiagnostics', () => {
  beforeEach(() => {
    clearConnectionDiagnostics();
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('keeps structured events and removes sensitive details', () => {
    recordConnectionDiagnostic('connection.failed', 'error', {
      roomId: 'ABC123',
      hostSessionId: 'session-secret',
      peerId: 'peer-secret',
      connectionId: 'connection-secret',
      errorType: 'peer-unavailable',
      reconnectToken: 'secret',
      playerName: 'Ala',
      answers: 'hidden',
      onlineJoinCode: 'PM4-ABC123-secret',
      hostProof: 'host-secret',
      clientProof: 'client-secret',
      nonce: 'nonce-secret',
    });

    expect(getConnectionDiagnostics()).toEqual([
      expect.objectContaining({
        level: 'error',
        event: 'connection.failed',
        details: { errorType: 'peer-unavailable' },
      }),
    ]);
  });

  it('does not expose raw exception messages in diagnostic details', () => {
    expect(getDiagnosticErrorDetails(new Error('PM4-SECRET reconnect-token'))).toEqual({
      errorType: null,
      errorCode: null,
      errorName: 'Error',
    });
  });

  it('formats diagnostics as copyable plain text', () => {
    recordConnectionDiagnostic('reconnect.scheduled', 'warning', { attempt: 2, delayMs: 1_000 });

    const text = formatConnectionDiagnostics();

    expect(text).toContain('Państwa Miasta WWW - diagnostyka połączenia');
    expect(text).toContain('[WARNING] reconnect.scheduled');
    expect(text).toContain('attempt=2');
  });

  it('keeps only the latest 80 entries', () => {
    for (let index = 0; index < 85; index += 1) {
      recordConnectionDiagnostic(`event.${String(index)}`);
    }

    expect(getConnectionDiagnostics()).toHaveLength(80);
    expect(getConnectionDiagnostics()[0]?.event).toBe('event.5');
  });
});
