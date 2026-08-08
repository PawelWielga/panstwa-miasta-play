import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransitionScreen } from './TransitionScreen';
import { appActions, appState, identity } from '../../test/fixtures';
import { wheelSpinRequestKey } from '../../protocol/wheel';
import type { CountriesCitiesWheelState, GameSnapshot } from '../../protocol/messages';

const mocked = vi.hoisted(() => ({ value: {} as ReturnType<typeof createValue> }));
function createValue() { return { state: appState(), actions: appActions() }; }
vi.mock('../../app/AppContext', () => ({ useApp: () => mocked.value }));

const waitingWheel: CountriesCitiesWheelState = {
  schemaVersion: 1,
  phase: 'waiting',
  hostSessionId: 'session-1',
  roundNumber: 1,
  spinId: 'spin-1',
  selectedPlayerId: identity.playerId,
  waitingStartedAt: 1_000,
  waitingDeadlineAt: Date.now() + 10_000,
};

function snapshot(wheelState: CountriesCitiesWheelState): GameSnapshot {
  return {
    gameId: 'g1', roomId: 'ABC123', sequenceNumber: 2, hostPlayerId: 'host', phase: 'letterDraw',
    players: [
      { profile: identity.profile, joinedAt: 1, connected: true },
      { profile: { id: 'host', name: 'Host', emoji: '🎲', color: '#000000' }, joinedAt: 0, connected: true },
    ],
    categories: [{ id: 'city', name: 'Miasto', order: 0 }], usedLetters: ['A'], letterHistory: ['A'], round: null,
    wheelState, endMode: 'timer', timeMode: 'per-answer-10s',
    settings: { answerDurationSeconds: 90, roundCount: 5, maxPlayers: 8, speedBonusEnabled: false },
    hostControlsReview: true, submissions: {}, submittedAtByPlayerId: {}, donePlayerIds: [], votes: {}, hostVoteSuggestions: {}, reviewReady: {},
    finalResults: {}, roundScores: {}, finalScores: {}, speedBonusPlayerIds: [],
  };
}

describe('TransitionScreen synchronized wheel', () => {
  beforeEach(() => {
    mocked.value = createValue();
  });

  it('lets only the selected player request the spin', async () => {
    const actions = appActions();
    mocked.value = {
      state: appState({ snapshot: snapshot(waitingWheel), currentLetter: 'Z' }),
      actions,
    };
    render(<TransitionScreen />);

    expect(screen.getByRole('heading', { name: 'Twoja kolej' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Koło fortuny. Wynik jest ukryty.' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Zakręć kołem' }));
    expect(actions.startWheelSpin).toHaveBeenCalledTimes(1);
  });

  it('does not reveal snapshot round letter while the wheel is waiting', () => {
    mocked.value = {
      state: appState({ snapshot: snapshot(waitingWheel), currentLetter: 'Z' }),
      actions: appActions(),
    };
    render(<TransitionScreen />);

    expect(screen.getByRole('img', { name: 'Koło fortuny. Wynik jest ukryty.' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Koło fortuny. Wylosowana litera Z.' })).not.toBeInTheDocument();
  });

  it('recalculates the waiting countdown immediately after the tab becomes visible', async () => {
    const baseNow = 1_000_000;
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(baseNow);
    const visibilityState = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const wheel = {
      ...waitingWheel,
      waitingStartedAt: baseNow,
      waitingDeadlineAt: baseNow + 5_000,
    };
    mocked.value = {
      state: appState({ snapshot: snapshot(wheel) }),
      actions: appActions(),
    };
    render(<TransitionScreen />);

    expect(screen.getByText('Start automatyczny za 5 s')).toBeInTheDocument();

    dateNow.mockReturnValue(baseNow + 4_000);
    await act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(screen.getByText('Start automatyczny za 1 s')).toBeInTheDocument();
    visibilityState.mockRestore();
    dateNow.mockRestore();
  });

  it('disables the action after the same spin request was sent', () => {
    mocked.value = {
      state: appState({
        snapshot: snapshot(waitingWheel),
        pendingWheelSpinRequestKey: wheelSpinRequestKey(waitingWheel),
      }),
      actions: appActions(),
    };
    render(<TransitionScreen />);

    expect(screen.getByRole('button', { name: 'Czekamy na hosta…' })).toBeDisabled();
  });

  it('shows other players whose turn it is without a spin button', () => {
    const otherWheel = { ...waitingWheel, selectedPlayerId: 'host' };
    mocked.value = {
      state: appState({ snapshot: snapshot(otherWheel) }),
      actions: appActions(),
    };
    render(<TransitionScreen />);

    expect(screen.getByRole('heading', { name: 'Teraz kręci Host' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zakręć kołem' })).not.toBeInTheDocument();
  });

  it('reveals the letter only after the host marks the wheel finished', () => {
    const finished: CountriesCitiesWheelState = {
      ...waitingWheel,
      phase: 'finished',
      spinStartedAt: 2_000,
      spinDurationMs: 6_000,
      spinSeed: 4,
      finalTurns: 6,
      letter: 'E',
    };
    mocked.value = {
      state: appState({ snapshot: snapshot(finished), currentLetter: 'E' }),
      actions: appActions(),
    };
    render(<TransitionScreen />);

    expect(screen.getByRole('img', { name: 'Koło fortuny. Wylosowana litera E.' })).toBeInTheDocument();
  });
});