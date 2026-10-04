/**
 * The matching engine.
 *
 * Score = weighted blend of three signals:
 *   1. skillCoverage      (60%) — of the skills the posting actually asks for,
 *                                 how much of that weight the resume covers.
 *   2. keywordRelevance   (25%) — TF-IDF cosine, "do you use their language".
 *   3. semanticSimilarity (15%) — optional embedding cosine from the ML service.
 *
 * Skill coverage dominates on purpose: it is explainable ("you are missing
 * Kubernetes"), it works offline, and it is what recruiters screen on. The
 * other two signals stop the score from being blind to phrasing and context.
 * When the ML service is unavailable its weight is redistributed, never zeroed.
 */
import type { MatchBreakdown, MatchResult, MatchSkillHit } from '@applyai/shared/types';
import { missingKeywords, tfidfCosine } from './similarity';
import { type SkillHit, extractSkillHits } from './skills';
import { countWords, extractKeywords, flattenText, truncate } from './text';

const WEIGHTS = { skillCoverage: 0.6, keywordRelevance: 0.25, semanticSimilarity: 0.15 };
const WEIGHTS_NO_SEMANTIC = { skillCoverage: 0.72, keywordRelevance: 0.28, semanticSimilarity: 0 };
const WEIGHTS_NO_SKILLS = { skillCoverage: 0, keywordRelevance: 0.75, semanticSimilarity: 0.25 };

const REQUIREMENT_HEADING =
  /(requirements?|qualifications?|must[- ]haves?|what you.{0,3}ll need|what we.{0,3}re looking for|you (will )?(have|need|bring)|skills? (and|&) experience|about you|who you are|your background|essential|mandatory)/i;
const PREFERRED_HEADING =
  /(nice to have|preferred|bonus|plus(es)?|good to have|desirable|advantageous|optional)/i;
const RESPONSIBILITY_HEADING =
  /(responsibilities|what you.{0,3}ll do|the role|day to day|day-to-day|your impact|duties|about the (role|job)|objectives)/i;

export type SectionKind = 'requirements' | 'preferred' | 'responsibilities' | 'other';

const SECTION_WEIGHT: Record<SectionKind, number> = {
  requirements: 1,
  preferred: 0.45,
  responsibilities: 0.7,
  other: 0.6,
};

export interface RequirementSkill {
  id: string;
  label: string;
  weight: number;
  count: number;
  section: SectionKind;
}

export interface JobAnalysis {
  skills: RequirementSkill[];
  totalWeight: number;
  hasExplicitRequirements: boolean;
  keywords: Array<{ term: string; count: number }>;
  wordCount: number;
}

function detectSection(line: string, current: SectionKind): SectionKind {
  const trimmed = line
    .trim()
    .replace(/[:#*•-]+$/g, '')
    .trim();
  if (trimmed.length === 0 || trimmed.length > 90) return current;
  // Headings are short lines that end with a colon or are title-ish.
  const looksLikeHeading =
    trimmed.length <= 70 && (line.trim().endsWith(':') || /^[A-Z0-9][^.!?]*$/.test(trimmed));
  if (!looksLikeHeading) return current;
  if (PREFERRED_HEADING.test(trimmed)) return 'preferred';
  if (REQUIREMENT_HEADING.test(trimmed)) return 'requirements';
  if (RESPONSIBILITY_HEADING.test(trimmed)) return 'responsibilities';
  return current;
}

/** Split a job description into weighted sections and pull the skills out of each. */
export function analyzeJobDescription(jdText: string): JobAnalysis {
  const lines = jdText.split('\n');
  const hitsBySkill = new Map<string, RequirementSkill>();
  const perSkillHits = new Map<string, SkillHit>();
  let section: SectionKind = 'other';

  for (const line of lines) {
    const nextSection = detectSection(line, section);
    section = nextSection;
    if (line.trim().length === 0) continue;
    for (const hit of extractSkillHits(line, { maxContexts: 1 })) {
      const weight = SECTION_WEIGHT[section];
      const existing = hitsBySkill.get(hit.id);
      if (existing) {
        existing.count += hit.count;
        // A skill mentioned in requirements outranks the same skill in prose.
        existing.weight = Math.max(existing.weight, weight);
        if (weight >= existing.weight) existing.section = section;
        continue;
      }
      hitsBySkill.set(hit.id, { id: hit.id, label: hit.label, weight, count: hit.count, section });
      perSkillHits.set(hit.id, hit);
    }
  }

  const skills = [...hitsBySkill.values()]
    .map((skill) => ({
      ...skill,
      // Repeated mentions are a strong signal of importance.
      weight: Math.min(1, skill.count >= 3 ? Math.max(skill.weight, 0.9) : skill.weight),
    }))
    .sort((a, b) => b.weight - a.weight || b.count - a.count);

  const totalWeight = skills.reduce((sum, skill) => sum + skill.weight, 0);

  return {
    skills,
    totalWeight,
    hasExplicitRequirements: skills.some((skill) => skill.section === 'requirements'),
    keywords: extractKeywords(jdText, 30),
    wordCount: countWords(jdText),
  };
}

export interface ComputeMatchOptions {
  resumeText: string;
  jdText: string;
  /** Similarity from the ML service (0..1, already calibrated) when available. */
  semanticSimilarity?: number | null;
  /** Skip context extraction and suggestions for a fast preview. */
  quick?: boolean;
}

export interface EngineMatchResult extends Omit<MatchResult, 'id' | 'applicationId' | 'createdAt'> {
  engine: string;
}

function buildSuggestions(input: {
  analysis: JobAnalysis;
  missing: RequirementSkill[];
  hits: SkillHit[];
  coverage: number;
  keyword: number;
  resumeText: string;
  jdText: string;
}): string[] {
  const suggestions: string[] = [];
  const { analysis, missing, hits, coverage, keyword, resumeText, jdText } = input;

  const topMissing = missing.filter((skill) => skill.weight >= 0.6).slice(0, 3);
  for (const skill of topMissing) {
    const where = skill.section === 'requirements' ? 'in the requirements' : 'in the posting';
    suggestions.push(
      `**${skill.label}** appears ${skill.count}× ${where} but not in your resume. Add it as a bullet if you have real experience — otherwise expect it in screening.`,
    );
  }

  if (keyword < 0.35 && analysis.skills.length > 0) {
    const gaps = missingKeywords(resumeText, jdText, 5);
    const examples = gaps.length > 0 ? ` e.g. ${gaps.slice(0, 4).join(', ')}` : '';
    suggestions.push(
      `Your wording overlaps the posting by only ${Math.round(keyword * 100)}%. Mirror their exact tool names for work you already did${examples}.`,
    );
  }

  const digitDensity = (resumeText.match(/\d/g)?.length ?? 0) / Math.max(1, countWords(resumeText));
  if (digitDensity < 0.015) {
    suggestions.push(
      'Your resume has almost no numbers. Add measurable outcomes (latency, %, users, revenue) — they are what turns a claim into evidence.',
    );
  }

  if (hits.length === 0) {
    suggestions.push(
      'No recognisable skills were found in your resume text. Paste the full resume (including a skills section) so the match can be meaningful.',
    );
  } else if (coverage >= 0.8) {
    const lead = hits
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((hit) => hit.label)
      .join(', ');
    suggestions.push(
      `Strong coverage. Lead your outreach with ${lead} and reference the team\'s stack directly.`,
    );
  }

  if (!analysis.hasExplicitRequirements && analysis.skills.length > 0) {
    suggestions.push(
      'This posting has no explicit "requirements" section, so the score leans on overall language overlap — read the posting yourself before trusting it.',
    );
  }

  if (countWords(resumeText) < 150) {
    suggestions.push(
      'Your resume text is very short (<150 words) — most signals are noisy at this length.',
    );
  }

  return suggestions.slice(0, 5);
}

function buildSummary(
  score: number,
  matched: number,
  required: number,
  missing: Array<{ label: string }>,
): string {
  const band =
    score >= 80
      ? 'strong match'
      : score >= 65
        ? 'good match'
        : score >= 45
          ? 'partial match'
          : 'weak match';
  const coverage =
    required > 0
      ? `${matched} of ${required} required skills covered`
      : 'no explicit skills found in the posting';
  const gaps = missing.slice(0, 3).map((skill) => skill.label);
  const gapText = gaps.length > 0 ? ` Gaps: ${gaps.join(', ')}.` : '';
  return `${Math.round(score)}% — ${band}: ${coverage}.${gapText}`;
}

export function computeMatch(options: ComputeMatchOptions): EngineMatchResult {
  const { resumeText, jdText, quick = false } = options;
  const analysis = analyzeJobDescription(jdText);
  const resumeFlat = flattenText(resumeText);
  const jdFlat = flattenText(jdText);

  const hits = extractSkillHits(resumeText, { maxContexts: quick ? 1 : 3 });
  const resumeSkillIds = new Set(hits.map((hit) => hit.id));

  const matchedSkills: MatchSkillHit[] = analysis.skills
    .filter((skill) => resumeSkillIds.has(skill.id))
    .map((skill) => {
      const hit = hits.find((candidate) => candidate.id === skill.id);
      return {
        id: skill.id,
        label: skill.label,
        count: hit?.count ?? 1,
        contexts: quick ? undefined : hit?.contexts,
      };
    });

  const missingSkills = analysis.skills
    .filter((skill) => !resumeSkillIds.has(skill.id))
    .map((skill) => ({
      id: skill.id,
      label: skill.label,
      weight: Number(skill.weight.toFixed(2)),
    }));

  const coveredWeight = analysis.skills
    .filter((skill) => resumeSkillIds.has(skill.id))
    .reduce((sum, skill) => sum + skill.weight, 0);
  const skillCoverage = analysis.totalWeight > 0 ? coveredWeight / analysis.totalWeight : 0;

  const similarity = tfidfCosine(resumeFlat, jdFlat);
  const keywordRelevance = similarity.calibrated;
  const semantic =
    typeof options.semanticSimilarity === 'number' ? options.semanticSimilarity : null;

  const weights =
    analysis.totalWeight === 0
      ? WEIGHTS_NO_SKILLS
      : semantic === null
        ? WEIGHTS_NO_SEMANTIC
        : WEIGHTS;

  const blended =
    skillCoverage * weights.skillCoverage +
    keywordRelevance * weights.keywordRelevance +
    (semantic ?? 0) * weights.semanticSimilarity;

  const score = Math.min(100, Math.max(0, Math.round(blended * 1000) / 10));

  const breakdown: MatchBreakdown = {
    skillCoverage: Number(skillCoverage.toFixed(3)),
    keywordRelevance: Number(keywordRelevance.toFixed(3)),
    semanticSimilarity: semantic === null ? null : Number(semantic.toFixed(3)),
    engine: semantic === null ? 'taxonomy+tfidf' : 'taxonomy+tfidf+semantic',
    weights,
  };

  const suggestions = quick
    ? []
    : buildSuggestions({
        analysis,
        missing: analysis.skills.filter((skill) => !resumeSkillIds.has(skill.id)),
        hits,
        coverage: skillCoverage,
        keyword: keywordRelevance,
        resumeText,
        jdText,
      });

  return {
    resumeId: null,
    score,
    matchedSkills,
    missingSkills,
    breakdown,
    suggestions,
    summary: buildSummary(score, matchedSkills.length, analysis.skills.length, missingSkills),
    engine: breakdown.engine,
  };
}

/** Cheap variant used to preview scores for a list of discovered jobs. */
export function quickMatchScore(resumeText: string, jdText: string): number | null {
  if (!resumeText || !jdText || jdText.length < 120) return null;
  return computeMatch({ resumeText, jdText, quick: true }).score;
}

export const MATCH_WEIGHTS = { WEIGHTS, WEIGHTS_NO_SEMANTIC, WEIGHTS_NO_SKILLS };

/** Exposed for tests + UI copy. */
export function describeScore(score: number): string {
  if (score >= 80) return 'Strong match — apply with confidence and lead with your best evidence.';
  if (score >= 65) return 'Good match — worth applying; tailor the resume summary to the posting.';
  if (score >= 45)
    return 'Partial match — apply only if the role excites you, and address the gaps in a cover letter.';
  return 'Weak match — the core stack differs; expect a harder screening.';
}

export function summarizeGapText(reason: string): string {
  return truncate(reason, 200);
}
