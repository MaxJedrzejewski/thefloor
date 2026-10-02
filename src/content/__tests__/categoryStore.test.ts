import { describe, it, expect, beforeEach } from 'vitest';
import { loadCategories, saveCustomCategory, deleteCustomCategory, CATEGORIES_KEY } from '../categoryStore';
import { BUNDLED_CATEGORIES } from '../bundled';
import { validateCategory, isPlayable, parseCategory, MIN_PROMPTS, type Category } from '../schema';

function customCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-custom',
    name: 'House Rules',
    source: 'custom',
    prompts: Array.from({ length: MIN_PROMPTS }, (_, i) => ({
      id: `c-${i}`,
      kind: 'text' as const,
      body: `Clue ${i}`,
      answer: `Answer ${i}`,
    })),
    ...overrides,
  };
}

beforeEach(() => localStorage.clear());

describe('bundled categories', () => {
  it('all parse and are playable out of the box', () => {
    expect(BUNDLED_CATEGORIES.length).toBeGreaterThan(0);
    for (const category of BUNDLED_CATEGORIES) {
      expect(validateCategory(category)).toEqual([]);
      expect(isPlayable(category)).toBe(true);
    }
  });

  it('have unique category ids', () => {
    const ids = BUNDLED_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('have unique prompt ids within each category', () => {
    for (const category of BUNDLED_CATEGORIES) {
      const ids = category.prompts.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('loadCategories', () => {
  it('returns the bundled categories when storage is empty', () => {
    const loaded = loadCategories();
    expect(Object.keys(loaded)).toHaveLength(BUNDLED_CATEGORIES.length);
  });

  it('ignores corrupt JSON and falls back to the bundled defaults', () => {
    localStorage.setItem(CATEGORIES_KEY, '{ not json at all');
    const loaded = loadCategories();
    expect(Object.keys(loaded)).toHaveLength(BUNDLED_CATEGORIES.length);
  });

  it('ignores stored entries that are not shaped like categories', () => {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify({ version: 1, categories: [42, null, 'nope'] }));
    const loaded = loadCategories();
    expect(Object.keys(loaded)).toHaveLength(BUNDLED_CATEGORIES.length);
  });
});

describe('saveCustomCategory', () => {
  it('round-trips a custom category through localStorage', () => {
    saveCustomCategory(customCategory());
    const loaded = loadCategories();
    expect(loaded['cat-custom']?.name).toBe('House Rules');
    expect(loaded['cat-custom']?.prompts).toHaveLength(MIN_PROMPTS);
  });

  it('keeps the bundled categories alongside custom ones', () => {
    saveCustomCategory(customCategory());
    const loaded = loadCategories();
    expect(Object.keys(loaded)).toHaveLength(BUNDLED_CATEGORIES.length + 1);
  });

  it('overwrites an existing custom category rather than duplicating it', () => {
    saveCustomCategory(customCategory());
    saveCustomCategory(customCategory({ name: 'Renamed' }));
    const loaded = loadCategories();
    expect(Object.keys(loaded)).toHaveLength(BUNDLED_CATEGORIES.length + 1);
    expect(loaded['cat-custom']?.name).toBe('Renamed');
  });

  it('stores an edited copy of a bundled category as a custom one', () => {
    const bundled = BUNDLED_CATEGORIES[0]!;
    saveCustomCategory({ ...bundled, source: 'custom', name: 'My Capitals' });
    expect(loadCategories()[bundled.id]?.name).toBe('My Capitals');
  });
});

describe('deleteCustomCategory', () => {
  it('removes a custom category', () => {
    saveCustomCategory(customCategory());
    deleteCustomCategory('cat-custom');
    expect(loadCategories()['cat-custom']).toBeUndefined();
  });

  it('restores the original when a customised bundled category is deleted', () => {
    const bundled = BUNDLED_CATEGORIES[0]!;
    saveCustomCategory({ ...bundled, source: 'custom', name: 'My Capitals' });
    deleteCustomCategory(bundled.id);
    expect(loadCategories()[bundled.id]?.name).toBe(bundled.name);
  });
});

describe('validateCategory', () => {
  it('accepts a well-formed category', () => {
    expect(validateCategory(customCategory())).toEqual([]);
  });

  it('rejects a category with no name', () => {
    const issues = validateCategory(customCategory({ name: '   ' }));
    expect(issues.some((i) => i.field === 'name')).toBe(true);
  });

  it('rejects a category with no prompts', () => {
    const issues = validateCategory(customCategory({ prompts: [] }));
    expect(issues.some((i) => i.field === 'prompts')).toBe(true);
  });

  it('rejects a prompt with a blank answer', () => {
    const category = customCategory();
    category.prompts[0] = { ...category.prompts[0]!, answer: '  ' };
    const issues = validateCategory(category);
    expect(issues.some((i) => i.field === 'prompts.0.answer')).toBe(true);
  });

  it('treats a thin but valid category as unplayable', () => {
    const thin = customCategory({ prompts: customCategory().prompts.slice(0, 3) });
    expect(validateCategory(thin)).toEqual([]);
    expect(isPlayable(thin)).toBe(false);
  });
});

describe('parseCategory', () => {
  it('assigns ids to prompts that are missing one', () => {
    const parsed = parseCategory(
      { id: 'x', name: 'X', prompts: [{ body: 'Q', answer: 'A' }] },
      'custom',
    );
    expect(parsed?.prompts[0]?.id).toBe('x-0');
  });

  it('drops prompts that are missing a body or answer', () => {
    const parsed = parseCategory(
      { id: 'x', name: 'X', prompts: [{ body: 'Q', answer: 'A' }, { body: 'Q2' }] },
      'custom',
    );
    expect(parsed?.prompts).toHaveLength(1);
  });

  it('returns null for something that is not a category at all', () => {
    expect(parseCategory({ nope: true }, 'custom')).toBeNull();
    expect(parseCategory(null, 'custom')).toBeNull();
  });
});
