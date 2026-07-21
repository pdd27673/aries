const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Retries an async function with exponential backoff. Used to smooth over
// transient blips when calling external APIs (GNews, OpenAI). By default it
// retries on any thrown error; pass `shouldRetry` to skip non-transient ones
// (e.g. a bad API key or 4xx) so we fail fast instead of backing off pointlessly.
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: {
    retries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    shouldRetry?: (err: unknown) => boolean;
  } = {},
): Promise<T> {
  const retries = opts.retries ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 300;
  const maxDelayMs = opts.maxDelayMs ?? Infinity;
  const shouldRetry = opts.shouldRetry ?? (() => true);

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === retries || !shouldRetry(err)) break;
      // exponential backoff (300ms, 600ms, 1200ms, …), capped at maxDelayMs so a
      // long retry budget doesn't blow up into multi-second waits per attempt.
      await sleep(Math.min(maxDelayMs, baseDelayMs * 2 ** attempt));
    }
  }
  throw lastError;
}
