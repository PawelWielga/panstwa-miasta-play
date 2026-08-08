import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HOST_VERSION_UNSUPPORTED_MESSAGE,
  HostVersionUnsupportedError,
} from '../config/hostCompatibility';
import type { ClientMessage, HostMessage } from '../protocol/messages';
import type { JoinParameters } from '../features/connection/joinParams';
import { joinParameters } from '../test/fixtures';
import type {
  GameTransport,
  TransportCallbacks,
  TransportConnectContext,
  TransportState,
} from '../peer/transport';
import type { AppState } from '../state/gameStore';
import {
  readLatestUnfinishedMultiplayerSession,
  saveUnfinishedMultiplayerSession,
} from '../storage/unfinishedMultiplayerSessionStorage';
import { AppProvider, useApp, type AppActions } from './AppContext';

class DeferredTransport implements GameTransport {
  readonly connect = vi.fn((
    _parameters: JoinParameters,
    callbacks: TransportCallbacks,
    context?: TransportConnectContext,
  ): Promise<void> => {
    this.callbacks = callbacks;
    this.context = context;
    callbacks.onState('connecting');
    return this.connectPromise;
  });

  readonly send = vi.fn((message: ClientMessage): void => { void message; });
  readonly close = vi.fn((): void => undefined);
  callbacks: TransportCallbacks | null = null;
  context: TransportConnectContext | undefined;
  private readonly connectPromise: Promise<void>;
  private resolveConnect!: () => void;
  private rejectConnect!: (error: Error) => void;

  constructor() {
    this.connectPromise = new Promise<void>((resolve, reject) => {
      this.resolveConnect = resolve;
      this.rejectConnect = reject;
    });
  }

  open(): void {
    this.callbacks?.onState('open');
    this.resolveConnect();
  }

  fail(message = 'failed'): void {
    this.callbacks?.onState('error');
    this.rejectConnect(new Error(message));
  }

  failUnsupported(): void {
    this.callbacks?.onError(HOST_VERSION_UNSUPPORTED_MESSAGE);
    this.rejectConnect(new HostVersionUnsupportedError('build-number-too-low', {
      appVersion: '1.1.6',
      buildNumber: 9,
      protocolVersion: 4,
    }));
  }

  emitState(state: TransportState): void {
    this.callbacks?.onState(state);
  }

  emitMessage(message: HostMessage): void {
    this.callbacks?.onMessage(message);
  }
}

let actions: AppActions;
let currentState: AppState;
function Harness({ onActions }: { onActions: (value: AppActions) => void }) {
  const current = useApp();
  useEffect(() => onActions(current.actions), [current.actions, onActions]);
  useEffect(() => { currentState = current.state; }, [current.state]);
  return null;
}

const captureActions = (value: AppActions): void => { actions = value; };

function renderProvider(factory: () => GameTransport): void {
  render(<AppProvider transportFactory={factory}><Harness onActions={captureActions} /></AppProvider>);
}

function getTransport(transports: DeferredTransport[], index: number): DeferredTransport {
  const transport = transports[index];
  if (!transport) throw new Error(`Missing transport at index ${String(index)}.`);
  return transport;
}

describe('AppProvider connection lifecycle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('deduplicates concurrent user connect actions and sends hello synchronously on open', async () => {
    const transports: DeferredTransport[] = [];
    renderProvider(() => {
      const transport = new DeferredTransport();
      transports.push(transport);
      return transport;
    });

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = actions.connect(joinParameters);
      second = actions.connect(joinParameters);
    });

    expect(first).toBe(second);
    expect(transports).toHaveLength(1);
    expect(getTransport(transports, 0).connect).toHaveBeenCalledTimes(1);
    expect(getTransport(transports, 0).send).not.toHaveBeenCalled();
    expect(getTransport(transports, 0).context?.connectionAttemptId).toMatch(/^web-/);

    act(() => {
      getTransport(transports, 0).open();
    });

    expect(getTransport(transports, 0).send).toHaveBeenCalledTimes(1);
    expect(getTransport(transports, 0).send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: 'player:hello' }),
    );

    await act(async () => {
      await first;
    });

    expect(getTransport(transports, 0).send).toHaveBeenCalledTimes(1);
  });

  it('persists an unfinished session only after host admission and advances its sequence', async () => {
    const transports: DeferredTransport[] = [];
    renderProvider(() => {
      const transport = new DeferredTransport();
      transports.push(transport);
      return transport;
    });

    let connectPromise!: Promise<void>;
    act(() => { connectPromise = actions.connect(joinParameters); });
    await act(async () => {
      getTransport(transports, 0).open();
      await connectPromise;
    });

    expect(readLatestUnfinishedMultiplayerSession()).toBeNull();

    act(() => {
      getTransport(transports, 0).emitMessage({
        type: 'room:players',
        protocolVersion: 4,
        players: [currentState.identity.profile],
      });
    });

    let stored = readLatestUnfinishedMultiplayerSession();
    expect(stored).toEqual(expect.objectContaining({
      playerId: currentState.identity.playerId,
      reconnectToken: currentState.identity.reconnectToken,
      lastSeenSequenceNumber: 0,
    }));
    expect(stored?.target.roomId).toBe(joinParameters.roomId);
    expect(stored?.target.hostSessionId).toBe(joinParameters.hostSessionId);

    act(() => {
      getTransport(transports, 0).emitMessage({
        type: 'host:heartbeat',
        gameId: 'game-1',
        sequenceNumber: 7,
      });
    });

    stored = readLatestUnfinishedMultiplayerSession();
    expect(stored?.lastSeenSequenceNumber).toBe(7);
  });

  it('restores saved identity and sequence in the resume handshake', async () => {
    const transports: DeferredTransport[] = [];
    renderProvider(() => {
      const transport = new DeferredTransport();
      transports.push(transport);
      return transport;
    });

    saveUnfinishedMultiplayerSession({
      target: joinParameters,
      playerId: 'restored-player',
      reconnectToken: 'restored-token',
      lastSeenSequenceNumber: 9,
      lastUsedAt: Date.now(),
    });
    const stored = readLatestUnfinishedMultiplayerSession();
    if (!stored) throw new Error('Expected stored unfinished session.');

    let connectPromise!: Promise<void>;
    act(() => { connectPromise = actions.connect(stored.target, stored); });
    await act(async () => {
      getTransport(transports, 0).open();
      await connectPromise;
    });

    expect(getTransport(transports, 0).send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: 'player:hello',
        reconnectToken: 'restored-token',
      }),
    );
    expect(getTransport(transports, 0).send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: 'client:rejoin',
        lastSeenSequenceNumber: 9,
      }),
    );
    const hello = getTransport(transports, 0).send.mock.calls[0]?.[0];
    const rejoin = getTransport(transports, 0).send.mock.calls[1]?.[0];
    if (hello?.type !== 'player:hello' || rejoin?.type !== 'client:rejoin') {
      throw new Error('Expected resume handshake messages.');
    }
    expect(hello.player.id).toBe('restored-player');
    expect(rejoin.player.id).toBe('restored-player');
    expect(currentState.identity.playerId).toBe('restored-player');
    expect(currentState.lastSeenSequenceNumber).toBe(9);
  });

  it('keeps an admitted unfinished session when reconnect is cancelled', async () => {
    const transports: DeferredTransport[] = [];
    renderProvider(() => {
      const transport = new DeferredTransport();
      transports.push(transport);
      return transport;
    });

    let connectPromise!: Promise<void>;
    act(() => { connectPromise = actions.connect(joinParameters); });
    await act(async () => {
      getTransport(transports, 0).open();
      await connectPromise;
    });
    act(() => {
      getTransport(transports, 0).emitMessage({
        type: 'room:players',
        protocolVersion: 4,
        players: [currentState.identity.profile],
      });
    });
    expect(readLatestUnfinishedMultiplayerSession()).not.toBeNull();

    act(() => { actions.cancel(); });

    expect(currentState.connectionStatus).toBe('closed');
    expect(readLatestUnfinishedMultiplayerSession()).not.toBeNull();
  });

  it('does not start retry while the previous attempt is still in flight', async () => {
    const transports: DeferredTransport[] = [];
    renderProvider(() => {
      const transport = new DeferredTransport();
      transports.push(transport);
      return transport;
    });

    let connectPromise!: Promise<void>;
    act(() => {
      connectPromise = actions.connect(joinParameters);
      actions.retry();
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('pageshow'));
    });

    expect(transports).toHaveLength(1);
    expect(getTransport(transports, 0).connect).toHaveBeenCalledTimes(1);

    await act(async () => {
      getTransport(transports, 0).open();
      await connectPromise;
    });
  });

  it('does not send hello or reconnect after an unsupported host version', async () => {
    vi.useFakeTimers();
    const transports: DeferredTransport[] = [];
    renderProvider(() => {
      const transport = new DeferredTransport();
      transports.push(transport);
      return transport;
    });

    let connectPromise!: Promise<void>;
    act(() => { connectPromise = actions.connect(joinParameters); });
    await act(async () => {
      getTransport(transports, 0).failUnsupported();
      await connectPromise;
    });

    act(() => {
      actions.retry();
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('pageshow'));
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });

    expect(transports).toHaveLength(1);
    expect(getTransport(transports, 0).send).not.toHaveBeenCalled();
  });

  it.each([
    ['room_full', 'Pokój jest pełny. Host ustawił limit graczy dla tej rozgrywki.'],
    ['game_already_started', 'Gra już się rozpoczęła. Poproś hosta o nowy pokój albo spróbuj później.'],
  ])('stops reconnect after terminal join rejection %s', async (code, message) => {
    vi.useFakeTimers();
    const transports: DeferredTransport[] = [];
    renderProvider(() => {
      const transport = new DeferredTransport();
      transports.push(transport);
      return transport;
    });

    let connectPromise!: Promise<void>;
    act(() => { connectPromise = actions.connect(joinParameters); });
    await act(async () => {
      getTransport(transports, 0).open();
      await connectPromise;
    });
    act(() => {
      getTransport(transports, 0).emitMessage({
        type: 'room:players',
        protocolVersion: 4,
        players: [currentState.identity.profile],
      });
    });
    expect(readLatestUnfinishedMultiplayerSession()).not.toBeNull();

    act(() => {
      getTransport(transports, 0).emitMessage({ type: 'game:error', code, message });
      getTransport(transports, 0).emitState('closed');
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('pageshow'));
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });

    expect(currentState.connectionStatus).toBe('error');
    expect(currentState.connectionError).toBe(message);
    expect(getTransport(transports, 0).close).toHaveBeenCalled();
    expect(transports).toHaveLength(1);
    expect(readLatestUnfinishedMultiplayerSession()).toBeNull();
  });

  it('ignores stale callbacks and cancels pending retry after a successful reconnect', async () => {
    vi.useFakeTimers();
    const transports: DeferredTransport[] = [];
    renderProvider(() => {
      const transport = new DeferredTransport();
      transports.push(transport);
      return transport;
    });

    let first!: Promise<void>;
    act(() => { first = actions.connect(joinParameters); });
    await act(async () => {
      getTransport(transports, 0).fail('first failed');
      await first;
    });

    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(transports).toHaveLength(2);

    act(() => {
      getTransport(transports, 0).emitState('closed');
      getTransport(transports, 0).emitState('error');
    });
    await act(async () => {
      getTransport(transports, 1).open();
      await Promise.resolve();
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });

    expect(transports).toHaveLength(2);
    expect(getTransport(transports, 1).send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: 'player:hello' }),
    );
    expect(getTransport(transports, 1).send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: 'client:rejoin' }),
    );
  });
});
