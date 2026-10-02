import { useState } from 'react';
import {
  newCategoryId,
  newPromptId,
  promptCountWarning,
  validateCategory,
  type Category,
  type CategoryIndex,
} from '../../content/schema';
import { fileToDataUrl } from '../../content/imageUtils';
import type { Prompt } from '../../engine/duel/types';

interface Props {
  categories: CategoryIndex;
  onSave: (category: Category) => void;
  onDelete: (id: string) => void;
  onDone: () => void;
}

function blankCategory(): Category {
  return {
    id: newCategoryId(),
    name: '',
    source: 'custom',
    prompts: [{ id: newPromptId(), kind: 'text', body: '', answer: '' }],
  };
}

type ImageSource = 'upload' | 'link';

export function CategoryEditorScreen({ categories, onSave, onDelete, onDone }: Props) {
  const [draft, setDraft] = useState<Category | null>(null);
  const [imageNote, setImageNote] = useState<string | null>(null);
  const [imageSources, setImageSources] = useState<Record<string, ImageSource>>({});

  const list = Object.values(categories).sort((a, b) => a.name.localeCompare(b.name));
  const issues = draft ? validateCategory(draft) : [];

  const updatePrompt = (index: number, patch: Partial<Prompt>) =>
    setDraft((prev) =>
      prev
        ? { ...prev, prompts: prev.prompts.map((p, i) => (i === index ? { ...p, ...patch } : p)) }
        : prev,
    );

  const pickImage = async (index: number, file: File) => {
    const { dataUrl, error } = await fileToDataUrl(file);
    setImageNote(error);
    if (dataUrl) updatePrompt(index, { kind: 'image', body: dataUrl });
  };

  const imageSourceFor = (prompt: Prompt): ImageSource =>
    imageSources[prompt.id] ?? (/^https?:\/\//i.test(prompt.body) ? 'link' : 'upload');

  if (!draft) {
    return (
      <div className="screen editor-screen">
        <header className="screen-header row">
          <h1>Categories</h1>
          <button type="button" className="button ghost small" onClick={onDone}>
            Done
          </button>
        </header>

        <ul className="category-list">
          {list.map((category) => {
            const warning = promptCountWarning(category);
            return (
              <li key={category.id} className="panel category-row">
                <div>
                  <h2>{category.name}</h2>
                  <p className="muted">
                    {category.prompts.length} prompts
                    {category.source === 'bundled' ? ' · built in' : ' · yours'}
                  </p>
                  {warning && <p className="warning">{warning}</p>}
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    className="button small"
                    onClick={() => setDraft({ ...category, source: 'custom' })}
                  >
                    Edit
                  </button>
                  {category.source === 'custom' && (
                    <button
                      type="button"
                      className="button ghost small"
                      onClick={() => onDelete(category.id)}
                    >
                      {categories[category.id]?.id.startsWith('bundled-') ? 'Reset' : 'Delete'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <button type="button" className="button primary" onClick={() => setDraft(blankCategory())}>
          New category
        </button>
      </div>
    );
  }

  return (
    <div className="screen editor-screen">
      <header className="screen-header row">
        <h1>{draft.name || 'New category'}</h1>
        <button type="button" className="button ghost small" onClick={() => setDraft(null)}>
          Cancel
        </button>
      </header>

      <section className="panel">
        <label className="field">
          <span>Category name</span>
          <input
            type="text"
            value={draft.name}
            placeholder="e.g. One-Hit Wonders"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        {promptCountWarning(draft) && <p className="warning">{promptCountWarning(draft)}</p>}
      </section>

      <ol className="prompt-list">
        {draft.prompts.map((prompt, i) => (
          <li key={prompt.id} className="panel prompt-row">
            <div className="prompt-row-head">
              <span className="muted">Prompt {i + 1}</span>
              <div className="row-actions">
                <button
                  type="button"
                  className="button ghost small"
                  onClick={() =>
                    updatePrompt(i, { kind: prompt.kind === 'text' ? 'image' : 'text', body: '' })
                  }
                >
                  {prompt.kind === 'text' ? 'Use an image' : 'Use text'}
                </button>
                {draft.prompts.length > 1 && (
                  <button
                    type="button"
                    className="button ghost small"
                    onClick={() =>
                      setDraft({ ...draft, prompts: draft.prompts.filter((_, j) => j !== i) })
                    }
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {prompt.kind === 'text' ? (
              <label className="field">
                <span>Clue</span>
                <textarea
                  rows={2}
                  value={prompt.body}
                  placeholder="What is the capital of Peru?"
                  onChange={(e) => updatePrompt(i, { body: e.target.value })}
                />
              </label>
            ) : (
              <div className="field">
                <div className="prompt-row-head">
                  <span>Image</span>
                  <div className="row-actions">
                    <button
                      type="button"
                      className={`button ghost small ${imageSourceFor(prompt) === 'upload' ? 'is-active' : ''}`}
                      onClick={() => setImageSources((prev) => ({ ...prev, [prompt.id]: 'upload' }))}
                    >
                      Upload from device
                    </button>
                    <button
                      type="button"
                      className={`button ghost small ${imageSourceFor(prompt) === 'link' ? 'is-active' : ''}`}
                      onClick={() => setImageSources((prev) => ({ ...prev, [prompt.id]: 'link' }))}
                    >
                      Paste a link
                    </button>
                  </div>
                </div>

                {imageSourceFor(prompt) === 'upload' ? (
                  <input
                    key="upload"
                    type="file"
                    accept="image/*"
                    aria-label={`Image for prompt ${i + 1}`}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void pickImage(i, file);
                    }}
                  />
                ) : (
                  <input
                    key="link"
                    type="text"
                    aria-label={`Image link for prompt ${i + 1}`}
                    placeholder="https://example.com/photo.jpg"
                    value={prompt.body}
                    onChange={(e) => updatePrompt(i, { kind: 'image', body: e.target.value })}
                  />
                )}
                {prompt.body && <img className="prompt-thumb" src={prompt.body} alt="" />}
              </div>
            )}

            <label className="field">
              <span>Answer (shown to the judge)</span>
              <input
                type="text"
                value={prompt.answer}
                placeholder="Lima"
                onChange={(e) => updatePrompt(i, { answer: e.target.value })}
              />
            </label>
          </li>
        ))}
      </ol>

      {imageNote && <p className="warning">{imageNote}</p>}

      <button
        type="button"
        className="button"
        onClick={() =>
          setDraft({
            ...draft,
            prompts: [...draft.prompts, { id: newPromptId(), kind: 'text', body: '', answer: '' }],
          })
        }
      >
        Add prompt
      </button>

      {issues.length > 0 && (
        <ul className="issue-list">
          {issues.map((issue) => (
            <li key={issue.field} className="error">
              {issue.message}
            </li>
          ))}
        </ul>
      )}

      <div className="actions">
        <button
          type="button"
          className="button primary"
          disabled={issues.length > 0}
          onClick={() => {
            onSave(draft);
            setDraft(null);
          }}
        >
          Save category
        </button>
      </div>
    </div>
  );
}
