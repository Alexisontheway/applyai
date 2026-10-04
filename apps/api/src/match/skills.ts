/**
 * Skill extraction: free text in, canonical skills out.
 *
 * Design notes
 * ------------
 * - Aliases are compiled to word-boundary regexes once per process.
 * - Overlapping matches are resolved longest-first, so "React Native" is not
 *   also counted as "React" and "Ruby on Rails" is not counted as "Ruby".
 * - Ambiguous aliases ("go", "r", "c") only count when the surrounding window
 *   contains another tech signal, which keeps normal English prose from
 *   inventing skills.
 */
import { SKILLS, type SkillDefinition, TECH_CONTEXT_WORDS } from '@applyai/shared/skills';
import { flattenText, sentenceAround } from './text';

interface CompiledAlias {
  skill: SkillDefinition;
  alias: string;
  re: RegExp;
  risky: boolean;
}

const BOUNDARY_BEFORE = '(?<![\\p{L}\\p{N}_])';
const BOUNDARY_AFTER = '(?![\\p{L}\\p{N}_])';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileAlias(skill: SkillDefinition, alias: string, risky: boolean): CompiledAlias {
  const normalised = escapeRegExp(alias.toLowerCase()).replace(/\\ /g, '\\s+');
  return {
    skill,
    alias,
    risky,
    // The `u` flag is required for \p{L} unicode property escapes — without it
    // the boundary class degenerates and matches *inside* words ("error" -> "ror").
    re: new RegExp(`${BOUNDARY_BEFORE}${normalised}${BOUNDARY_AFTER}`, 'giu'),
  };
}

const COMPILED: CompiledAlias[] = SKILLS.flatMap((skill) => [
  ...(skill.aliases ?? []).map((alias) => compileAlias(skill, alias, false)),
  compileAlias(skill, skill.label, false),
  ...(skill.risky ?? []).map((alias) => compileAlias(skill, alias, true)),
]);

const RISKY_REGEX = /^(go|r|c)$/i;
const TECH_WORDS = new Set(TECH_CONTEXT_WORDS);

interface RawHit {
  skill: SkillDefinition;
  alias: string;
  start: number;
  end: number;
  risky: boolean;
}

function collect(text: string): RawHit[] {
  const hits: RawHit[] = [];
  for (const entry of COMPILED) {
    entry.re.lastIndex = 0;
    let match = entry.re.exec(text);
    while (match) {
      hits.push({
        skill: entry.skill,
        alias: entry.alias,
        start: match.index,
        end: match.index + match[0].length,
        risky: entry.risky || RISKY_REGEX.test(entry.alias),
      });
      match = entry.re.exec(text);
    }
  }
  return hits;
}

/** True when the window around a risky alias looks technical. */
function hasTechContext(
  text: string,
  start: number,
  end: number,
  acceptedStarts: number[],
): boolean {
  const from = Math.max(0, start - 80);
  const to = Math.min(text.length, end + 80);
  const window = text.slice(from, to);
  for (const word of window.split(/[^a-z0-9+#.]+/i)) {
    if (TECH_WORDS.has(word.toLowerCase())) return true;
  }
  // Or it sits next to another accepted skill (", Python, R, SQL").
  return acceptedStarts.some((pos) => Math.abs(pos - start) < 60);
}

export interface SkillHit {
  id: string;
  label: string;
  category: string;
  count: number;
  contexts: string[];
  firstIndex: number;
}

export interface ExtractOptions {
  /** Keep up to this many grounded snippets per skill (default 3). */
  maxContexts?: number;
}

export function extractSkillHits(input: string, options: ExtractOptions = {}): SkillHit[] {
  const text = flattenText(input);
  if (!text) return [];
  const maxContexts = options.maxContexts ?? 3;

  const hits = collect(text);
  // Longest match wins; ties resolved by earliest position then skill id.
  hits.sort(
    (a, b) =>
      b.end - b.start - (a.end - a.start) ||
      a.start - b.start ||
      a.skill.id.localeCompare(b.skill.id),
  );

  const accepted: RawHit[] = [];
  const acceptedStarts: number[] = [];
  for (const hit of hits) {
    const overlaps = accepted.some((other) => hit.start < other.end && other.start < hit.end);
    if (overlaps) continue;
    if (hit.risky && !hasTechContext(text, hit.start, hit.end, acceptedStarts)) continue;
    accepted.push(hit);
    acceptedStarts.push(hit.start);
  }

  const bySkill = new Map<string, SkillHit>();
  for (const hit of accepted.sort((a, b) => a.start - b.start)) {
    const existing = bySkill.get(hit.skill.id);
    const context = sentenceAround(text, hit.start);
    if (existing) {
      existing.count += 1;
      if (
        existing.contexts.length < maxContexts &&
        context &&
        !existing.contexts.includes(context)
      ) {
        existing.contexts.push(context);
      }
      continue;
    }
    bySkill.set(hit.skill.id, {
      id: hit.skill.id,
      label: hit.skill.label,
      category: hit.skill.category,
      count: 1,
      contexts: context ? [context] : [],
      firstIndex: hit.start,
    });
  }

  return [...bySkill.values()].sort((a, b) => b.count - a.count || a.firstIndex - b.firstIndex);
}

export function extractSkillIds(input: string): string[] {
  return extractSkillHits(input).map((hit) => hit.id);
}

const CATEGORY_ORDER: Array<SkillDefinition['category']> = [
  'language',
  'frontend',
  'backend',
  'database',
  'cloud',
  'devops',
  'data',
  'ml',
  'mobile',
  'testing',
  'security',
  'design',
  'product',
  'soft',
];

/** Grouped skills for UI chips and resume summaries. */
export function groupSkillsByIds(
  ids: string[],
): Array<{ category: string; skills: Array<{ id: string; label: string }> }> {
  const wanted = new Set(ids);
  const groups = new Map<string, Array<{ id: string; label: string }>>();
  for (const skill of SKILLS) {
    if (!wanted.has(skill.id)) continue;
    const list = groups.get(skill.category) ?? [];
    list.push({ id: skill.id, label: skill.label });
    groups.set(skill.category, list);
  }
  return CATEGORY_ORDER.filter((c) => groups.has(c)).map((category) => ({
    category,
    skills: groups.get(category) as Array<{ id: string; label: string }>,
  }));
}
