import { HISTORY_KEY, STORAGE_PREFIX } from '@pokeneuf/core';

/** Thin `localStorage` wrapper: storage can be missing or throw (private mode, quota), never crash. */
export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export const browserStorage: KeyValueStorage = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // The game still works, it just will not survive a refresh.
    }
  },
};

export function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get: (key) => data.get(key) ?? null,
    set: (key, value) => void data.set(key, value),
  };
}

/**
 * Storage for the demo grid: its progress and history live under their own keys, so playing the
 * demo (grid n° 1) never touches the real grid n° 1 of launch day. Settings and device id are shared.
 */
export function demoStorage(storage: KeyValueStorage): KeyValueStorage {
  const key = (name: string) =>
    name.startsWith(`${STORAGE_PREFIX}game:`) || name === HISTORY_KEY ? `demo:${name}` : name;
  return {
    get: (name) => storage.get(key(name)),
    set: (name, value) => storage.set(key(name), value),
  };
}
