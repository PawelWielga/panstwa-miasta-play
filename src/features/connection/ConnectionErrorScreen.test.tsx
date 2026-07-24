import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ConnectionErrorScreen } from './ConnectionErrorScreen';
import { appActions, appState } from '../../test/fixtures';
const mocked = vi.hoisted(() => ({ value: {} as ReturnType<typeof createValue> }));
function createValue() { return { state: appState({ connectionStatus: 'error', connectionError: 'Host niedostępny' }), actions: appActions() }; }
vi.mock('../../app/AppContext', () => ({ useApp: () => mocked.value }));
it('explains the error and lets the user retry', async () => {
  mocked.value = createValue(); render(<ConnectionErrorScreen />);
  expect(screen.getByText('Host niedostępny')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
  expect(mocked.value.actions.retry).toHaveBeenCalled();
});
