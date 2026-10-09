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

describe('bundled prompts added after an edit was saved', () => {
  it('still shows up in a customised bundled category', () => {
    const bundled = BUNDLED_CATEGORIES[0]!;
    const stale = { ...bundled, source: 'custom' as const, prompts: bundled.prompts.slice(1) };
    saveCustomCategory(stale);
    const loaded = loadCategories()[bundled.id]!;
    expect(loaded.prompts).toHaveLength(bundled.prompts.length);
    expect(loaded.prompts.map((p) => p.id)).toContain(bundled.prompts[0]!.id);
  });
});

describe('stale copy of a bundled category', () => {
  it('drops shipped images that no longer exist but keeps uploads', () => {
    const bundled = BUNDLED_CATEGORIES[0]!;
    const gone = { id: 'gone', kind: 'image' as const, body: '/images/removed.jpg', answer: 'x' };
    const upload = { id: 'up', kind: 'image' as const, body: 'data:image/png;base64,AAAA', answer: 'y' };
    const blank = { id: 'blank', kind: 'image' as const, body: '', answer: 'z' };
    saveCustomCategory({ ...bundled, source: 'custom', prompts: [...bundled.prompts, gone, blank, upload] });
    const ids = loadCategories()[bundled.id]!.prompts.map((p) => p.id);
    expect(ids).not.toContain('gone');
    expect(ids).not.toContain('blank');
    expect(ids).toContain('up');
  });
});

describe('copy saved before a bundled category was rewritten', () => {
  it('yields to the file but keeps prompts the host created', () => {
    const bundled = BUNDLED_CATEGORIES.find((c) => (c.revision ?? 0) > 0)!;
    const oldText = { id: 'eq-1', kind: 'text' as const, body: '5 + 5', answer: '10' };
    const mine = { id: 'pr_mine', kind: 'text' as const, body: 'Moje', answer: 'tak' };
    const payload = { version: 1, categories: [{ ...bundled, source: 'custom', revision: undefined, prompts: [oldText, mine] }] };
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(payload));
    const ids = loadCategories()[bundled.id]!.prompts.map((p) => p.id);
    expect(ids).not.toContain('eq-1');
    expect(ids).toContain('pr_mine');
    expect(ids).toHaveLength(bundled.prompts.length + 1);
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
