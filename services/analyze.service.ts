import { analyzeArticle, type AnalysisResult } from "@/core/ai/openai";
import { Analysis, type AnalysisDoc } from "@/core/db/analysis.model";
import { connectToDb } from "@/core/db/connect";

export interface AnalyzeInput {
  session: string; // scopes the cache lookup + stored row to this visitor
  url: string;
  title: string;
  description: string;
  source: string;
}

export interface AnalyzeOutput extends AnalysisResult {
  url: string;
  title: string;
  source: string;
  analyzedAt: string;
  cached: boolean; // true when we returned a stored analysis instead of calling OpenAI
}

// Core analyze flow: cache lookup -> OpenAI -> save. This is the piece a unit
// test exercises (with OpenAI mocked), so it stays small and linear.
export async function analyze(input: AnalyzeInput): Promise<AnalyzeOutput> {
  await connectToDb();

  // Cache: if this session already analyzed this URL, return it and skip the
  // OpenAI call (saves cost and, for GNews articles, avoids burning quota).
  const existing = await Analysis.findOne({ session: input.session, url: input.url }).lean<AnalysisDoc | null>();
  if (existing) return toOutput(existing, true);

  const result = await analyzeArticle(input.title, input.description);

  // Upsert by (session, url) so two concurrent analyze calls for the same article
  // can't create duplicate rows — the unique index would reject the second insert.
  const saved = await Analysis.findOneAndUpdate(
    { session: input.session, url: input.url },
    {
      session: input.session,
      url: input.url,
      title: input.title,
      summary: result.summary,
      sentiment: result.sentiment,
      source: input.source,
      analyzedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean<AnalysisDoc | null>();

  if (!saved) throw new Error("Failed to save analysis");
  return toOutput(saved, false);
}

function toOutput(doc: AnalysisDoc, cached: boolean): AnalyzeOutput {
  return {
    url: doc.url,
    title: doc.title,
    summary: doc.summary,
    sentiment: doc.sentiment,
    source: doc.source,
    analyzedAt: new Date(doc.analyzedAt).toISOString(),
    cached,
  };
}
