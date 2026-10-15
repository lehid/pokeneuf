import { gameKey, HISTORY_KEY, SETTINGS_KEY } from '@pokeneuf/core';
import { afterEach, describe, expect, it } from 'vitest';
import { browserStorage, clearGameData, demoStorage, memoryStorage, newDeviceId } from './storage';

describe('demoStorage', () => {
  it('keeps the demo game and history apart, inside the game namespace', () => {
    const real = memoryStorage();
    const demo = demoStorage(real);
    demo.set(gameKey(1), 'demo game');
    demo.set(HISTORY_KEY, 'demo history');
    demo.set(SETTINGS_KEY, 'shared');
    expect([...real.data.keys()].sort()).toEqual([
      'pokeneuf:v1:demo:game:1',
      'pokeneuf:v1:demo:history',
      'pokeneuf:v1:settings',
    ]);
    expect(real.get(gameKey(1))).toBeNull();
    expect(demo.get(gameKey(1))).toBe('demo game');
    expect(demo.get(SETTINGS_KEY)).toBe('shared');
  });
});

describe('clearGameData', () => {
  afterEach(() => window.localStorage.clear());

  it('removes every key of the game, demo included, and nothing else', () => {
    window.localStorage.setItem(gameKey(2), 'x');
    window.localStorage.setItem(HISTORY_KEY, 'x');
    window.localStorage.setItem('pokeneuf:v1:demo:game:1', 'x');
    window.localStorage.setItem('unrelated', 'keep');
    clearGameData();
    expect(window.localStorage.length).toBe(1);
    expect(browserStorage.get('unrelated')).toBe('keep');
  });
});

describe('newDeviceId', () => {
  it('uses randomUUID where the browser has it', () => {
    const fake = { randomUUID: () => 'from-randomUUID' } as unknown as Crypto;
    expect(newDeviceId(fake)).toBe('from-randomUUID');
  });

  it('falls back to getRandomValues in an insecure context (no randomUUID)', () => {
    const fake = {
      getRandomValues: (array: Uint8Array) => {
        array.fill(0xff);
        return array;
      },
    } as unknown as Crypto;
    expect(newDeviceId(fake)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('makes a different identifier each time', () => {
    const real = globalThis.crypto;
    const withoutUuid = { getRandomValues: real.getRandomValues.bind(real) } as unknown as Crypto;
    expect(newDeviceId(withoutUuid)).not.toBe(newDeviceId(withoutUuid));
  });
});
