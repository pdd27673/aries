import mongoose from "mongoose";
import { withRetry } from "@/core/util/retry";

// Next.js hot-reloads modules in dev, which would open a new Mongo connection
// on every request. We cache the connection promise on the global object so a
// single connection is reused across reloads (a well-known Mongoose + Next pattern).
type Cached = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };

const globalForMongoose = globalThis as unknown as { _mongoose?: Cached };
const cached: Cached = globalForMongoose._mongoose ?? { conn: null, promise: null };
globalForMongoose._mongoose = cached;

export async function connectToDb(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not set");
    // Retry the initial handshake AND a warm-up ping: some networks (corporate
    // wifi, flaky links) intermittently drop the first TLS socket to Atlas with
    // an SSL alert. connect() can succeed while the very first *query* then fails
    // on a cold pooled socket ("connection pool was cleared…"), so we force a
    // real round-trip here — retried with backoff — to warm the pool before any
    // query runs. serverSelectionTimeoutMS bounds how long a truly-down server hangs.
    // The cold-start SSL failures come in a short burst (~a few seconds), so the
    // retry budget spans it: ~6 attempts over ~6s, with the per-attempt delay
    // capped at 1.5s. Only the first request in a cold window ever waits.
    cached.promise = withRetry(
      async () => {
        const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
        await conn.connection.db?.admin().ping();
        return conn;
      },
      { retries: 5, baseDelayMs: 400, maxDelayMs: 1500 },
    );
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    // Clear the failed promise so the next call retries instead of forever
    // awaiting the same rejected connection after a transient DB blip.
    cached.promise = null;
    throw err;
  }
  return cached.conn;
}
