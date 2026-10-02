import { memo } from 'react';
import type { Prompt } from '../../engine/duel/types';

interface Props {
  prompt: Prompt | null;
  categoryName: string;
}

/** Longer clues get smaller type, so the box stays full without overflowing. */
function sizeClass(body: string): string {
  if (body.length <= 24) return 'xl';
  if (body.length <= 60) return 'lg';
  if (body.length <= 120) return 'md';
  return 'sm';
}

export const PromptStage = memo(function PromptStage({ prompt, categoryName }: Props) {
  if (!prompt) {
    return (
      <div className="prompt-stage" data-testid="prompt-stage">
        <p className="prompt-empty">Shuffling more clues…</p>
      </div>
    );
  }

  if (prompt.kind === 'image') {
    return (
      <div className="prompt-stage" data-testid="prompt-stage">
        <img className="prompt-image" src={prompt.body} alt={prompt.alt ?? `${categoryName} clue`} />
      </div>
    );
  }

  return (
    <div className="prompt-stage" data-testid="prompt-stage">
      <p className={`prompt-text size-${sizeClass(prompt.body)}`}>{prompt.body}</p>
    </div>
  );
});
