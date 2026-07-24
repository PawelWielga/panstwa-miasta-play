import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { JoinScreen } from './JoinScreen';
import { appActions, appState } from '../../test/fixtures';

const mocked = vi.hoisted(() => ({ value: {} as ReturnType<typeof createValue> }));
function createValue() { return { state: appState(), actions: appActions() }; }
vi.mock('../../app/AppContext', () => ({ useApp: () => mocked.value }));

describe('JoinScreen', () => {
  it('submits profile and invitation data', async () => {
    mocked.value = createValue();
    render(<JoinScreen search="?room=ABC234&peer=host-peer&protocol=3" />);
    await userEvent.click(screen.getByRole('button', { name: 'Dołącz do gry' }));
    expect(mocked.value.actions.updateIdentity).toHaveBeenCalled();
    expect(mocked.value.actions.connect).toHaveBeenCalledWith({ roomId: 'ABC234', hostPeerId: 'host-peer', protocolVersion: 3 });
  });
});
