import { HISTORY_KEY, isGameDataKey, STORAGE_PREFIX } from '@pokeneuf/core';

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

/** Removes everything the game saved in this browser (the "reset" of the crash screen). */
export function clearGameData(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key !== null && isGameDataKey(key)) keys.push(key);
    }
    for (const key of keys) window.localStorage.removeItem(key);
  } catch {
    // Storage is unreachable: there is nothing to clear.
  }
}

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

/** The prefix of the demo grid's keys: inside the game's own namespace, so a reset clears them too. */
export const DEMO_PREFIX = `${STORAGE_PREFIX}demo:`;

/**
 * Storage for the demo grid: its progress and history live under their own keys
 * (`pokeneuf:v1:demo:game:1`), so playing the demo (grid n° 1) never touches the real grid n° 1 of
 * launch day. Settings and device id are shared.
 */
export function demoStorage(storage: KeyValueStorage): KeyValueStorage {
  const key = (name: string) =>
    name.startsWith(`${STORAGE_PREFIX}game:`) || name === HISTORY_KEY
      ? `${DEMO_PREFIX}${name.slice(STORAGE_PREFIX.length)}`
      : name;
  return {
    get: (name) => storage.get(key(name)),
    set: (name, value) => storage.set(key(name), value),
  };
}

/**
 * A random identifier for this device. `crypto.randomUUID` only exists in secure contexts (HTTPS,
 * localhost): over plain HTTP on a LAN, as in dev, it is missing, so fall back to
 * `getRandomValues` (available everywhere), formatted as a version 4 UUID.
 */
export function newDeviceId(cryptoImpl: Crypto = globalThis.crypto): string {
  if (typeof cryptoImpl.randomUUID === 'function') return cryptoImpl.randomUUID();
  const bytes = cryptoImpl.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40; // version 4
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}
