import type { Sentiment } from "@/lib/types";

const LABEL: Record<Sentiment, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
};

// Colored pill for a sentiment: a status dot + label. Color comes from the
// badge-<sentiment> CSS class so it tracks the active (light/dark) theme.
export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  return (
    <span className={`badge badge-${sentiment}`}>
      <span className="dot" aria-hidden />
      {LABEL[sentiment]}
    </span>
  );
}
