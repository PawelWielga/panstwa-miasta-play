import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { AnsweringScreen } from './AnsweringScreen';
import { appActions, appState } from '../../test/fixtures';
const mocked = vi.hoisted(() => ({ value: {} as ReturnType<typeof createValue> }));
function createValue() { return { state: appState(), actions: appActions() }; }
vi.mock('../../app/AppContext', () => ({ useApp: () => mocked.value }));
it('collects category answers and submits them', async () => {
  mocked.value = createValue(); render(<AnsweringScreen />);
  await userEvent.type(screen.getByLabelText('Miasto'), 'Augustów');
  expect(mocked.value.actions.setAnswer).toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Wyślij odpowiedzi' }));
  expect(mocked.value.actions.submitAnswers).toHaveBeenCalled();
});

it('renders 30 categories and keeps Enter navigation available', async () => {
  const categories = Array.from({ length: 30 }, (_, index) => ({
    id: `category-${String(index + 1)}`,
    name: `Kategoria ${String(index + 1)}`,
    order: index,
  }));
  mocked.value = {
    state: appState({ categories }),
    actions: appActions(),
  };
  render(<AnsweringScreen />);

  expect(screen.getAllByRole('textbox')).toHaveLength(30);
  const firstInput = screen.getByLabelText('Kategoria 1');
  const secondInput = screen.getByLabelText('Kategoria 2');
  expect(screen.getByLabelText('Kategoria 30')).toBeInTheDocument();

  firstInput.focus();
  await userEvent.keyboard('{Enter}');
  expect(secondInput).toHaveFocus();
});

it('locks the answering UI after the local deadline expires', async () => {
  mocked.value = {
    state: appState({ deadlineAt: Date.now() - 1 }),
    actions: appActions(),
  };
  render(<AnsweringScreen />);

  expect(await screen.findByRole('heading', { name: 'Czas minął' })).toBeInTheDocument();
  expect(screen.getByText('Czekamy na prowadzącego…')).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Wyślij odpowiedzi' })).not.toBeInTheDocument();
});

it('shows sending and acknowledged states for host finalization', () => {
  const snapshot = {
    gameId: 'g1', roomId: 'ABC123', sequenceNumber: 2, hostPlayerId: 'host', phase: 'answering' as const,
    players: [], categories: [{ id: 'city', name: 'Miasto', order: 0 }], usedLetters: ['A'], letterHistory: ['A'],
    round: { number: 1, letter: 'A', usedLetters: ['A'], categories: [{ id: 'city', name: 'Miasto', order: 0 }], deadlineAt: null, answeringStartedAt: 1, lastCallPlayerId: null, categoryIndex: 0 },
    answerFinalization: { id: 'final-1', roundNumber: 1, requestedAt: 10, expiresAt: 20, trigger: 'manual' as const, expectedPlayerIds: [] },
    endMode: 'rounds', timeMode: 'fixed', settings: { answerDurationSeconds: 90, roundCount: 5, maxPlayers: 8, speedBonusEnabled: false },
    hostControlsReview: true, submissions: {}, submittedAtByPlayerId: {}, donePlayerIds: [], votes: {}, hostVoteSuggestions: {}, reviewReady: {}, finalResults: {}, roundScores: {}, finalScores: {}, speedBonusPlayerIds: [],
  };
  mocked.value = { state: appState({ snapshot }), actions: appActions() };
  const { rerender } = render(<AnsweringScreen />);
  expect(screen.getByRole('heading', { name: 'Zapisujemy odpowiedzi…' })).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

  mocked.value = { state: appState({ snapshot: { ...snapshot, donePlayerIds: ['player-1'] } }), actions: appActions() };
  rerender(<AnsweringScreen />);
  expect(screen.getByRole('heading', { name: 'Odpowiedzi zapisane' })).toBeInTheDocument();
  expect(screen.getByText('Czekamy na ocenę prowadzącego…')).toBeInTheDocument();
});

