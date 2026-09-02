import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { LobbyScreen } from './LobbyScreen';
import { appActions, appState } from '../../test/fixtures';
const mocked = vi.hoisted(() => ({ value: {} as ReturnType<typeof createValue> }));
function createValue() { return { state: appState(), actions: appActions() }; }
vi.mock('../../app/AppContext', () => ({ useApp: () => mocked.value }));
it('matches the native guest lobby structure', () => {
  mocked.value = createValue(); render(<LobbyScreen />);
  expect(screen.getByText('Oczekiwanie na rozpoczęcie gry')).toBeInTheDocument();
  expect(screen.getByText('Ala')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Gra' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Zaproś' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Jestem gotowy' })).not.toBeInTheDocument();
});
