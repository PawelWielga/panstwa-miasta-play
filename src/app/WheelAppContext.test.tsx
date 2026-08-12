import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientMessage, CountriesCitiesWheelState, GameSnapshot, HostMessage } from '../protocol/messages';
import { wheelSpinRequestKey } from '../protocol/wheel';
import type { JoinParameters } from '../features/connection/joinParams';
import { joinParameters } from '../test/fixtures';
import type { GameTransport, TransportCallbacks } from '../peer/transport';
import type { AppState } from '../state/gameStore';
import { AppProvider, useApp, type AppActions } from './AppContext';

class WheelTransport implements GameTransport {
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
    gameId: 'g1', roomId: 'ABC123', sequenceNumber, hostPlayerId: 'host', phase: 'letterDraw',
    players: [
      { profile, joinedAt: 1, connected: true },
      { profile: { id: 'host', name: 'Host', emoji: '🎲', color: '#000000' }, joinedAt: 0, connected: true },
    ],
    categories: [{ id: 'city', name: 'Miasto', order: 0 }], usedLetters: [], letterHistory: [], round: null,
    wheelState, endMode: 'timer', timeMode: 'per-answer-10s',
    settings: { answerDurationSeconds: 90, roundCount: 5, maxPlayers: 8, speedBonusEnabled: false },
    hostControlsReview: true, submissions: {}, submittedAtByPlayerId: {}, donePlayerIds: [], votes: {}, hostVoteSuggestions: {}, reviewReady: {},
    finalResults: {}, roundScores: {}, finalScores: {}, speedBonusPlayerIds: [],
  };
}

describe('AppProvider synchronized wheel intent', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('sends at most one start intent for the same authoritative spin', async () => {
    const transport = new WheelTransport();
    render(<AppProvider transportFactory={() => transport}><Harness /></AppProvider>);

    await act(async () => {
      await actions.connect(joinParameters);
    });

    const waiting: CountriesCitiesWheelState = {
      schemaVersion: 1,
      phase: 'waiting',
      hostSessionId: 'session-1',
      roundNumber: 1,
      spinId: 'spin-1',
      selectedPlayerId: currentState.identity.playerId,
      waitingStartedAt: Date.now() - 1_000,
      waitingDeadlineAt: Date.now() + 9_000,
    };

    act(() => {
      transport.emitMessage({ type: 'game:snapshot', snapshot: snapshot(1, waiting) });
    });
    act(() => {
      actions.startWheelSpin();
      actions.startWheelSpin();
    });

    const spinMessages = transport.send.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'player:startWheelSpin');
    expect(spinMessages).toHaveLength(1);
    expect(spinMessages[0]).toMatchObject({
      type: 'player:startWheelSpin',
      senderId: currentState.identity.playerId,
      hostSessionId: waiting.hostSessionId,
      roundNumber: waiting.roundNumber,
      spinId: waiting.spinId,
    });
    expect(currentState.pendingWheelSpinRequestKey).toBe(wheelSpinRequestKey(waiting));

    act(() => {
      transport.emitMessage({ type: 'game:snapshot', snapshot: snapshot(2, waiting) });
      actions.startWheelSpin();
    });
    expect(transport.send.mock.calls.filter(([message]) => message.type === 'player:startWheelSpin')).toHaveLength(1);

    const spinning: CountriesCitiesWheelState = {
      ...waiting,
      phase: 'spinning',
      spinStartedAt: Date.now(),
      spinDurationMs: 6_000,
      spinSeed: 4,
      finalTurns: 6,
    };
    act(() => {
      transport.emitMessage({ type: 'game:snapshot', snapshot: snapshot(3, spinning) });
    });
    expect(currentState.pendingWheelSpinRequestKey).toBeNull();
  });

  it('links a hold started before the deadline to a release after it', async () => {
    const transport = new WheelTransport();
    render(<AppProvider transportFactory={() => transport}><Harness /></AppProvider>);
    await act(async () => {
      await actions.connect(joinParameters);
    });

    const baseNow = 1_000_000;
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(baseNow);
    const waiting: CountriesCitiesWheelState = {
      schemaVersion: 1,
      phase: 'waiting',
      hostSessionId: 'session-1',
      roundNumber: 1,
      spinId: 'spin-hold',
      selectedPlayerId: currentState.identity.playerId,
      waitingStartedAt: baseNow - 9_000,
      waitingDeadlineAt: baseNow + 100,
    };
    act(() => {
      transport.emitMessage({ type: 'game:snapshot', snapshot: snapshot(10, waiting) });
    });
    act(() => {
      actions.startWheelSpinHold();
    });

    const holdMessage = transport.send.mock.calls
      .map(([message]) => message)
      .find((message) => message.type === 'player:wheelSpinHoldStarted');
    expect(holdMessage).toBeDefined();
    if (!holdMessage) {
      throw new Error('Expected wheel hold message.');
    }

    dateNow.mockReturnValue(baseNow + 200);
    act(() => {
      actions.startWheelSpin(1_250);
    });
    const startMessage = transport.send.mock.calls
      .map(([message]) => message)
      .find((message) => message.type === 'player:startWheelSpin');
    expect(startMessage).toMatchObject({
      type: 'player:startWheelSpin',
      holdDurationMs: 1_250,
      holdId: holdMessage.holdId,
    });
    dateNow.mockRestore();
  });

  it('does not release after the deadline once the local hold was cancelled', async () => {
    const transport = new WheelTransport();
    render(<AppProvider transportFactory={() => transport}><Harness /></AppProvider>);
    await act(async () => {
      await actions.connect(joinParameters);
    });

    const baseNow = 2_000_000;
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(baseNow);
    const waiting: CountriesCitiesWheelState = {
      schemaVersion: 1,
      phase: 'waiting',
      hostSessionId: 'session-1',
      roundNumber: 1,
      spinId: 'spin-cancelled-hold',
      selectedPlayerId: currentState.identity.playerId,
      waitingStartedAt: baseNow - 9_000,
      waitingDeadlineAt: baseNow + 100,
    };
    act(() => {
      transport.emitMessage({ type: 'game:snapshot', snapshot: snapshot(20, waiting) });
    });
    act(() => {
      actions.startWheelSpinHold();
      actions.cancelWheelSpinHold();
      actions.cancelWheelSpinHold();
    });
    const holdMessage = transport.send.mock.calls
      .map(([message]) => message)
      .find((message) => message.type === 'player:wheelSpinHoldStarted');
    const cancelMessages = transport.send.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'player:wheelSpinHoldCancelled');
    expect(holdMessage).toBeDefined();
    expect(cancelMessages).toHaveLength(1);
    if (!holdMessage) {
      throw new Error('Expected wheel hold message.');
    }
    expect(cancelMessages[0]).toMatchObject({
      type: 'player:wheelSpinHoldCancelled',
      senderId: currentState.identity.playerId,
      hostSessionId: waiting.hostSessionId,
      roundNumber: waiting.roundNumber,
      spinId: waiting.spinId,
      holdId: holdMessage.holdId,
    });

    dateNow.mockReturnValue(baseNow + 200);
    act(() => {
      actions.startWheelSpin(500);
    });
    expect(
      transport.send.mock.calls.filter(([message]) => message.type === 'player:startWheelSpin'),
    ).toHaveLength(0);
    dateNow.mockRestore();
  });

});
