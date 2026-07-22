import { describe, expect, it } from "vitest";
import { getSessionId } from "@/core/util/session";

// Build a Request carrying a given Cookie header (or none).
const req = (cookie?: string) =>
  new Request("http://localhost/api/analyses", cookie ? { headers: { cookie } } : undefined);

describe("getSessionId", () => {
  it("mints a new id when there is no cookie header at all", () => {
    const { id, isNew } = getSessionId(req());
    expect(isNew).toBe(true);
    expect(id).toMatch(/^[0-9a-f-]{36}$/); // a UUID
  });

  it("mints a new id when the cookie header has no sid", () => {
    const { id, isNew } = getSessionId(req("theme=dark; other=1"));
    expect(isNew).toBe(true);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("reads an existing sid and reports it is not new", () => {
    const { id, isNew } = getSessionId(req("sid=abc123"));
    expect(id).toBe("abc123");
    expect(isNew).toBe(false);
  });

  it("finds sid when it is not the first cookie", () => {
    const { id, isNew } = getSessionId(req("theme=dark; sid=xyz789; other=1"));
    expect(id).toBe("xyz789");
    expect(isNew).toBe(false);
  });

  it("URI-decodes the stored value", () => {
    const { id } = getSessionId(req("sid=a%20b%2Fc"));
    expect(id).toBe("a b/c");
  });

  it("does not match a cookie whose name merely ends in sid", () => {
    // `xsid=...` must not be mistaken for `sid=...`; with no real sid it mints one.
    const { id, isNew } = getSessionId(req("xsid=nope"));
    expect(isNew).toBe(true);
    expect(id).not.toBe("nope");
  });

  it("mints unique ids across calls", () => {
    const a = getSessionId(req()).id;
    const b = getSessionId(req()).id;
    expect(a).not.toBe(b);
  });
});
