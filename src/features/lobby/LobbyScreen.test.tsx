import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { LobbyScreen } from './LobbyScreen';
import { appActions, appState } from '../../test/fixtures';
const mocked = vi.hoisted(() => ({ value: {} as ReturnType<typeof createValue> }));
function createValue() { return { state: appState(), actions: appActions() }; }
vi.mock('../../app/AppContext', () => ({ useApp: () => mocked.value }));
it('shows players and sends ready state', async () => {
  mocked.value = createValue(); render(<LobbyScreen />);
  expect(screen.getByText('Ala')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Jestem gotowy' }));
  expect(mocked.value.actions.toggleReady).toHaveBeenCalled();
});
