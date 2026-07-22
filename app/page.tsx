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

const PAGE_SIZE = 5;
const RECENT_KEY = "recentSearches";
const STATE_KEY = "searchState";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<Article[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, AnalyzeState>>({});
  const [page, setPage] = useState(1);
  // Bumped after each search so the quota badge re-fetches its remaining count.
  const [quotaKey, setQuotaKey] = useState(0);

  const [recent, setRecent] = useState<string[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Restore the previous search (query, results, page, per-article analyses) so
  // navigating to History and back doesn't wipe it. Also load recent searches.
  const persistReady = useRef(false);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STATE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        setQuery(s.query ?? "");
        setSource(s.source ?? "");
        setResults(s.results ?? []);
        setSearched(s.searched ?? false);
        setPage(s.page ?? 1);
        setAnalyses(s.analyses ?? {});
      }
      const r = localStorage.getItem(RECENT_KEY);
      if (r) setRecent(JSON.parse(r));
    } catch {
      // ignore storage/parse errors
    }
  }, []);

  // Persist search state on change (skip the very first run so we don't clobber
  // the restored state with the initial empty values).
  useEffect(() => {
    if (!persistReady.current) {
      persistReady.current = true;
      return;
    }
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify({ query, source, results, searched, page, analyses }));
    } catch {
      // ignore quota/serialization errors
    }
  }, [query, source, results, searched, page, analyses]);

  // "/" focuses the search box (unless already typing in a field).
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

  function rememberSearch(q: string) {
    setRecent((prev) => {
      const next = [q, ...prev.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  function clearRecent() {
    setRecent([]);
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {
      // ignore
    }
  }

  async function runSearch(rawQuery: string) {
    const q = rawQuery.trim();
    if (!q) return;

    setShowRecent(false);
    setSearching(true);
    setSearchError(null);
    setResults([]);
    setPage(1);
    try {
      const params = new URLSearchParams({ q });
      if (source) params.set("source", source);
      const res = await fetch(`/api/search?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setResults(data.articles);
      rememberSearch(q);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
      setSearched(true);
      setQuotaKey((k) => k + 1);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(query);
  }

  function pickRecent(q: string) {
    setQuery(q);
    runSearch(q);
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

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function goToPage(next: number) {
    setPage(next);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="container">
      <div className="page-head">
        <h1>Search the news</h1>
        <p className="lede">Find recent articles, then get a one-click AI summary and sentiment read.</p>
      </div>

      <form className="searchbar" onSubmit={handleSubmit}>
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
            onFocus={() => setShowRecent(true)}
            onBlur={() => setShowRecent(false)}
            placeholder="Search recent news…"
            aria-label="Search query"
          />
          <span className="kbd" aria-hidden>
            /
          </span>

          {showRecent && recent.length > 0 && (
            <div className="recent">
              <div className="recent-head">
                <span>Recent searches</span>
                {/* onMouseDown so it fires before the input's blur hides the menu */}
                <button type="button" className="recent-clear" onMouseDown={(e) => e.preventDefault()} onClick={clearRecent}>
                  Clear
                </button>
              </div>
              {recent.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="recent-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickRecent(q)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  {q}
                </button>
              ))}
            </div>
          )}
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
              <div className="sk-line" style={{ width: "40%", marginTop: 12 }} />
              <div className="sk-line" style={{ width: "95%", marginTop: 12 }} />
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
          pageItems.map((article) => {
            const state = analyses[article.url] ?? { status: "idle" as const };
            return (
              <li key={article.url} className="result">
                <a className="result-title-link" href={article.url} target="_blank" rel="noopener noreferrer">
                  {article.title}
                </a>
                <div className="result-meta">
                  <span className="source-tag">{article.source}</span>
                  <span>{article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : ""}</span>
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

      {!searching && totalPages > 1 && (
        <div className="pager">
          <button className="btn btn-sm btn-ghost" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
            ← Prev
          </button>
          <span className="pager-info">
            Page {currentPage} of {totalPages}
          </span>
          <button className="btn btn-sm btn-ghost" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>
            Next →
          </button>
        </div>
      )}
    </main>
  );
}
