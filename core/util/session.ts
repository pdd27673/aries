import { randomUUID } from "node:crypto";

// Name of the anonymous session cookie. The value scopes stored analyses to one
// browser, so each visitor's History shows only what they analyzed (no shared clutter).
export const SESSION_COOKIE = "sid";

// httpOnly: the client never needs to read it; it's only used server-side to
// tag/filter analyses. Long-lived so a returning visitor keeps their history.
export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365, // 1 year
};

// Reads the session id from the request's Cookie header, or mints a new one.
// `isNew` tells the route to set the cookie on its response.
export function getSessionId(request: Request): { id: string; isNew: boolean } {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)sid=([^;]+)/);
  if (match) return { id: decodeURIComponent(match[1]), isNew: false };
  return { id: randomUUID(), isNew: true };
}
