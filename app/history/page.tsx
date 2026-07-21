"use client";

import { useEffect, useState } from "react";
import { SentimentBadge } from "@/components/SentimentBadge";
import type { Sentiment, StoredAnalysis } from "@/lib/types";

type SentimentFilter = "all" | Sentiment;
type SortOrder = "newest" | "oldest";

const SENTIMENT_ORDER: Sentiment[] = ["positive", "neutral", "negative"];
const SENTIMENT_COLOR: Record<Sentiment, string> = {
  positive: "var(--pos)",
  neutral: "var(--neu)",
  negative: "var(--neg)",
};

export default function HistoryPage() {
  const [items, setItems] = useState<StoredAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sentiment, setSentiment] = useState<SentimentFilter>("all");
  const [sort, setSort] = useState<SortOrder>("newest");

  // Refetch whenever the filter or sort changes — the server does the work,
  // so the query params map straight to the /api/analyses contract.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ sort });
    if (sentiment !== "all") params.set("sentiment", sentiment);

    fetch(`/api/analyses?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load analyses");
        if (active) setItems(data.analyses);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load analyses");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [sentiment, sort]);

  const counts = SENTIMENT_ORDER.reduce(
    (acc, s) => ({ ...acc, [s]: items.filter((i) => i.sentiment === s).length }),
    {} as Record<Sentiment, number>,
  );
  const total = items.length;
  const showBreakdown = sentiment === "all" && total > 0;

  return (
    <main className="container">
      <div className="page-head">
        <h1>History</h1>
        <p className="lede">Every article you&apos;ve analyzed, filterable by sentiment and sortable by date.</p>
      </div>

      <div className="controls">
        <label>
          <span className="muted small">Sentiment</span>
          <select value={sentiment} onChange={(e) => setSentiment(e.target.value as SentimentFilter)}>
            <option value="all">All</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
        </label>
        <label>
          <span className="muted small">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortOrder)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>

      {showBreakdown && (
        <div className="breakdown">
          <div className="breakdown-bar" aria-hidden>
            {SENTIMENT_ORDER.map((s) =>
              counts[s] > 0 ? (
                <span key={s} className={`breakdown-seg ${s}`} style={{ width: `${(counts[s] / total) * 100}%` }} />
              ) : null,
            )}
          </div>
          <div className="breakdown-legend">
            {SENTIMENT_ORDER.map((s) => (
              <span key={s}>
                <span className="legend-dot" style={{ background: SENTIMENT_COLOR[s] }} />
                {s[0].toUpperCase() + s.slice(1)} · {counts[s]} ({total ? Math.round((counts[s] / total) * 100) : 0}%)
              </span>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <ul className="results" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li key={i} className="skeleton">
              <div className="sk-line" style={{ width: "55%" }} />
              <div className="sk-line" style={{ width: "92%", marginTop: 12 }} />
              <div className="sk-line" style={{ width: "40%", marginTop: 8 }} />
            </li>
          ))}
        </ul>
      )}

      {error && <p className="error">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <div className="empty">
          <h3>Nothing here yet</h3>
          <p>Analyze an article from the Search tab and it&apos;ll show up here.</p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <p className="result-count">
          {total} anal{total === 1 ? "ysis" : "yses"}
        </p>
      )}

      <ul className="results">
        {!loading &&
          items.map((item) => (
            <li key={item.url} className="result">
              <div className="result-head">
                <a className="result-title" href={item.url} target="_blank" rel="noopener noreferrer">
                  {item.title}
                </a>
                <SentimentBadge sentiment={item.sentiment} />
              </div>
              <p className="summary">{item.summary}</p>
              <span className="meta">
                <span className="source-tag">{item.source}</span>
                {new Date(item.analyzedAt).toLocaleString()}
              </span>
            </li>
          ))}
      </ul>
    </main>
  );
}
