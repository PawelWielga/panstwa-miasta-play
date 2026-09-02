import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HostEndedGameScreen } from './HostEndedGameScreen';

const mocks = vi.hoisted(() => ({ returnToMain: vi.fn() }));
vi.mock('../../app/AppContext', () => ({ useApp: () => ({ state: { snapshot: null, players: [] }, actions: { returnToMain: mocks.returnToMain } }) }));

describe('HostEndedGameScreen', () => {
  beforeEach(() => mocks.returnToMain.mockReset());

  it('shows one clear return action', () => {
    render(<HostEndedGameScreen />);
    expect(screen.getByRole('heading', { name: 'Host zakończył rozgrywkę' })).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Wróć do ekranu głównego' });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(button);
    expect(mocks.returnToMain).toHaveBeenCalledTimes(1);
  });
});
