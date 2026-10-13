import { describe, expect, it, vi } from 'vitest';
import { shareResult } from './share';

describe('shareResult', () => {
  it('uses the native share sheet when there is one', async () => {
    const share = vi.fn(async () => undefined);
    const writeText = vi.fn(async () => undefined);
    expect(await shareResult('hello', { share, writeText })).toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: 'hello' });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('copies to the clipboard otherwise', async () => {
    const writeText = vi.fn(async () => undefined);
    expect(await shareResult('hello', { writeText })).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('falls back to the clipboard when the share sheet fails', async () => {
    const share = vi.fn(async () => Promise.reject(new TypeError('not allowed')));
    const writeText = vi.fn(async () => undefined);
    expect(await shareResult('hello', { share, writeText })).toBe('copied');
  });

  it('does not copy anything when the player cancels the share sheet', async () => {
    const share = vi.fn(async () => Promise.reject(new DOMException('cancelled', 'AbortError')));
    const writeText = vi.fn(async () => undefined);
    expect(await shareResult('hello', { share, writeText })).toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('reports a failure when nothing works', async () => {
    expect(await shareResult('hello', {})).toBe('failed');
    const writeText = vi.fn(async () => Promise.reject(new Error('denied')));
    expect(await shareResult('hello', { writeText })).toBe('failed');
  });
});
