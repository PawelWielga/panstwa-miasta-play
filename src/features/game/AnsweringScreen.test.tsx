import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { AnsweringScreen } from './AnsweringScreen';
import { appActions, appState } from '../../test/fixtures';
const mocked = vi.hoisted(() => ({ value: {} as ReturnType<typeof createValue> }));
function createValue() { return { state: appState(), actions: appActions() }; }
vi.mock('../../app/AppContext', () => ({ useApp: () => mocked.value }));
it('collects category answers and submits them', async () => {
  mocked.value = createValue(); render(<AnsweringScreen />);
  await userEvent.type(screen.getByLabelText('Miasto'), 'Augustów');
  expect(mocked.value.actions.setAnswer).toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Wyślij odpowiedzi' }));
  expect(mocked.value.actions.submitAnswers).toHaveBeenCalled();
});

it('renders 100 categories and keeps Enter navigation available', async () => {
  const categories = Array.from({ length: 100 }, (_, index) => ({
    id: `category-${String(index + 1)}`,
    name: `Kategoria ${String(index + 1)}`,
    order: index,
  }));
  mocked.value = {
    state: appState({ categories }),
    actions: appActions(),
  };
  render(<AnsweringScreen />);

  const inputs = screen.getAllByRole('textbox');
  expect(inputs).toHaveLength(100);
  expect(screen.getByLabelText('Kategoria 100')).toBeInTheDocument();

  inputs[0].focus();
  await userEvent.keyboard('{Enter}');
  expect(inputs[1]).toHaveFocus();
});
