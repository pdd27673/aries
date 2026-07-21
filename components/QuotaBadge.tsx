"use client";

import { useEffect, useState } from "react";

interface QuotaStatus {
  used: number;
  limit: number;
  remaining: number;
}

// Small "GNews quota remaining today" indicator with a mini usage bar. Re-fetched
// via `refreshKey` so it updates after a search spends a call. Silent if it can't load.
export function QuotaBadge({ refreshKey }: { refreshKey: number }) {
  const [quota, setQuota] = useState<QuotaStatus | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/quota")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) setQuota(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [refreshKey]);

  if (!quota) return null;

  const pct = quota.limit > 0 ? Math.min(100, (quota.remaining / quota.limit) * 100) : 0;
  return (
    <p className="quota">
      <span className="quota-track" aria-hidden>
        <span className="quota-fill" style={{ width: `${pct}%` }} />
      </span>
      GNews quota: {quota.remaining}/{quota.limit} left today
    </p>
  );
}
