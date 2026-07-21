"use client";

import { useEffect, useRef, useState } from "react";
import { AnalysisCard } from "@/components/AnalysisCard";
import { QuotaBadge } from "@/components/QuotaBadge";
import { SourcePicker } from "@/components/SourcePicker";
import type { Article, AnalysisResult } from "@/lib/types";

// Per-article analyze state, so each result row can show its own loading/result/error.
type AnalyzeState = {
  status: "idle" | "loading" | "done" | "error";
  result?: AnalysisResult;
  error?: string;
};

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<Article[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, AnalyzeState>>({});
  // Bumped after each search so the quota badge re-fetches its remaining count.
  const [quotaKey, setQuotaKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" focuses the search box (unless already typing in a field) — a small power-user touch.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setSearchError(null);
    setResults([]);
    try {
      const params = new URLSearchParams({ q: query.trim() });
      if (source) params.set("source", source);
      const res = await fetch(`/api/search?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setResults(data.articles);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
      setSearched(true);
      setQuotaKey((k) => k + 1);
    }
  }

  async function handleAnalyze(article: Article) {
    setAnalyses((prev) => ({ ...prev, [article.url]: { status: "loading" } }));
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: article.url,
          title: article.title,
          description: article.description,
          source: article.source,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setAnalyses((prev) => ({ ...prev, [article.url]: { status: "done", result: data } }));
    } catch (err) {
      setAnalyses((prev) => ({
        ...prev,
        [article.url]: { status: "error", error: err instanceof Error ? err.message : "Analysis failed" },
      }));
    }
  }

  return (
    <main className="container">
      <div className="page-head">
        <h1>Search the news</h1>
        <p className="lede">Find recent articles, then get a one-click AI summary and sentiment read.</p>
      </div>

      <form className="searchbar" onSubmit={handleSearch}>
        <SourcePicker value={source} onChange={setSource} />
        <div className="search-input-wrap">
          <span className="search-icon" aria-hidden>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recent news…"
            aria-label="Search query"
          />
          <span className="kbd" aria-hidden>
            /
          </span>
        </div>
        <button className="btn" type="submit" disabled={searching}>
          {searching ? <span className="spinner" aria-hidden /> : null}
          {searching ? "Searching…" : "Search"}
        </button>
      </form>

      <QuotaBadge refreshKey={quotaKey} />

      {searchError && <p className="error">{searchError}</p>}

      {searching && (
        <ul className="results" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li key={i} className="skeleton">
              <div className="sk-line" style={{ width: "60%" }} />
              <div className="sk-line" style={{ width: "95%", marginTop: 12 }} />
              <div className="sk-line" style={{ width: "80%", marginTop: 8 }} />
              <div className="sk-line" style={{ width: "88px", height: 32, marginTop: 16 }} />
            </li>
          ))}
        </ul>
      )}

      {!searching && !searched && (
        <div className="empty">
          <h3>Start with a search</h3>
          <p>
            Try <em>“artificial intelligence”</em>, <em>“climate”</em>, or anything current. Press <span className="kbd">/</span> to jump to
            the search box.
          </p>
        </div>
      )}

      {searched && !searching && !searchError && results.length === 0 && (
        <div className="empty">
          <h3>No articles found</h3>
          <p>Try a broader query or a different source.</p>
        </div>
      )}

      {!searching && results.length > 0 && (
        <p className="result-count">
          {results.length} result{results.length === 1 ? "" : "s"}
        </p>
      )}

      <ul className="results">
        {!searching &&
          results.map((article) => {
            const state = analyses[article.url] ?? { status: "idle" as const };
            return (
              <li key={article.url} className="result">
                <div className="result-head">
                  <a className="result-title" href={article.url} target="_blank" rel="noreferrer">
                    {article.title}
                  </a>
                  <span className="meta">
                    <span className="source-tag">{article.source}</span>
                    {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : ""}
                  </span>
                </div>

                {article.description && <p className="desc">{article.description}</p>}

                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => handleAnalyze(article)}
                  disabled={state.status === "loading"}
                >
                  {state.status === "loading" ? <span className="spinner" aria-hidden /> : null}
                  {state.status === "loading" ? "Analyzing…" : state.status === "done" ? "Re-analyze" : "Analyze"}
                </button>

                {state.status === "error" && <p className="error">{state.error}</p>}
                {state.status === "done" && state.result && <AnalysisCard result={state.result} />}
              </li>
            );
          })}
      </ul>
    </main>
  );
}
