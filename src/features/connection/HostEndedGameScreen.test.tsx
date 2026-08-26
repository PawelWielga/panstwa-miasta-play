import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HostEndedGameScreen } from './HostEndedGameScreen';

const mocks = vi.hoisted(() => ({ returnToMain: vi.fn() }));
vi.mock('../../app/AppContext', () => ({ useApp: () => ({ actions: { returnToMain: mocks.returnToMain } }) }));

describe('HostEndedGameScreen', () => {
  beforeEach(() => mocks.returnToMain.mockReset());

  it('shows one clear return action', () => {
    render(<HostEndedGameScreen />);
    expect(screen.getByRole('heading', { name: 'Host zakończył rozgrywkę' })).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent('Wróć do ekranu głównego');
    fireEvent.click(buttons[0]);
    expect(mocks.returnToMain).toHaveBeenCalledTimes(1);
  });
});
