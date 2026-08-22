import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ClientMessage,
  CountriesCitiesWheelState,
  GameSnapshot,
  HostMessage,
} from '../protocol/messages';
import type { JoinParameters } from '../features/connection/joinParams';
import type { GameTransport, TransportCallbacks, TransportState } from '../peer/transport';
import type { AppState } from '../state/gameStore';
import { joinParameters } from '../test/fixtures';
import { AppProvider, useApp, type AppActions } from './AppContext';

class ReconnectWheelTransport implements GameTransport {
  callbacks: TransportCallbacks | null = null;
  readonly send = vi.fn((message: ClientMessage): void => { void message; });
  readonly close = vi.fn((): void => undefined);
  readonly connect = vi.fn((
    parameters: JoinParameters,
    callbacks: TransportCallbacks,
  ): Promise<void> => {
    void parameters;
    this.callbacks = callbacks;
    callbacks.onState('connecting');
    callbacks.onState('open');
    return Promise.resolve();
  });

  emitState(state: TransportState): void {
    this.callbacks?.onState(state);
  }

  emitMessage(message: HostMessage): void {
    this.callbacks?.onMessage(message);
  }
}

let actions: AppActions;
let currentState: AppState;

function Harness() {
  const current = useApp();
  useEffect(() => { actions = current.actions; }, [current.actions]);
  useEffect(() => { currentState = current.state; }, [current.state]);
  return null;
}

function snapshot(sequenceNumber: number, wheelState: CountriesCitiesWheelState): GameSnapshot {
  const profile = currentState.identity.profile;
  return {
    gameId: 'g1',
    roomId: 'ABC123',
    sequenceNumber,
    hostPlayerId: 'host',
    phase: 'letterDraw',
    players: [
      { profile, joinedAt: 1, connected: true },
      {
        profile: { id: 'host', name: 'Host', emoji: '🎲', color: '#000000' },
        joinedAt: 0,
        connected: true,
      },
    ],
    categories: [{ id: 'city', name: 'Miasto', order: 0 }],
    usedLetters: [],
    letterHistory: [],
    round: null,
    wheelState,
    endMode: 'timer',
    timeMode: 'per-answer-10s',
    settings: {
      answerDurationSeconds: 90,
      roundCount: 5,
      maxPlayers: 8,
      speedBonusEnabled: false,
    },
    hostControlsReview: true,
    submissions: {},
    submittedAtByPlayerId: {},
    donePlayerIds: [],
    votes: {},
    hostVoteSuggestions: {},
    reviewReady: {},
    finalResults: {},
    roundScores: {},
    finalScores: {},
    speedBonusPlayerIds: [],
  };
}

describe('AppProvider wheel reconnect continuity', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('reuses the accepted hold id after reconnect while the host is still waiting', async () => {
    vi.useFakeTimers();
    const transports: ReconnectWheelTransport[] = [];
    render(
      <AppProvider transportFactory={() => {
        const transport = new ReconnectWheelTransport();
        transports.push(transport);
        return transport;
      }}>
        <Harness />
      </AppProvider>,
    );

    await act(async () => {
      await actions.connect(joinParameters);
    });

    const firstTransport = transports[0];
    if (!firstTransport) throw new Error('Missing initial transport.');

    const waiting: CountriesCitiesWheelState = {
      schemaVersion: 1,
      phase: 'waiting',
      hostSessionId: 'session-1',
      roundNumber: 1,
      spinId: 'spin-reconnect',
      selectedPlayerId: currentState.identity.playerId,
      waitingStartedAt: Date.now() - 1_000,
      waitingDeadlineAt: Date.now() + 9_000,
    };

    act(() => {
      firstTransport.emitMessage({ type: 'game:snapshot', snapshot: snapshot(1, waiting) });
    });
    act(() => {
      actions.startWheelSpinHold();
    });

    const holdMessage = firstTransport.send.mock.calls
      .map(([message]) => message)
      .find((message) => message.type === 'player:wheelSpinHoldStarted');
    if (!holdMessage) {
      throw new Error('Expected wheel hold message.');
    }

    act(() => {
      firstTransport.emitState('closed');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    const reconnectedTransport = transports[1];
    if (!reconnectedTransport) throw new Error('Missing reconnect transport.');
    expect(currentState.connectionStatus).toBe('connected');

    act(() => {
      reconnectedTransport.emitMessage({ type: 'game:snapshot', snapshot: snapshot(2, waiting) });
    });
    act(() => {
      actions.startWheelSpin(1_250);
    });

    const spinMessage = reconnectedTransport.send.mock.calls
      .map(([message]) => message)
      .find((message) => message.type === 'player:startWheelSpin');
    expect(spinMessage).toMatchObject({
      type: 'player:startWheelSpin',
      hostSessionId: waiting.hostSessionId,
      roundNumber: waiting.roundNumber,
      spinId: waiting.spinId,
      holdDurationMs: 1_250,
      holdId: holdMessage.holdId,
    });
  });
});
