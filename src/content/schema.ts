import type { Prompt } from '../engine/duel/types';

export const MIN_PROMPTS = 12;
export const COMFORTABLE_PROMPTS = 30;

export interface Category {
  id: string;
  name: string;
  /** Bundled categories ship with the app and cannot be deleted. */
  source: 'bundled' | 'custom';
  prompts: Prompt[];
}

export type CategoryIndex = Record<string, Category>;

export interface ValidationIssue {
  field: string;
  message: string;
}

export function validateCategory(category: Category): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!category.name.trim()) {
    issues.push({ field: 'name', message: 'Give the category a name.' });
  }

  if (category.prompts.length === 0) {
    issues.push({ field: 'prompts', message: 'Add at least one prompt.' });
  }

  category.prompts.forEach((prompt, i) => {
    if (!prompt.body.trim()) {
      const what = prompt.kind === 'image' ? 'an image' : 'a question';
      issues.push({ field: `prompts.${i}.body`, message: `Prompt ${i + 1} needs ${what}.` });
    }
    if (!prompt.answer.trim()) {
      issues.push({ field: `prompts.${i}.answer`, message: `Prompt ${i + 1} needs an answer.` });
    }
  });

  return issues;
}

/** A category too thin to run a duel on will keep recycling the same clues. */
export function isPlayable(category: Category): boolean {
  return validateCategory(category).length === 0 && category.prompts.length >= MIN_PROMPTS;
}

export function promptCountWarning(category: Category): string | null {
  const count = category.prompts.length;
  if (count < MIN_PROMPTS) {
    return `Needs at least ${MIN_PROMPTS} prompts to be used in a duel (has ${count}).`;
  }
  if (count < COMFORTABLE_PROMPTS) {
    return `${count} prompts will work, but ${COMFORTABLE_PROMPTS}+ keeps clues from repeating.`;
  }
  return null;
}

/** Narrow unknown parsed JSON into a Category, repairing what can be repaired. */
export function parseCategory(raw: unknown, source: Category['source']): Category | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== 'string' || typeof obj.name !== 'string') return null;
  if (!Array.isArray(obj.prompts)) return null;

  const prompts: Prompt[] = [];
  obj.prompts.forEach((entry, i) => {
    if (typeof entry !== 'object' || entry === null) return;
    const p = entry as Record<string, unknown>;
    if (typeof p.body !== 'string' || typeof p.answer !== 'string') return;
    const prompt: Prompt = {
      id: typeof p.id === 'string' && p.id ? p.id : `${obj.id as string}-${i}`,
      kind: p.kind === 'image' ? 'image' : 'text',
      body: p.body,
      answer: p.answer,
    };
    if (typeof p.alt === 'string') prompt.alt = p.alt;
    prompts.push(prompt);
  });

  return { id: obj.id, name: obj.name, source, prompts };
}

export function newPromptId(): string {
  return `pr_${Math.random().toString(36).slice(2, 10)}`;
}

export function newCategoryId(): string {
  return `cat_${Math.random().toString(36).slice(2, 10)}`;
}
