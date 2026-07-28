import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { JoinScreen } from './JoinScreen';
import { INCOMPATIBLE_GAME_VERSION_MESSAGE } from './joinParams';
import { appActions, appState } from '../../test/fixtures';

const mocked = vi.hoisted(() => ({ value: {} as ReturnType<typeof createValue> }));
function createValue() { return { state: appState(), actions: appActions() }; }
vi.mock('../../app/AppContext', () => ({ useApp: () => mocked.value }));

describe('JoinScreen', () => {
  it('submits the player nick and room code from a room-only invitation', async () => {
    mocked.value = createValue();
    render(<JoinScreen search="?room=ABC123" />);
    await userEvent.click(screen.getByRole('button', { name: 'Dołącz do gry' }));
    expect(mocked.value.actions.updateIdentity).toHaveBeenCalledWith({
      playerName: 'Ala',
      playerEmoji: '🦊',
      playerColor: '#6d4aff',
    });
    expect(mocked.value.actions.connect).toHaveBeenCalledWith({ roomId: 'ABC123' });
  });

  it('shows only the player nick and room code fields', () => {
    mocked.value = createValue();
    render(<JoinScreen search="?room=ABC123&peer=legacy-host&protocol=3" />);
    expect(screen.getByLabelText('Twój nick')).toBeInTheDocument();
    expect(screen.getByLabelText('Kod pokoju')).toBeInTheDocument();
    expect(screen.queryByText(/Identyfikator hosta PeerJS/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Wersja protokołu/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Wybierz emoji/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Wybierz kolor/i)).not.toBeInTheDocument();
  });

  it('shows host instructions instead of the join form when online play is disabled', () => {
    mocked.value = createValue();
    render(<JoinScreen search="?room=ABC123&online=disabled" />);

    expect(screen.getByRole('heading', { name: 'Host musi włączyć dołączanie online' })).toBeInTheDocument();
    expect(screen.getByText(/Dołączanie przez internet \(Peer\)/i)).toBeInTheDocument();
    expect(screen.getByText(/ABC123/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dołącz do gry' })).not.toBeInTheDocument();
    expect(mocked.value.actions.connect).not.toHaveBeenCalled();
  });

  it('blocks an incompatible legacy invitation without exposing a protocol field', async () => {
    mocked.value = createValue();
    render(<JoinScreen search="?room=ABC123&protocol=999" />);
    expect(screen.getByText(INCOMPATIBLE_GAME_VERSION_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Wersja protokołu/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dołącz do gry' }));
    expect(mocked.value.actions.connect).not.toHaveBeenCalled();
  });
});
