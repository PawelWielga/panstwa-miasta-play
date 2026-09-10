import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Layout } from './Layout';
import { appActions, appState } from '../test/fixtures';
import type { AppState } from '../state/gameStore';

const mocked = vi.hoisted(() => ({ value: {} as ReturnType<typeof createValue> }));
function createValue(state: AppState = appState()) { return { state, actions: appActions() }; }
vi.mock('../app/AppContext', () => ({ useApp: () => mocked.value }));

afterEach(() => vi.restoreAllMocks());

it('exposes explicit leave in the lobby without confirmation', () => {
  mocked.value = createValue();
  render(<Layout title="Poczekalnia"><div>Lobby</div></Layout>);

  fireEvent.click(screen.getByRole('button', { name: 'Opuść grę' }));

  expect(mocked.value.actions.leaveGame).toHaveBeenCalledTimes(1);
});

it('requires confirmation before leaving an active game', () => {
  const snapshot = { phase: 'answering', hostPlayerId: 'host' } as AppState['snapshot'];
  mocked.value = createValue(appState({ snapshot }));
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<Layout title="Runda 1"><div>Gra</div></Layout>);

  fireEvent.click(screen.getByRole('button', { name: 'Opuść grę' }));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(mocked.value.actions.leaveGame).not.toHaveBeenCalled();

  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Opuść grę' }));
  expect(mocked.value.actions.leaveGame).toHaveBeenCalledTimes(1);
});
