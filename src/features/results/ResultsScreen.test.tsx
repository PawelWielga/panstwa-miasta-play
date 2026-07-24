import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ResultsScreen } from './ResultsScreen';
import { appActions, appState } from '../../test/fixtures';
const mocked = vi.hoisted(() => ({ value: {} as ReturnType<typeof createValue> }));
function createValue() { return { state: appState({ finalScores: { 'player-1': 20, host: 10 } }), actions: appActions() }; }
vi.mock('../../app/AppContext', () => ({ useApp: () => mocked.value }));
it('renders authoritative final ranking', () => {
  mocked.value = createValue(); render(<ResultsScreen final />);
  expect(screen.getByText('20 pkt')).toBeInTheDocument();
  expect(screen.getByText(/Wygrywa Ala/)).toBeInTheDocument();
});
