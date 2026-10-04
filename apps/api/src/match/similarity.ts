/**
 * Lexical similarity between a resume and a job description.
 *
 * A small TF-IDF implementation (smooth idf, L2-normalised, cosine) instead of
 * pulling in a maths dependency: two documents, one pass, ~1ms. It is the
 * "does this resume speak the same language as this posting" signal, and it is
 * deliberately separate from skill coverage in the final score.
 */
import { extractKeywords, tokenize } from './text';

export interface SimilarityResult {
  /** Raw cosine similarity, 0..1. */
  raw: number;
  /** Calibrated 0..1 — see `calibrateCosine`. */
  calibrated: number;
  /** Terms that appear in both documents, most distinctive first. */
  shared: string[];
}

function termFrequency(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokenize(text)) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

/**
 * Cosine similarity between technical documents is compressed into a narrow
 * band (an unrelated pair still shares "team", "experience", "build"). We
 * stretch it so the number means something to a human on a 0-100 scale.
 */
export function calibrateCosine(cosine: number): number {
  const floor = 0.08;
  const ceiling = 0.55;
  return Math.min(1, Math.max(0, (cosine - floor) / (ceiling - floor)));
}

export function tfidfCosine(resumeText: string, jdText: string): SimilarityResult {
  const a = termFrequency(resumeText);
  const b = termFrequency(jdText);
  if (a.size === 0 || b.size === 0) return { raw: 0, calibrated: 0, shared: [] };

  const documents = [a, b];
  const vocabulary = new Set([...a.keys(), ...b.keys()]);
  const idf = new Map<string, number>();
  for (const term of vocabulary) {
    const df = documents.reduce((count, doc) => count + (doc.has(term) ? 1 : 0), 0);
    idf.set(term, Math.log((1 + documents.length) / (1 + df)) + 1);
  }

  const vectorise = (doc: Map<string, number>) => {
    const vector = new Map<string, number>();
    let norm = 0;
    for (const [term, tf] of doc) {
      const weight = (1 + Math.log(tf)) * (idf.get(term) ?? 0);
      if (weight <= 0) continue;
      vector.set(term, weight);
      norm += weight * weight;
    }
    norm = Math.sqrt(norm);
    if (norm > 0) for (const [term, weight] of vector) vector.set(term, weight / norm);
    return vector;
  };

  const va = vectorise(a);
  const vb = vectorise(b);
  let dot = 0;
  const sharedWeights: Array<{ term: string; weight: number }> = [];
  for (const [term, weight] of va) {
    const other = vb.get(term);
    if (other === undefined) continue;
    dot += weight * other;
    sharedWeights.push({ term, weight: weight * other });
  }

  const raw = Math.min(1, Math.max(0, dot));
  return {
    raw,
    calibrated: calibrateCosine(raw),
    shared: sharedWeights
      .sort((x, y) => y.weight - x.weight)
      .slice(0, 25)
      .map((entry) => entry.term),
  };
}

/** Human-readable "keywords the posting repeats that your resume never mentions". */
export function missingKeywords(resumeText: string, jdText: string, limit = 8): string[] {
  const resumeTokens = new Set(tokenize(resumeText));
  return extractKeywords(jdText, 60)
    .filter((keyword) => !keyword.term.includes(' '))
    .filter((keyword) => !resumeTokens.has(keyword.term))
    .slice(0, limit)
    .map((keyword) => keyword.term);
}
