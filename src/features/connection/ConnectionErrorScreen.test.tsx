import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ConnectionErrorScreen } from './ConnectionErrorScreen';
import { connectionFailureCodes, type ConnectionFailureCode } from '../../protocol/connectionFailure';
import { appActions, appState } from '../../test/fixtures';
import { clearConnectionDiagnostics, recordConnectionDiagnostic } from '../../diagnostics/connectionDiagnostics';

const mocked = vi.hoisted(() => ({ value: {} as ReturnType<typeof createValue> }));
function createValue(connectionError: ConnectionFailureCode = connectionFailureCodes.roomUnavailable) {
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

it('maps an unreachable host to canonical copy and retry', async () => {
  mocked.value = createValue(connectionFailureCodes.roomUnavailable);
  render(<ConnectionErrorScreen />);

  expect(screen.getByText('Nie znaleziono pokoju. Sprawdź, czy prowadzący nadal go udostępnia i spróbuj ponownie.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
  expect(mocked.value.actions.retry).toHaveBeenCalled();
  expect(mocked.value.actions.cancel).not.toHaveBeenCalled();
});

it('asks for the code again when the invitation is invalid', async () => {
  mocked.value = createValue(connectionFailureCodes.invalidJoinCode);
  render(<ConnectionErrorScreen />);

  expect(screen.getByText('Kod lub dane pokoju są nieprawidłowe. Poproś prowadzącego o aktualny kod.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Wpisz kod ponownie' }));
  expect(mocked.value.actions.cancel).toHaveBeenCalled();
  expect(mocked.value.actions.retry).not.toHaveBeenCalled();
});

it('treats a direct-connection timeout as a likely blocked network', async () => {
  mocked.value = createValue(connectionFailureCodes.connectionTimeout);
  render(<ConnectionErrorScreen />);

  expect(screen.getByRole('heading', { name: 'Ta sieć może blokować grę' })).toBeInTheDocument();
  expect(screen.getByText('Nie udało się nawiązać bezpośredniego połączenia z prowadzącym. Ta sieć może blokować grę przez internet.')).toBeInTheDocument();
  expect(screen.getByText('Spróbuj innej sieci Wi‑Fi, internetu komórkowego albo wyłącz VPN. Potem wpisz ponownie ten sam kod pokoju.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Wróć i zmień sieć' }));
  expect(mocked.value.actions.cancel).toHaveBeenCalled();
  expect(mocked.value.actions.retry).not.toHaveBeenCalled();
});

it('maps blocked P2P to the change-network recovery', async () => {
  mocked.value = createValue(connectionFailureCodes.p2pNetworkBlocked);
  render(<ConnectionErrorScreen />);

  expect(screen.getByRole('heading', { name: 'Ta sieć blokuje grę' })).toBeInTheDocument();
  expect(screen.getByText('Nie udało się nawiązać bezpośredniego połączenia z prowadzącym. Ta sieć blokuje grę przez internet.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Wróć i zmień sieć' }));
  expect(mocked.value.actions.cancel).toHaveBeenCalled();
  expect(mocked.value.actions.retry).not.toHaveBeenCalled();
});

it('maps a full room to returning to the join screen', async () => {
  mocked.value = createValue(connectionFailureCodes.roomFull);
  render(<ConnectionErrorScreen />);

  expect(screen.getByText('Pokój jest pełny. Prowadzący ustawił limit graczy dla tej rozgrywki.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Wróć do menu' }));
  expect(mocked.value.actions.cancel).toHaveBeenCalled();
});

it('maps a started game to entering a new code', async () => {
  mocked.value = createValue(connectionFailureCodes.gameAlreadyStarted);
  render(<ConnectionErrorScreen />);

  expect(screen.getByText('Gra już się rozpoczęła. Poproś prowadzącego o nowy pokój albo spróbuj później.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Wpisz kod ponownie' }));
  expect(mocked.value.actions.cancel).toHaveBeenCalled();
});

it('maps an exhausted reconnect to retry without leaking the raw diagnostic', async () => {
  mocked.value = createValue(connectionFailureCodes.gameConnectionLost);
  render(<ConnectionErrorScreen />);

  expect(screen.getByText('Połączenie zostało przerwane. Spróbuj ponownie.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
  expect(mocked.value.actions.retry).toHaveBeenCalled();
});

it('falls back to safe generic copy for an unknown technical error', () => {
  mocked.value = createValue(connectionFailureCodes.unknown);
  render(<ConnectionErrorScreen />);

  expect(screen.getByText('Nie udało się dołączyć. Spróbuj ponownie albo poproś prowadzącego o aktualny kod.')).toBeInTheDocument();
  expect(screen.queryByText(connectionFailureCodes.unknown)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Spróbuj ponownie' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Wróć' })).not.toBeInTheDocument();
});

it('shows the recorded connection diagnostics without sensitive player data', async () => {
  recordConnectionDiagnostic('transport.connect.failed', 'error', {
    errorType: 'peer-unavailable',
    reconnectToken: 'secret',
  });
  mocked.value = createValue();
  render(<ConnectionErrorScreen />);

  await userEvent.click(screen.getByText('Szczegóły diagnostyczne (1)'));

  expect(screen.getByLabelText('Log diagnostyczny połączenia')).toHaveTextContent('peer-unavailable');
  expect(screen.getByLabelText('Log diagnostyczny połączenia')).not.toHaveTextContent('secret');
});

it('shows a dedicated update-required screen without retry', async () => {
  mocked.value = createValue(connectionFailureCodes.unsupportedVersion);
  render(<ConnectionErrorScreen />);

  expect(screen.getByRole('heading', { name: 'Wersje gry nie są zgodne' })).toBeInTheDocument();
  expect(screen.getByText('Wersje gry nie są zgodne. Zaktualizuj aplikację i poproś prowadzącego o aktualizację.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Spróbuj ponownie' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Wróć do menu' }));
  expect(mocked.value.actions.cancel).toHaveBeenCalled();
});
