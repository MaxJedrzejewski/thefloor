import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoryEditorScreen } from '../CategoryEditorScreen';
import { loadCategories } from '../../../content/categoryStore';
import type { Category } from '../../../content/schema';

function renderEditor() {
  const onSave = vi.fn();
  const onDelete = vi.fn();
  const onDone = vi.fn();
  render(
    <CategoryEditorScreen
      categories={loadCategories()}
      onSave={onSave}
      onDelete={onDelete}
      onDone={onDone}
    />,
  );
  return { onSave, onDelete, onDone, user: userEvent.setup() };
}

describe('CategoryEditorScreen', () => {
  it('lists the bundled categories with their prompt counts', () => {
    renderEditor();
    expect(screen.getByRole('heading', { name: 'World Capitals' })).toBeInTheDocument();
    expect(screen.getAllByText(/prompts/).length).toBeGreaterThan(0);
  });

  it('does not offer to delete a built-in category', () => {
    renderEditor();
    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument();
  });

  it('creates a category with a prompt and saves it', async () => {
    const { onSave, user } = renderEditor();

    await user.click(screen.getByRole('button', { name: /new category/i }));
    await user.type(screen.getByLabelText(/category name/i), 'One-Hit Wonders');
    await user.type(screen.getByLabelText(/clue/i), 'Come On Eileen');
    await user.type(screen.getByLabelText(/answer/i), 'Dexys Midnight Runners');
    await user.click(screen.getByRole('button', { name: /save category/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0]![0] as Category;
    expect(saved.name).toBe('One-Hit Wonders');
    expect(saved.prompts).toHaveLength(1);
    expect(saved.prompts[0]).toMatchObject({
      body: 'Come On Eileen',
      answer: 'Dexys Midnight Runners',
    });
  });

  it('refuses to save a prompt with no answer', async () => {
    const { user } = renderEditor();

    await user.click(screen.getByRole('button', { name: /new category/i }));
    await user.type(screen.getByLabelText(/category name/i), 'Half Finished');
    await user.type(screen.getByLabelText(/clue/i), 'A question');

    expect(screen.getByText(/needs an answer/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save category/i })).toBeDisabled();
  });

  it('warns that a thin category cannot be used in a duel', async () => {
    const { user } = renderEditor();

    await user.click(screen.getByRole('button', { name: /new category/i }));
    expect(screen.getByText(/needs at least 12 prompts/i)).toBeInTheDocument();
  });

  it('adds and removes prompt rows', async () => {
    const { user } = renderEditor();

    await user.click(screen.getByRole('button', { name: /new category/i }));
    await user.click(screen.getByRole('button', { name: /add prompt/i }));
    expect(screen.getAllByLabelText(/clue/i)).toHaveLength(2);

    await user.click(screen.getAllByRole('button', { name: /remove/i })[0]!);
    expect(screen.getAllByLabelText(/clue/i)).toHaveLength(1);
  });

  it('switches a prompt to an image and offers a file picker', async () => {
    const { user } = renderEditor();

    await user.click(screen.getByRole('button', { name: /new category/i }));
    await user.click(screen.getByRole('button', { name: /use an image/i }));

    expect(screen.getByLabelText(/image for prompt 1/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/clue/i)).not.toBeInTheDocument();
  });

  it('lets an image prompt use a pasted link instead of a file', async () => {
    const { onSave, user } = renderEditor();

    await user.click(screen.getByRole('button', { name: /new category/i }));
    await user.click(screen.getByRole('button', { name: /use an image/i }));
    await user.click(screen.getByRole('button', { name: /paste a link/i }));

    expect(screen.queryByLabelText(/^image for prompt 1$/i)).not.toBeInTheDocument();
    const linkInput = screen.getByLabelText(/image link for prompt 1/i);
    await user.type(linkInput, 'https://example.com/photo.jpg');
    await user.type(screen.getByLabelText(/category name/i), 'Landmarks');
    await user.type(screen.getByLabelText(/answer/i), 'Eiffel Tower');
    await user.click(screen.getByRole('button', { name: /save category/i }));

    const saved = onSave.mock.calls[0]![0] as Category;
    expect(saved.prompts[0]).toMatchObject({
      kind: 'image',
      body: 'https://example.com/photo.jpg',
    });
  });

  it('loads an existing category into the form for editing', async () => {
    const { user } = renderEditor();

    const editButtons = screen.getAllByRole('button', { name: /^edit$/i });
    await user.click(editButtons[0]!);

    const bundled = Object.values(loadCategories()).sort((a, b) => a.name.localeCompare(b.name))[0]!;
    expect(screen.getByLabelText(/category name/i)).toHaveValue(bundled.name);
    expect(screen.getAllByLabelText(/answer/i)).toHaveLength(bundled.prompts.length);
  });

  it('returns to the tournament on Done', async () => {
    const { onDone, user } = renderEditor();
    await user.click(screen.getByRole('button', { name: /done/i }));
    expect(onDone).toHaveBeenCalled();
  });
});
