/** What the browser lets us do to share a text, injectable for tests. */
export interface ShareEnv {
  share?: (data: { text: string }) => Promise<void>;
  writeText?: (text: string) => Promise<void>;
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/** The real environment: Web Share on phones that have it, the clipboard everywhere else. */
export function browserShareEnv(): ShareEnv {
  const env: ShareEnv = {};
  if (typeof navigator === 'undefined') return env;
  if (typeof navigator.share === 'function') env.share = (data) => navigator.share(data);
  if (typeof navigator.clipboard?.writeText === 'function')
    env.writeText = (text) => navigator.clipboard.writeText(text);
  return env;
}

/** Native share sheet first, clipboard as the fallback. A cancelled sheet is not an error. */
export async function shareResult(text: string, env: ShareEnv): Promise<ShareOutcome> {
  if (env.share) {
    try {
      await env.share({ text });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Some browsers refuse (no user gesture, unsupported data): fall through to the clipboard.
    }
  }
  if (env.writeText) {
    try {
      await env.writeText(text);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
  return 'failed';
}
