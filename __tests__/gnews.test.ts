import { beforeEach, describe, expect, it, vi } from "vitest";

// The GNews adapter records quota via the DB; stub it so tests need no database.
vi.mock("@/core/db/quota.model", () => ({ recordCall: vi.fn().mockResolvedValue(undefined) }));

import { gnewsAdapter } from "@/core/sources/gnews";

describe("gnewsAdapter.search", () => {
  beforeEach(() => {
    process.env.GNEWS_API_KEY = "test-key";
    // Only clean up the fetch stub — restoreAllMocks would also wipe the
    // recordCall mock's resolved value set in the vi.mock factory above.
    vi.unstubAllGlobals();
  });

  it("maps GNews API results into the Article contract", async () => {
    const apiResponse = {
      totalArticles: 1,
      articles: [
        {
          title: "Markets rally",
          description: "Stocks rose today.",
          url: "https://example.com/a",
          publishedAt: "2026-01-01T00:00:00Z",
        },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => apiResponse });
    vi.stubGlobal("fetch", fetchMock);

    const out = await gnewsAdapter.search("markets", 5);

    expect(out).toEqual([
      {
        title: "Markets rally",
        url: "https://example.com/a",
        description: "Stocks rose today.",
        source: "gnews",
        publishedAt: "2026-01-01T00:00:00Z",
      },
    ]);

    // query and limit are forwarded to the GNews endpoint.
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain("q=markets");
    expect(calledUrl).toContain("max=5");
  });

  it("throws without retrying on a 4xx (bad key / quota) — those won't fix themselves", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(gnewsAdapter.search("x", 5)).rejects.toThrow(/GNews request failed/);
    // 4xx is non-transient: exactly one attempt, no backoff retries.
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("retries a transient 5xx before giving up", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(gnewsAdapter.search("x", 5)).rejects.toThrow(/GNews request failed/);
    // default retries = 2, so 1 initial + 2 retries = 3 attempts.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
