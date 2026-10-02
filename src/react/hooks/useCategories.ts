import { useCallback, useState } from 'react';
import { loadCategories, saveCustomCategory, deleteCustomCategory } from '../../content/categoryStore';
import type { Category, CategoryIndex } from '../../content/schema';

export function useCategories() {
  const [categories, setCategories] = useState<CategoryIndex>(() => loadCategories());

  const save = useCallback((category: Category) => {
    saveCustomCategory(category);
    setCategories(loadCategories());
  }, []);

  const remove = useCallback((id: string) => {
    deleteCustomCategory(id);
    setCategories(loadCategories());
  }, []);

  return { categories, save, remove };
}
