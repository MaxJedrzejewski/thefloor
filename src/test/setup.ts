import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * Node 26 declares a global `localStorage` that stays undefined unless the runtime
 * was started with --localstorage-file, and that declaration shadows the jsdom
 * implementation on both `globalThis` and `window`. Install a spec-shaped
 * in-memory Storage so the persistence layer has somewhere real to write.
 */
class MemoryStorage implements Storage {
  #entries = new Map<string, string>();

  get length(): number {
    return this.#entries.size;
  }

  key(index: number): string | null {
    return [...this.#entries.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    return this.#entries.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.#entries.set(key, String(value));
  }

  removeItem(key: string): void {
    this.#entries.delete(key);
  }

  clear(): void {
    this.#entries.clear();
  }

  [name: string]: unknown;
}

if (globalThis.localStorage == null) {
  const storage = new MemoryStorage();
  for (const target of [globalThis, window]) {
    Object.defineProperty(target, 'localStorage', {
      value: storage,
      configurable: true,
      writable: true,
    });
  }
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});
