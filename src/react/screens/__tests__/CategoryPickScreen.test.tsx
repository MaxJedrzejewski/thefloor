import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoryPickScreen } from '../CategoryPickScreen';
import type { Category } from '../../../content/schema';

const categories: Category[] = [
  { id: 'a', name: 'Fruits', source: 'custom', prompts: [] },
  { id: 'b', name: 'Cars', source: 'custom', prompts: [] },
];

function renderPick() {
  const onPick = vi.fn();
  const onBack = vi.fn();
  render(
    <CategoryPickScreen
      roundLabel="Semifinal"
      playerNames={['Ann', 'Bob']}
      categories={categories}
      onPick={onPick}
      onBack={onBack}
    />,
  );
  return { onPick, onBack };
}

describe('CategoryPickScreen', () => {
  it('lists the categories it is given', () => {
    renderPick();
    expect(screen.getByRole('button', { name: 'Fruits' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cars' })).toBeInTheDocument();
  });

  it('reports the category the host clicks', async () => {
    const { onPick } = renderPick();
    await userEvent.click(screen.getByRole('button', { name: 'Cars' }));
    expect(onPick).toHaveBeenCalledWith('b');
  });

  it('goes back to the bracket', async () => {
    const { onBack } = renderPick();
    await userEvent.click(screen.getByRole('button', { name: /back to bracket/i }));
    expect(onBack).toHaveBeenCalled();
  });
});
