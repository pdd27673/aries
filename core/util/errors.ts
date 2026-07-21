// Narrow, named error types so routes can tell failure kinds apart instead of
// catching one generic Error. Each maps to a specific HTTP status (see below).

// A required piece of configuration (env var) is missing — this is our fault, 500.
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

// The caller asked for something invalid (bad param, unknown source) — their fault, 400.
export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

// An external API (news source or OpenAI) failed — upstream's fault, 502.
// `status` is the upstream HTTP status when we have one; it drives retry decisions.
export class UpstreamError extends Error {
  constructor(
    public readonly source: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

// Maps an error to the HTTP status a route should return for it.
export function httpStatusFor(err: unknown): number {
  if (err instanceof BadRequestError) return 400;
  if (err instanceof ConfigError) return 500;
  if (err instanceof UpstreamError) return 502;
  return 500;
}

// Whether an error is worth retrying. Config mistakes and bad requests won't fix
// themselves between attempts; upstream failures are only transient for network
// errors (no status) or 5xx — retrying a 4xx (bad key, rate limit) just wastes time.
export function isRetryable(err: unknown): boolean {
  if (err instanceof ConfigError || err instanceof BadRequestError) return false;
  if (err instanceof UpstreamError) return err.status === undefined || err.status >= 500;
  return true; // unknown/network error — worth one more try
}
