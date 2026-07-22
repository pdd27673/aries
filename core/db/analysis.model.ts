import { Schema, model, models } from "mongoose";
import { SENTIMENTS, type Sentiment } from "@/core/ai/openai";

// One stored analysis. Flat and denormalized — matches how it's queried
// (list, filter by sentiment, sort by date); no joins needed.
export interface AnalysisDoc {
  session: string; // anonymous owner — scopes History so visitors don't see each other's rows
  url: string;
  title: string;
  summary: string;
  sentiment: Sentiment;
  source: string;
  analyzedAt: Date;
}

const analysisSchema = new Schema<AnalysisDoc>({
  session: { type: String, required: true },
  url: { type: String, required: true },
  title: { type: String, required: true },
  summary: { type: String, required: true },
  sentiment: { type: String, enum: SENTIMENTS, required: true },
  source: { type: String, required: true },
  analyzedAt: { type: Date, required: true, default: Date.now },
});

// (session, url) is unique: one analysis per article *per session*, and it's the
// per-session cache/dedupe key the analyze flow looks up.
analysisSchema.index({ session: 1, url: 1 }, { unique: true });
// History view is always scoped to a session: newest-first, and filter-by-sentiment.
analysisSchema.index({ session: 1, analyzedAt: -1 });
analysisSchema.index({ session: 1, sentiment: 1, analyzedAt: -1 });

// Reuse the compiled model across Next hot reloads instead of recompiling it.
export const Analysis = models.Analysis ?? model<AnalysisDoc>("Analysis", analysisSchema);
