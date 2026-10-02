import { BUNDLED_CATEGORIES } from './bundled';
import { parseCategory, type Category, type CategoryIndex } from './schema';

export const CATEGORIES_KEY = 'thefloor.categories.v1';

interface StoredShape {
  version: 1;
  categories: unknown[];
}

function readCustom(): Category[] {
  const raw = localStorage.getItem(CATEGORIES_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as Partial<StoredShape>;
    if (!Array.isArray(parsed.categories)) return [];
    return parsed.categories
      .map((entry) => parseCategory(entry, 'custom'))
      .filter((c): c is Category => c !== null);
  } catch {
    // Corrupt storage should cost the host their edits, not the whole app.
    return [];
  }
}

function writeCustom(categories: Category[]): void {
  const payload: StoredShape = { version: 1, categories };
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(payload));
}

/**
 * Bundled categories first, then custom ones layered on top — so editing a
 * bundled category shadows the original, and deleting the edit restores it.
 */
export function loadCategories(): CategoryIndex {
  const index: CategoryIndex = {};
  for (const category of BUNDLED_CATEGORIES) index[category.id] = category;
  for (const category of readCustom()) index[category.id] = category;
  return index;
}

export function saveCustomCategory(category: Category): void {
  const stored = { ...category, source: 'custom' as const };
  const others = readCustom().filter((c) => c.id !== category.id);
  writeCustom([...others, stored]);
}

export function deleteCustomCategory(id: string): void {
  writeCustom(readCustom().filter((c) => c.id !== id));
}
