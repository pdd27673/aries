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
    // Retry the initial handshake: some networks (corporate wifi, flaky links)
    // intermittently drop the first TLS connection to Atlas with an SSL alert.
    // A short backoff turns that transient cold-start failure into a success,
    // and serverSelectionTimeoutMS bounds how long a truly-down server hangs.
    cached.promise = withRetry(() => mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 }), {
      retries: 3,
      baseDelayMs: 300,
    });
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
