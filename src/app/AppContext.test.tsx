import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientMessage } from '../protocol/messages';
import type {
  GameTransport,
  TransportCallbacks,
  TransportConnectContext,
  TransportState,
} from '../peer/transport';
import { AppProvider, useApp, type AppActions } from './AppContext';

class DeferredTransport implements GameTransport {
  readonly connect = vi.fn((
    _parameters: { roomId: string },
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

  emitState(state: TransportState): void {
    this.callbacks?.onState(state);
  }
}

let actions: AppActions;
function Harness({ onActions }: { onActions: (value: AppActions) => void }) {
  const currentActions = useApp().actions;
  useEffect(() => onActions(currentActions), [currentActions, onActions]);
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

  it('deduplicates concurrent user connect actions and sends hello only after open', async () => {
    const transports: DeferredTransport[] = [];
    renderProvider(() => {
      const transport = new DeferredTransport();
      transports.push(transport);
      return transport;
    });

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = actions.connect({ roomId: 'ABC123' });
      second = actions.connect({ roomId: 'ABC123' });
    });

    expect(first).toBe(second);
    expect(transports).toHaveLength(1);
    expect(getTransport(transports, 0).connect).toHaveBeenCalledTimes(1);
    expect(getTransport(transports, 0).send).not.toHaveBeenCalled();
    expect(getTransport(transports, 0).context?.connectionAttemptId).toMatch(/^web-/);

    await act(async () => {
      getTransport(transports, 0).open();
      await first;
    });

    expect(getTransport(transports, 0).send).toHaveBeenCalledTimes(1);
    expect(getTransport(transports, 0).send).toHaveBeenCalledWith(expect.objectContaining({ type: 'player:hello' }));
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
      connectPromise = actions.connect({ roomId: 'ABC123' });
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

  it('ignores stale callbacks and cancels pending retry after a successful reconnect', async () => {
    vi.useFakeTimers();
    const transports: DeferredTransport[] = [];
    renderProvider(() => {
      const transport = new DeferredTransport();
      transports.push(transport);
      return transport;
    });

    let first!: Promise<void>;
    act(() => { first = actions.connect({ roomId: 'ABC123' }); });
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
    expect(getTransport(transports, 1).send).toHaveBeenCalledWith(expect.objectContaining({ type: 'player:hello' }));
  });
});
