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
