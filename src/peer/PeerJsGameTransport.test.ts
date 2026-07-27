import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEGACY_BRIDGE_READY_GRACE_MS, SUPPORTED_GAME_PROTOCOL_VERSION } from '../protocol/constants';
import { clearConnectionDiagnostics, getConnectionDiagnostics } from '../diagnostics/connectionDiagnostics';
import type { TransportCallbacks } from './transport';

type EventHandler = (value?: unknown) => void;

const peerMock = vi.hoisted(() => ({
  peers: [] as Array<{
    destroyed: boolean;
    connections: Array<{
      open: boolean;
      peer: string;
      connectionId: string;
      close: ReturnType<typeof vi.fn>;
      send: ReturnType<typeof vi.fn>;
      emit: (event: string, value?: unknown) => void;
    }>;
    connect: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    emit: (event: string, value?: unknown) => void;
  }>,
}));

vi.mock('peerjs', () => {
  class MockEmitter {
    private readonly handlers = new Map<string, EventHandler[]>();

    on(event: string, callback: EventHandler): this {
      const handlers = this.handlers.get(event) ?? [];
      handlers.push(callback);
      this.handlers.set(event, handlers);
      return this;
    }

    emit(event: string, value?: unknown): void {
      this.handlers.get(event)?.forEach((handler) => handler(value));
    }
  }

  class MockConnection extends MockEmitter {
    open = false;
    peer: string;
    connectionId: string;
    close = vi.fn();
    send = vi.fn();

    constructor(peer: string, sequence: number) {
      super();
      this.peer = peer;
      this.connectionId = `dc-${String(sequence)}`;
    }
  }

  return {
    default: class MockPeer extends MockEmitter {
      destroyed = false;
      disconnected = false;
      connections: MockConnection[] = [];
      connect = vi.fn((peerId: string) => {
        const connection = new MockConnection(peerId, this.connections.length + 1);
        this.connections.push(connection);
        return connection;
      });
      reconnect = vi.fn();
      destroy = vi.fn(() => { this.destroyed = true; });

      constructor() {
        super();
        peerMock.peers.push(this);
      }
    },
  };
});

import { createPeerRtcConfiguration, mapPeerError, PeerJsGameTransport } from './PeerJsGameTransport';

const callbacks = (): TransportCallbacks => ({
  onState: vi.fn(),
  onMessage: vi.fn(),
  onError: vi.fn(),
});

function getPeer(index: number) {
  const peer = peerMock.peers[index];
  if (!peer) throw new Error(`Missing peer at index ${String(index)}.`);
  return peer;
}

function openPeer(index = 0, clientPeerId?: string) {
  const peer = getPeer(index);
  peer.emit('open', clientPeerId ?? `client-peer-${String(index + 1)}`);
  return peer;
}

function openConnection(peerIndex = 0, connectionIndex = 0) {
  const connection = getPeer(peerIndex).connections[connectionIndex];
  if (!connection) throw new Error(`Missing connection at index ${String(connectionIndex)}.`);
  connection.open = true;
  connection.emit('open');
  return connection;
}

function markBridgeReady(peerIndex = 0, connectionIndex = 0) {
  const connection = getPeer(peerIndex).connections[connectionIndex];
  if (!connection) throw new Error(`Missing connection at index ${String(connectionIndex)}.`);
  connection.emit('data', { type: 'bridge:ready' });
  return connection;
}

describe('PeerJsGameTransport', () => {
  beforeEach(() => {
    clearConnectionDiagnostics();
    peerMock.peers.length = 0;
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });


  it('configures TURN relay fallbacks in addition to STUN', () => {
    const configuration = createPeerRtcConfiguration();

    expect(configuration.sdpSemantics).toBe('unified-plan');
    expect(configuration.iceServers).toEqual([
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: [
          'turn:eu-0.turn.peerjs.com:3478',
          'turn:us-0.turn.peerjs.com:3478',
        ],
        username: 'peerjs',
        credential: 'peerjsp',
      },
    ]);
  });

  it('connects to the host derived only from the room code', async () => {
    const transport = new PeerJsGameTransport();
    const connectPromise = transport.connect(
      { roomId: 'ABC123' },
      callbacks(),
      { connectionAttemptId: 'attempt-1' },
    );

    const peer = openPeer();
    openConnection();
    markBridgeReady();
    await connectPromise;

    expect(peer.connect).toHaveBeenCalledWith('panstwa-miasta-room-v3-abc123', {
      label: 'panstwa-miasta-game-v1',
      reliable: true,
      serialization: 'json',
      metadata: {
        room: 'ABC123',
        protocol: SUPPORTED_GAME_PROTOCOL_VERSION,
      },
    });
    const openDiagnostic = getConnectionDiagnostics().find((entry) => entry.event === 'data-connection.open');
    expect(openDiagnostic?.details.connectionAttemptId).toBe('attempt-1');
  });

  it('waits for the host bridge readiness signal before exposing open state', async () => {
    const transport = new PeerJsGameTransport();
    const transportCallbacks = callbacks();
    const connectPromise = transport.connect(
      { roomId: 'ABC123' },
      transportCallbacks,
      { connectionAttemptId: 'attempt-ready' },
    );

    openPeer();
    const connection = openConnection();
    await Promise.resolve();

    expect(transportCallbacks.onState).toHaveBeenCalledWith('connecting');
    expect(transportCallbacks.onState).not.toHaveBeenCalledWith('open');

    connection.emit('data', { type: 'bridge:ready' });
    await connectPromise;

    expect(transportCallbacks.onState).toHaveBeenCalledWith('open');
    expect(transportCallbacks.onMessage).not.toHaveBeenCalled();
    expect(
      getConnectionDiagnostics().some((entry) => entry.event === 'peerjs.bridge-ready.received'),
    ).toBe(true);
  });

  it('falls back after a short grace period for legacy hosts without bridge readiness', async () => {
    vi.useFakeTimers();
    const transport = new PeerJsGameTransport();
    const transportCallbacks = callbacks();
    const connectPromise = transport.connect(
      { roomId: 'ABC123' },
      transportCallbacks,
      { connectionAttemptId: 'attempt-legacy' },
    );

    openPeer();
    const connection = openConnection();
    await vi.advanceTimersByTimeAsync(LEGACY_BRIDGE_READY_GRACE_MS - 1);

    expect(transportCallbacks.onState).not.toHaveBeenCalledWith('open');

    await vi.advanceTimersByTimeAsync(1);
    await connectPromise;

    expect(transportCallbacks.onState).toHaveBeenCalledWith('open');
    expect(
      getConnectionDiagnostics().some((entry) => entry.event === 'peerjs.bridge-ready.fallback'),
    ).toBe(true);

    connection.emit('data', { type: 'bridge:ready' });
    expect(transportCallbacks.onMessage).not.toHaveBeenCalled();
    expect(transportCallbacks.onError).not.toHaveBeenCalled();
  });

  it('cancels the legacy fallback after receiving bridge readiness', async () => {
    vi.useFakeTimers();
    const transport = new PeerJsGameTransport();
    const connectPromise = transport.connect(
      { roomId: 'ABC123' },
      callbacks(),
      { connectionAttemptId: 'attempt-current-host' },
    );

    openPeer();
    openConnection();
    markBridgeReady();
    await connectPromise;
    await vi.advanceTimersByTimeAsync(LEGACY_BRIDGE_READY_GRACE_MS);

    expect(
      getConnectionDiagnostics().some((entry) => entry.event === 'peerjs.bridge-ready.fallback'),
    ).toBe(false);
  });

  it('maps connection timeout to host availability guidance', () => {
    expect(mapPeerError(new Error('timeout'))).toBe(
      'Telefon prowadzącego nie odpowiedział na czas. Sprawdź, czy aplikacja prowadzącego nadal działa, i spróbuj ponownie.',
    );
  });

  it('deduplicates parallel connect calls on the same transport', async () => {
    const transport = new PeerJsGameTransport();
    const first = transport.connect({ roomId: 'ABC123' }, callbacks());
    const second = transport.connect({ roomId: 'ABC123' }, callbacks());

    expect(first).toBe(second);
    expect(peerMock.peers).toHaveLength(1);

    const peer = openPeer();
    openConnection();
    markBridgeReady();
    await Promise.all([first, second]);

    expect(peer.connect).toHaveBeenCalledTimes(1);
  });

  it('cancels the pending timeout and destroys the peer during cleanup', async () => {
    vi.useFakeTimers();
    const transport = new PeerJsGameTransport();
    const connectPromise = transport.connect({ roomId: 'ABC123' }, callbacks());
    const peer = getPeer(0);

    transport.close();

    await expect(connectPromise).rejects.toThrow('cancelled');
    await vi.advanceTimersByTimeAsync(20_000);
    expect(peer.destroy).toHaveBeenCalledTimes(1);
    expect(getConnectionDiagnostics().some((entry) => entry.event === 'transport.connect.timeout')).toBe(false);
  });

  it('ignores events emitted by a superseded peer generation', async () => {
    const transport = new PeerJsGameTransport();
    const first = transport.connect({ roomId: 'ABC123' }, callbacks());
    const firstPeer = getPeer(0);
    transport.close();
    await expect(first).rejects.toThrow('cancelled');

    const second = transport.connect({ roomId: 'ABC123' }, callbacks());
    const secondPeer = getPeer(1);
    firstPeer.emit('open', 'stale-client-peer');
    expect(firstPeer.connect).not.toHaveBeenCalled();

    secondPeer.emit('open', 'current-client-peer');
    openConnection(1);
    markBridgeReady(1);
    await second;

    expect(secondPeer.connect).toHaveBeenCalledTimes(1);
  });

  it('creates only one DataConnection when peer open is emitted more than once', async () => {
    const transport = new PeerJsGameTransport();
    const connectPromise = transport.connect({ roomId: 'ABC123' }, callbacks());
    const peer = openPeer();

    peer.emit('open', 'client-peer-again');
    openConnection();
    markBridgeReady();
    await connectPromise;

    expect(peer.connect).toHaveBeenCalledTimes(1);
  });
});
