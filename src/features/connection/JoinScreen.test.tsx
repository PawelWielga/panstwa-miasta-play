import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JoinScreen } from './JoinScreen';
import { INCOMPATIBLE_GAME_VERSION_MESSAGE } from './joinParams';
import { appActions, appState, joinParameters, testOnlineJoinCode } from '../../test/fixtures';

const mocked = vi.hoisted(() => ({ value: {} as ReturnType<typeof createValue> }));
function createValue() { return { state: appState(), actions: appActions() }; }
vi.mock('../../app/AppContext', () => ({ useApp: () => mocked.value }));

describe('JoinScreen', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });
  it('submits the player nick and authenticated online credentials', async () => {
    mocked.value = createValue();
    render(<JoinScreen search={`?code=${testOnlineJoinCode}&protocol=4`} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dołącz do gry' }));
    expect(mocked.value.actions.updateIdentity).toHaveBeenCalled();
    expect(mocked.value.actions.connect).toHaveBeenCalledWith(joinParameters);
  });



  it('removes the join secret from browser history after validated submit', async () => {
    mocked.value = createValue();
    window.history.replaceState(
      { source: 'test' },
      '',
      `/?lang=pl&code=${testOnlineJoinCode}&protocol=4&peer=legacy#lobby`,
    );

    render(<JoinScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Dołącz do gry' }));

    expect(window.location.pathname).toBe('/');
    expect(window.location.search).toBe('?lang=pl');
    expect(window.location.hash).toBe('#lobby');
    expect(window.location.href).not.toContain(testOnlineJoinCode);
    expect(mocked.value.actions.connect).toHaveBeenCalledWith(joinParameters);
  });

  it('shows only the player nick and one join code field', () => {
    mocked.value = createValue();
    render(<JoinScreen search={`?code=${testOnlineJoinCode}&protocol=4`} />);
    expect(screen.getByLabelText('Twój nick')).toBeInTheDocument();
    expect(screen.getByLabelText('Kod dołączenia')).toBeInTheDocument();
    expect(screen.queryByText(/Identyfikator hosta PeerJS/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Wersja protokołu/i)).not.toBeInTheDocument();
  });

  it('shows host instructions when online play is disabled', () => {
    mocked.value = createValue();
    render(<JoinScreen search="?room=ABC123&online=disabled" />);
    expect(screen.getByRole('heading', { name: 'Host musi włączyć dołączanie online' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dołącz do gry' })).not.toBeInTheDocument();
  });

  it('blocks a legacy invitation without fallback', async () => {
    mocked.value = createValue();
    render(<JoinScreen search="?room=ABC123&protocol=3" />);
    expect(screen.getByText(INCOMPATIBLE_GAME_VERSION_MESSAGE)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dołącz do gry' }));
    expect(mocked.value.actions.connect).not.toHaveBeenCalled();
  });
});
