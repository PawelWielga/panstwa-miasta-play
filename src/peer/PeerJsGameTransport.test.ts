import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOST_VERSION_HANDSHAKE_TIMEOUT_MS, MIN_SUPPORTED_HOST_BUILD_NUMBER } from '../config/hostCompatibility';
import { clearConnectionDiagnostics, getConnectionDiagnostics } from '../diagnostics/connectionDiagnostics';
import { PEER_CONNECTION_LABEL, PEER_JS_ONLINE_PROTOCOL_VERSION } from '../protocol/constants';
import { connectionFailureCodes } from '../protocol/connectionFailure';
import { joinParameters } from '../test/fixtures';
import type { TransportCallbacks } from './transport';
import { buildPeerJsHostId, createPeerJsProof } from './onlineJoinCredentials';

type EventHandler = (value?: unknown) => void;
const peerMock = vi.hoisted(() => ({ peers: [] as MockPeerShape[], options: [] as unknown[] }));
interface MockConnectionShape {
  open: boolean;
  peer: string;
  connectionId: string;
  close: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  emit: (event: string, value?: unknown) => void;
}
interface MockPeerShape {
  destroyed: boolean;
  disconnected: boolean;
  connections: MockConnectionShape[];
  connect: ReturnType<typeof vi.fn>;
  reconnect: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  emit: (event: string, value?: unknown) => void;
}

vi.mock('peerjs', () => {
  class MockEmitter {
    private readonly handlers = new Map<string, EventHandler[]>();
    on(event: string, callback: EventHandler): this {
      const handlers = this.handlers.get(event) ?? [];
      handlers.push(callback);
      this.handlers.set(event, handlers);
      return this;
    }
    emit(event: string, value?: unknown): void { this.handlers.get(event)?.forEach((handler) => handler(value)); }
  }
  class MockConnection extends MockEmitter {
    open = false;
    peer: string;
    connectionId: string;
    close = vi.fn();
    send = vi.fn(() => Promise.resolve());
    constructor(peer: string, sequence: number) {
      super(); this.peer = peer; this.connectionId = `dc-${String(sequence)}`;
    }
  }
  return { default: class MockPeer extends MockEmitter {
    destroyed = false;
    disconnected = false;
    connections: MockConnection[] = [];
    connect = vi.fn((peerId: string) => {
      const connection = new MockConnection(peerId, this.connections.length + 1);
      this.connections.push(connection); return connection;
    });
    reconnect = vi.fn();
    destroy = vi.fn(() => { this.destroyed = true; });
    constructor(options?: unknown) { super(); peerMock.options.push(options); peerMock.peers.push(this); }
  } };
});

import {
  createPeerRtcConfiguration,
  mapPeerError,
  PEER_JS_STUN_SERVER_URL,
  PeerJsGameTransport,
} from './PeerJsGameTransport';
const callbacks = (): TransportCallbacks => ({ onState: vi.fn(), onMessage: vi.fn(), onError: vi.fn() });
const nonce = '00112233445566778899aabbccddeeff';

function getPeer(index = 0): MockPeerShape {
  const peerValue = peerMock.peers[index];
  if (!peerValue) throw new Error(`Missing peer ${String(index)}.`);
  return peerValue;
}

async function openTransport(transportCallbacks = callbacks()) {
  const transport = new PeerJsGameTransport();
  const connectPromise = transport.connect(joinParameters, transportCallbacks, { connectionAttemptId: 'attempt-v4' });
  await vi.waitFor(() => expect(peerMock.peers).toHaveLength(1));
  const peerValue = getPeer();
  peerValue.emit('open', 'client-peer');
  const connection = peerValue.connections[0];
  if (!connection) throw new Error('Missing connection.');
  connection.open = true;
  connection.emit('open');
  return { transport, transportCallbacks, connectPromise, peer: peerValue, connection };
}

async function emitValidChallenge(connection: MockConnectionShape, overrides: Record<string, unknown> = {}) {
  const peerId = await buildPeerJsHostId(joinParameters.onlineJoinCode);
  const hostProof = await createPeerJsProof('host', joinParameters, nonce, peerId);
  connection.emit('data', {
    type: 'bridge:challenge',
    appVersion: '1.1.7',
    buildNumber: MIN_SUPPORTED_HOST_BUILD_NUMBER,
    protocolVersion: PEER_JS_ONLINE_PROTOCOL_VERSION,
    hostSessionId: joinParameters.hostSessionId,
    nonce,
    peerId,
    hostProof,
    ...overrides,
  });
  await vi.waitFor(() => expect(connection.send).toHaveBeenCalledWith(expect.objectContaining({
    type: 'bridge:authenticate', hostSessionId: joinParameters.hostSessionId, nonce,
  })));
}

function emitReady(connection: MockConnectionShape): void {
  connection.emit('data', {
    type: 'bridge:ready', appVersion: '1.1.7', buildNumber: MIN_SUPPORTED_HOST_BUILD_NUMBER,
    protocolVersion: PEER_JS_ONLINE_PROTOCOL_VERSION, hostSessionId: joinParameters.hostSessionId,
  });
}

describe('PeerJsGameTransport authenticated contract', () => {
  beforeEach(() => {
    clearConnectionDiagnostics(); peerMock.peers.length = 0; peerMock.options.length = 0;
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('uses explicit STUN-only ICE without relay credentials', () => {
    const config = createPeerRtcConfiguration();

    expect(config.iceServers).toEqual([{ urls: PEER_JS_STUN_SERVER_URL }]);
    for (const server of config.iceServers ?? []) {
      const urls = typeof server.urls === 'string' ? [server.urls] : server.urls;
      expect(urls).toEqual([PEER_JS_STUN_SERVER_URL]);
      expect(urls.some((url) => /^turns?:/i.test(url))).toBe(false);
      expect('username' in server).toBe(false);
      expect('credential' in server).toBe(false);
    }
  });

  it('explains when a network blocks direct WebRTC', () => {
    expect(mapPeerError({ type: 'webrtc' })).toBe(connectionFailureCodes.p2pNetworkBlocked);
  });

  it('derives an unpredictable host id and opens only after mutual authentication', async () => {
    const result = await openTransport();
    expect(peerMock.options).toEqual([{ config: createPeerRtcConfiguration() }]);
    expect(result.peer.connect).toHaveBeenCalledWith('panstwa-miasta-room-v4-5965155548de8da8b74a1704f689c85e', {
      label: PEER_CONNECTION_LABEL, reliable: true, serialization: 'json',
      metadata: { hostSessionId: joinParameters.hostSessionId, protocol: PEER_JS_ONLINE_PROTOCOL_VERSION },
    });
    expect(result.transportCallbacks.onState).not.toHaveBeenCalledWith('open');
    await emitValidChallenge(result.connection);
    expect(result.transportCallbacks.onState).not.toHaveBeenCalledWith('open');
    emitReady(result.connection);
    await result.connectPromise;
    expect(result.transportCallbacks.onState).toHaveBeenCalledWith('open');
    expect(result.connection.send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'player:hello' }));
  });

  it('accepts bridge ready that arrives while host proof verification is still pending', async () => {
    const result = await openTransport();
    const peerId = await buildPeerJsHostId(joinParameters.onlineJoinCode);
    const hostProof = await createPeerJsProof('host', joinParameters, nonce, peerId);
    result.connection.emit('data', {
      type: 'bridge:challenge', appVersion: '1.1.7', buildNumber: 10,
      protocolVersion: 4, hostSessionId: joinParameters.hostSessionId, nonce, peerId, hostProof,
    });
    emitReady(result.connection);

    await result.connectPromise;
    expect(result.transportCallbacks.onState).toHaveBeenCalledWith('open');
    expect(result.connection.send).toHaveBeenCalledWith(expect.objectContaining({
      type: 'bridge:authenticate',
    }));
  });

  it('rejects an invalid host proof and never exposes open state', async () => {
    const result = await openTransport();
    const peerId = await buildPeerJsHostId(joinParameters.onlineJoinCode);
    result.connection.emit('data', {
      type: 'bridge:challenge', appVersion: '1.1.7', buildNumber: 10,
      protocolVersion: 4, hostSessionId: joinParameters.hostSessionId, nonce, peerId,
      hostProof: '0'.repeat(64),
    });
    await expect(result.connectPromise).rejects.toMatchObject({ code: 'peerjs-authentication-failed', reason: 'invalid-host-proof' });
    expect(result.transportCallbacks.onState).not.toHaveBeenCalledWith('open');
  });

  it('rejects a mismatched session before sending authentication', async () => {
    const result = await openTransport();
    const otherSession = 'BCDEFGHJKLMNPQRSTUVWXYZ234';
    const peerId = await buildPeerJsHostId(joinParameters.onlineJoinCode);
    const hostProof = await createPeerJsProof('host', joinParameters, nonce, peerId);
    result.connection.emit('data', {
      type: 'bridge:challenge', appVersion: '1.1.7', buildNumber: 10, protocolVersion: 4,
      hostSessionId: otherSession, nonce, peerId, hostProof,
    });
    await expect(result.connectPromise).rejects.toMatchObject({ reason: 'host-session-mismatch' });
    expect(result.connection.send).not.toHaveBeenCalled();
  });

  it('rejects replayed challenges', async () => {
    const result = await openTransport();
    const peerId = await buildPeerJsHostId(joinParameters.onlineJoinCode);
    const hostProof = await createPeerJsProof('host', joinParameters, nonce, peerId);
    const challenge = { type: 'bridge:challenge', appVersion: '1.1.7', buildNumber: 10,
      protocolVersion: 4, hostSessionId: joinParameters.hostSessionId, nonce, peerId, hostProof };
    result.connection.emit('data', challenge);
    result.connection.emit('data', challenge);
    await expect(result.connectPromise).rejects.toMatchObject({ reason: 'replayed-challenge' });
  });

  it('rejects game messages before authentication', async () => {
    const result = await openTransport();
    result.connection.emit('data', { type: 'game:snapshot' });
    await expect(result.connectPromise).rejects.toMatchObject({ reason: 'game-message-before-authentication' });
    expect(result.transportCallbacks.onMessage).not.toHaveBeenCalled();
  });

  it('times out an unfinished handshake and cleans resources', async () => {
    vi.useFakeTimers();
    const result = await openTransport();
    await vi.advanceTimersByTimeAsync(HOST_VERSION_HANDSHAKE_TIMEOUT_MS);
    await expect(result.connectPromise).rejects.toMatchObject({ reason: 'missing-challenge' });
    expect(result.connection.close).toHaveBeenCalled();
    expect(result.peer.destroy).toHaveBeenCalled();
  });

  it('deduplicates parallel connect calls and ignores signaling loss with an open data channel', async () => {
    const transport = new PeerJsGameTransport();
    const first = transport.connect(joinParameters, callbacks());
    const second = transport.connect(joinParameters, callbacks());
    expect(first).toBe(second);
    await vi.waitFor(() => expect(peerMock.peers).toHaveLength(1));
    const peerValue = getPeer(); peerValue.emit('open', 'client-peer');
    const connection = peerValue.connections[0];
    if (!connection) throw new Error('Missing connection.');
    connection.open = true; connection.emit('open');
    await emitValidChallenge(connection); emitReady(connection); await first;
    peerValue.disconnected = true; peerValue.emit('disconnected');
    expect(peerValue.reconnect).not.toHaveBeenCalled();
    expect(getConnectionDiagnostics().some((entry) => entry.event === 'peerjs.authentication.host-verified')).toBe(true);
  });
});
