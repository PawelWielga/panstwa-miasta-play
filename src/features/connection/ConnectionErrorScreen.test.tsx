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

it('maps an unreachable host to canonical copy and retry', async () => {
  mocked.value = createValue('Brak aktywnego pokoju o podanym kodzie. Sprawdź kod albo poproś prowadzącego o utworzenie pokoju.');
  render(<ConnectionErrorScreen />);

  expect(screen.getByText('Nie znaleziono pokoju. Sprawdź, czy prowadzący nadal go udostępnia i spróbuj ponownie.')).toBeInTheDocument();
  expect(screen.queryByText('Brak aktywnego pokoju o podanym kodzie. Sprawdź kod albo poproś prowadzącego o utworzenie pokoju.')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
  expect(mocked.value.actions.retry).toHaveBeenCalled();
  expect(mocked.value.actions.cancel).not.toHaveBeenCalled();
});

it('asks for the code again when the invitation is invalid', async () => {
  mocked.value = createValue('Kod pokoju jest nieprawidłowy.');
  render(<ConnectionErrorScreen />);

  expect(screen.getByText('Kod lub dane pokoju są nieprawidłowe. Poproś prowadzącego o aktualny kod.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Wpisz kod ponownie' }));
  expect(mocked.value.actions.cancel).toHaveBeenCalled();
  expect(mocked.value.actions.retry).not.toHaveBeenCalled();
});

it('maps a timeout to retry with the same room code', async () => {
  mocked.value = createValue('Telefon prowadzącego nie odpowiedział na czas. Sprawdź, czy aplikacja prowadzącego nadal działa, i spróbuj ponownie.');
  render(<ConnectionErrorScreen />);

  expect(screen.getByText('Połączenie trwało zbyt długo. Sprawdź sieć i spróbuj ponownie.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
  expect(mocked.value.actions.retry).toHaveBeenCalled();
});

it('maps blocked P2P to the change-network recovery', async () => {
  mocked.value = createValue('Ta sieć blokuje bezpośrednie połączenie z telefonem prowadzącego. Spróbuj innej sieci Wi‑Fi lub komórkowej albo wyłącz VPN.');
  render(<ConnectionErrorScreen />);

  expect(screen.getByText('Nie udało się połączyć przez tę sieć. Użyj innej sieci albo hotspotu.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Użyj innej sieci' }));
  expect(mocked.value.actions.cancel).toHaveBeenCalled();
  expect(mocked.value.actions.retry).not.toHaveBeenCalled();
});

it('maps a full room to returning to the join screen', async () => {
  mocked.value = createValue('Pokój jest pełny. Host ustawił limit graczy dla tej rozgrywki.');
  render(<ConnectionErrorScreen />);

  expect(screen.getByText('Pokój jest pełny. Prowadzący ustawił limit graczy.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Wróć do menu' }));
  expect(mocked.value.actions.cancel).toHaveBeenCalled();
});

it('maps a started game to entering a new code', async () => {
  mocked.value = createValue('Gra już się rozpoczęła. Poproś hosta o nowy pokój albo spróbuj później.');
  render(<ConnectionErrorScreen />);

  expect(screen.getByText('Gra już się rozpoczęła. Poproś prowadzącego o nowy pokój.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Wpisz kod ponownie' }));
  expect(mocked.value.actions.cancel).toHaveBeenCalled();
});

it('maps an exhausted reconnect to retry without leaking the raw diagnostic', async () => {
  mocked.value = createValue('Automatyczne ponowne łączenie nie powiodło się.');
  render(<ConnectionErrorScreen />);

  expect(screen.getByText('Połączenie zostało przerwane. Spróbuj ponownie.')).toBeInTheDocument();
  expect(screen.queryByText('Automatyczne ponowne łączenie nie powiodło się.')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
  expect(mocked.value.actions.retry).toHaveBeenCalled();
});

it('falls back to safe generic copy for an unknown technical error', () => {
  mocked.value = createValue('Host wysłał niepoprawne dane: invalid payload shape');
  render(<ConnectionErrorScreen />);

  expect(screen.getByText('Nie udało się dołączyć. Spróbuj ponownie albo poproś prowadzącego o aktualny kod.')).toBeInTheDocument();
  expect(screen.queryByText(/invalid payload shape/i)).not.toBeInTheDocument();
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
  mocked.value = createValue(HOST_VERSION_UNSUPPORTED_MESSAGE);
  render(<ConnectionErrorScreen />);

  expect(screen.getByRole('heading', { name: 'Prowadzący musi zaktualizować grę' })).toBeInTheDocument();
  expect(screen.getByText(HOST_VERSION_UNSUPPORTED_MESSAGE)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Spróbuj ponownie' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Wróć do menu' }));
  expect(mocked.value.actions.cancel).toHaveBeenCalled();
});
