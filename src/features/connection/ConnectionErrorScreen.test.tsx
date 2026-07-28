import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HOST_VERSION_UNSUPPORTED_MESSAGE } from '../../config/hostCompatibility';
import { ConnectionErrorScreen } from './ConnectionErrorScreen';
import { appActions, appState } from '../../test/fixtures';
import { clearConnectionDiagnostics, recordConnectionDiagnostic } from '../../diagnostics/connectionDiagnostics';

const mocked = vi.hoisted(() => ({ value: {} as ReturnType<typeof createValue> }));
function createValue(connectionError = 'Host niedostępny') {
  return { state: appState({ connectionStatus: 'error', connectionError }), actions: appActions() };
}
vi.mock('../../app/AppContext', () => ({ useApp: () => mocked.value }));

beforeEach(() => {
  clearConnectionDiagnostics();
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

it('explains the error and lets the user retry', async () => {
  mocked.value = createValue(); render(<ConnectionErrorScreen />);
  expect(screen.getByText('Host niedostępny')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
  expect(mocked.value.actions.retry).toHaveBeenCalled();
});

it('shows the recorded connection diagnostics without sensitive player data', async () => {
  recordConnectionDiagnostic('transport.connect.failed', 'error', {
    errorType: 'peer-unavailable',
    reconnectToken: 'secret',
  });
  mocked.value = createValue(); render(<ConnectionErrorScreen />);

  await userEvent.click(screen.getByText('Szczegóły diagnostyczne (1)'));

  expect(screen.getByLabelText('Log diagnostyczny połączenia')).toHaveTextContent('peer-unavailable');
  expect(screen.getByLabelText('Log diagnostyczny połączenia')).not.toHaveTextContent('secret');
});

it('shows a dedicated update-required screen without retry', () => {
  mocked.value = createValue(HOST_VERSION_UNSUPPORTED_MESSAGE);
  render(<ConnectionErrorScreen />);

  expect(screen.getByRole('heading', { name: 'Prowadzący musi zaktualizować grę' })).toBeInTheDocument();
  expect(screen.getByText(HOST_VERSION_UNSUPPORTED_MESSAGE)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Spróbuj ponownie' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Wróć' })).toBeInTheDocument();
});

