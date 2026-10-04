/** Text utilities shared by the matcher, the importers and the cover-letter engine. */

const UNICODE_FIXES: Array<[RegExp, string]> = [
  [/[\u2018\u2019\u201B\u2032]/g, "'"],
  [/[\u201C\u201D\u2033]/g, '"'],
  [/[\u2010-\u2015]/g, '-'],
  [/\u2026/g, '...'],
  [/\u00a0/g, ' '],
  [/[\u2022\u25CF\u25AA\u25E6\u2043]/g, '-'],
];

/** Normalise quotes/dashes, lowercase, collapse horizontal whitespace (keeps newlines). */
export function normalizeText(input: string): string {
  let text = input.normalize('NFC');
  for (const [pattern, replacement] of UNICODE_FIXES) text = text.replace(pattern, replacement);
  return text
    .toLowerCase()
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Everything on one line (for token statistics and regex scanning). */
export function flattenText(input: string): string {
  return normalizeText(input)
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** Split into sentences, keeping offsets so callers can map back to the source. */
export function splitSentences(text: string): Array<{ text: string; start: number; end: number }> {
  const out: Array<{ text: string; start: number; end: number }> = [];
  const boundary = /([.!?]+\s+|\n+)/g;
  let cursor = 0;
  let match = boundary.exec(text);
  while (match) {
    const end = match.index + match[0].length;
    const chunk = text.slice(cursor, end);
    if (chunk.trim().length > 0) out.push({ text: chunk.trim(), start: cursor, end });
    cursor = end;
    match = boundary.exec(text);
  }
  if (cursor < text.length) {
    const chunk = text.slice(cursor);
    if (chunk.trim().length > 0) out.push({ text: chunk.trim(), start: cursor, end: text.length });
  }
  return out;
}

/** Sentence (or bullet) containing `index`, used to ground explanations in real resume text. */
export function sentenceAround(text: string, index: number, maxLength = 240): string {
  const starts = [
    text.lastIndexOf('\n', index - 1),
    text.lastIndexOf('. ', index - 1),
    text.lastIndexOf('- ', index - 1),
  ];
  const begin = Math.max(...starts.filter((i) => i !== -1), -1) + 1;
  const endCandidates = [
    text.indexOf('\n', index),
    text.indexOf('. ', index),
    text.indexOf('; ', index),
  ].filter((i) => i !== -1);
  const end =
    endCandidates.length > 0 ? Math.min(...endCandidates) + 1 : Math.min(text.length, index + 200);
  const sentence = text
    .slice(begin, end)
    .trim()
    .replace(/^[-*•]\s*/, '');
  return truncate(sentence, maxLength);
}

export const STOPWORDS = new Set(
  `a about above after again against all am an and any are aren't as at be because been before being below between both but by can can't cannot could couldn't did didn't do does doesn't doing don't down during each few for from further had hadn't has hasn't have haven't having he her here hers herself him himself his how i if in into is isn't it its itself let's me more most mustn't my myself no nor not of off on once only or other ought our ours ourselves out over own same shan't she should shouldn't so some such than that the their theirs them themselves then there these they this those through to too under until up very was wasn't we were weren't what when where which while who whom why with won't would wouldn't you your yours yourself yourselves we'll you'll we've we're able across along also although among around based best better build building built candidate candidates company day days different etc even every experience experienced getting give given great help high highly ideal including including join joining know knowledge like looking looking love make making many may might month months need needed new next one opportunity other others our position preferred plus possible proven provide providing quality ready really relevant require required requirement requirements responsible role roles skills strong team teams things think time today understand using want wanted well will wish within work working world would year years you your you're we're ability excellent good must-have nice`
    .split(/\s+/)
    .filter(Boolean),
);

/** Light stemmer — enough to pair "designing"/"design", "APIs"/"api". */
export function stem(token: string): string {
  let t = token;
  if (t.length > 4 && t.endsWith('ies')) return `${t.slice(0, -3)}y`;
  if (t.length > 4 && t.endsWith('ing')) t = t.slice(0, -3);
  else if (t.length > 3 && t.endsWith('ed')) t = t.slice(0, -2);
  else if (t.length > 3 && t.endsWith('es')) t = t.slice(0, -2);
  else if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) t = t.slice(0, -1);
  return t;
}

export function tokenize(text: string): string[] {
  const flat = flattenText(text);
  const raw = flat.match(/[a-z0-9][a-z0-9+#./-]*/g) ?? [];
  const tokens: string[] = [];
  for (const token of raw) {
    const cleaned = token.replace(/^[./-]+|[./-]+$/g, '');
    if (cleaned.length < 2) continue;
    if (/^\d+$/.test(cleaned)) continue;
    if (STOPWORDS.has(cleaned)) continue;
    tokens.push(stem(cleaned));
  }
  return tokens;
}

export interface KeywordStat {
  term: string;
  count: number;
}

/** Most distinctive single words and two-word phrases in a text. */
export function extractKeywords(text: string, limit = 25): KeywordStat[] {
  const flat = flattenText(text);
  const words = flat.match(/[a-z0-9][a-z0-9+#./-]*/g) ?? [];
  const counts = new Map<string, number>();

  const add = (term: string) => counts.set(term, (counts.get(term) ?? 0) + 1);

  let previous: string | null = null;
  for (const word of words) {
    const cleaned = word.replace(/^[./-]+|[./-]+$/g, '');
    const keep = cleaned.length > 2 && !/^\d+$/.test(cleaned) && !STOPWORDS.has(cleaned);
    if (keep) {
      add(stem(cleaned));
      if (previous) add(`${previous} ${stem(cleaned)}`);
      previous = stem(cleaned);
    } else {
      previous = null;
    }
  }

  return [...counts.entries()]
    .map(([term, count]) => ({ term, count }))
    .filter(({ term, count }) => (term.includes(' ') ? count > 1 : count > 0))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
    .slice(0, limit);
}

/** Very small HTML → text converter, good enough for job postings and ATS pages. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|li|h[1-6]|tr|section|article)\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

export function countWords(text: string): number {
  const matches = text.match(/\S+/g);
  return matches ? matches.length : 0;
}

/** Deterministic short id (used for event ids and cache keys). */
export function shortId(prefix = ''): string {
  const id = globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  return prefix ? `${prefix}_${id}` : id;
}
