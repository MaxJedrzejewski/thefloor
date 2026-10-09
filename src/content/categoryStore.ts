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
 * bundled category overrides its name and the prompts it already had, and
 * deleting the edit restores it. Prompts that exist only in the bundled file
 * (added to the JSON after the edit was saved) are always merged back in, so
 * a stale browser copy never hides them.
 */
export function loadCategories(): CategoryIndex {
  const index: CategoryIndex = {};
  for (const category of BUNDLED_CATEGORIES) index[category.id] = category;
  for (const category of readCustom()) {
    const bundled = index[category.id];
    if (bundled?.source === 'bundled' && (category.revision ?? 0) < (bundled.revision ?? 0)) {
      // The file was rewritten since this copy was saved: its bundled prompts are obsolete, but
      // anything the host added themselves (ids from newPromptId) is theirs to keep.
      const own = category.prompts.filter((p) => p.id.startsWith('pr_'));
      index[category.id] = { ...category, prompts: [...bundled.prompts, ...own] };
      if (bundled.revision !== undefined) index[category.id]!.revision = bundled.revision;
    } else if (bundled?.source === 'bundled') {
      const bundledIds = new Set(bundled.prompts.map((p) => p.id));
      // A picture shipped in /images that left the JSON is gone from disk too, so a stale
      // copy still pointing at it would render as a broken image. Uploads are data URLs.
      // A blank body is just as unusable, so those go too (or snap back to the bundled prompt).
      const bundledById = new Map(bundled.prompts.map((p) => [p.id, p]));
      const kept = category.prompts
        .map((p) => (!p.body.trim() && bundledById.has(p.id) ? bundledById.get(p.id)! : p))
        .filter((p) => {
          if (bundledIds.has(p.id)) return true;
          return p.body.trim() !== '' && !(p.kind === 'image' && p.body.startsWith('/images/'));
        });
      const known = new Set(kept.map((p) => p.id));
      const fromFile = bundled.prompts.filter((p) => !known.has(p.id));
      index[category.id] = { ...category, prompts: [...kept, ...fromFile] };
    } else {
      index[category.id] = category;
    }
  }
  return index;
}

export function saveCustomCategory(category: Category): void {
  const bundledRevision = BUNDLED_CATEGORIES.find((c) => c.id === category.id)?.revision;
  const stored: Category = { ...category, source: 'custom' };
  if (bundledRevision !== undefined) stored.revision = bundledRevision;
  const others = readCustom().filter((c) => c.id !== category.id);
  writeCustom([...others, stored]);
}

export function deleteCustomCategory(id: string): void {
  writeCustom(readCustom().filter((c) => c.id !== id));
}
