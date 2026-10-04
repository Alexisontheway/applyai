import type { MatchSkillHit } from '@applyai/shared/types';
/**
 * Cover-letter generation.
 *
 * Two engines:
 *  1. `ollama`  — a local LLM when OLLAMA_URL is configured. Grounded with the
 *                 resume text, the posting and the matched skills, and told
 *                 explicitly not to invent experience.
 *  2. `template` — a deterministic composer that only ever quotes material that
 *                 is provably in the resume. Always available, no API cost, and
 *                 the honest fallback when no model is running.
 *
 * Both write for the same reader: a human recruiter skimming for evidence.
 */
import { env } from '../env';
import { logger } from '../lib/logger';
import { truncate } from '../match/text';

export type CoverLetterTone = 'professional' | 'concise' | 'enthusiastic' | 'technical';

export interface CoverLetterContext {
  candidateName: string;
  candidateEmail: string;
  company: string;
  role: string;
  jobDescription: string | null;
  resumeText: string;
  resumeLabel: string | null;
  matchedSkills: MatchSkillHit[];
  missingSkills: Array<{ id: string; label: string }>;
  tone: CoverLetterTone;
  instructions?: string | null;
}

export interface GeneratedCoverLetter {
  body: string;
  engine: string;
  warnings: string[];
}

// ------------------------------------------------------------------ helpers

/** Bullet-ish lines from the resume that demonstrate a skill, best first. */
function evidenceForSkill(hit: MatchSkillHit, resumeText: string): string | null {
  const context = hit.contexts?.find((entry) => entry.length > 30);
  if (context) return truncate(cleanBullet(context), 220);
  const lines = resumeText
    .split('\n')
    .map((line) => cleanBullet(line))
    .filter((line) => line.length > 25);
  const match = lines.find((line) => line.toLowerCase().includes(hit.label.toLowerCase()));
  return match ? truncate(match, 220) : null;
}

function cleanBullet(value: string): string {
  return value
    .replace(/^[\s\-•*·▪◦]+/, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[;,.]$/, '')
    .trim();
}

const TONE_OPENERS: Record<CoverLetterTone, (role: string, company: string) => string> = {
  professional: (role, company) => `I would like to apply for the ${role} position at ${company}.`,
  concise: (role, company) => `I am applying for the ${role} role at ${company}.`,
  enthusiastic: (role, company) =>
    `I was genuinely excited to see the ${role} opening at ${company} — it lines up closely with the work I do best.`,
  technical: (role, company) =>
    `I am applying for the ${role} role at ${company}. My background maps directly onto the stack described in the posting.`,
};

function overlapSentence(ctx: CoverLetterContext): string | null {
  const top = ctx.matchedSkills.slice(0, 4).map((skill) => skill.label);
  if (top.length === 0) return null;
  const list =
    top.length === 1 ? top[0] : `${top.slice(0, -1).join(', ')} and ${top[top.length - 1]}`;
  return `The posting's core requirements map onto work I already do: ${list}.`;
}

function gapSentence(ctx: CoverLetterContext): string | null {
  const missing = ctx.missingSkills.slice(0, 2).map((skill) => skill.label);
  if (missing.length === 0) return null;
  const list = missing.length === 1 ? missing[0] : `${missing[0]} and ${missing[1]}`;
  const anchor = ctx.matchedSkills[0]?.label;
  if (ctx.tone === 'concise') {
    return `I am still building depth in ${list}; my day-to-day work with ${anchor ?? 'adjacent systems'} is closely related.`;
  }
  return `I want to be straightforward about one thing: ${list} ${missing.length === 1 ? 'is' : 'are'} new territory for me in a production setting. ${
    anchor ? `My work with ${anchor} means the concepts transfer, ` : ''
  }and I would rather tell you that now than have it surface in a technical interview.`;
}

function bullets(ctx: CoverLetterContext): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const skill of ctx.matchedSkills.slice(0, 6)) {
    const evidence = evidenceForSkill(skill, ctx.resumeText);
    if (!evidence || seen.has(evidence)) continue;
    seen.add(evidence);
    out.push(`- ${skill.label}: ${evidence}`);
    if (out.length >= 3) break;
  }
  return out;
}

function signature(ctx: CoverLetterContext): string {
  const lines = ['Best regards,', ctx.candidateName];
  if (ctx.candidateEmail) lines.push(ctx.candidateEmail);
  if (ctx.resumeLabel) lines.push(`(Resume attached: ${ctx.resumeLabel})`);
  return lines.join('\n');
}

const CLOSERS: Record<CoverLetterTone, string> = {
  professional:
    'I would welcome the chance to talk through how I can contribute, and I am happy to share more detail on any part of my background.',
  concise: 'I would welcome a short conversation about the role.',
  enthusiastic:
    'I would love the chance to talk about where the team is heading and how I can help get there.',
  technical:
    'Happy to walk through implementation details, trade-offs and past architectures if that is useful.',
};

export function buildTemplateLetter(ctx: CoverLetterContext): string {
  const greeting = `Dear ${ctx.company} hiring team,`;
  const evidence = bullets(ctx);
  const parts: string[] = [greeting, ''];

  const opener = TONE_OPENERS[ctx.tone](ctx.role, ctx.company);
  const overlap = overlapSentence(ctx);
  parts.push([opener, overlap].filter(Boolean).join(' '));
  parts.push('');

  if (evidence.length > 0 && ctx.tone !== 'concise') {
    parts.push('Concrete examples from my resume that match what you are asking for:');
    parts.push(...evidence);
    parts.push('');
  } else if (evidence.length > 0) {
    parts.push(truncate(evidence.map((line) => line.replace(/^- /, '')).join('; '), 300));
    parts.push('');
  }

  const gap = gapSentence(ctx);
  if (gap) {
    parts.push(gap);
    parts.push('');
  }

  if (ctx.instructions) {
    parts.push(`${truncate(ctx.instructions, 240)}`);
    parts.push('');
  }

  parts.push(CLOSERS[ctx.tone]);
  parts.push('');
  parts.push(signature(ctx));
  return parts.join('\n');
}

// ------------------------------------------------------------------ Ollama

const SYSTEM_PROMPT = `You write cover letters that a busy hiring manager will actually finish.
Rules you must never break:
- Only use facts contained in the candidate's resume. Never invent employers, dates, metrics, degrees or projects.
- Do not use placeholder brackets. Address the specific company and role by name.
- 3 to 4 short paragraphs, plain text, no markdown headings, no bullet characters.
- Sound like a competent human, not a press release. No "I am writing to express my keen interest".
- If the resume lacks something the posting asks for, acknowledge it briefly and honestly instead of hiding it.`;

function buildPrompt(ctx: CoverLetterContext): string {
  const matched = ctx.matchedSkills.map((skill) => skill.label).join(', ') || 'none detected';
  const missing = ctx.missingSkills.map((skill) => skill.label).join(', ') || 'none detected';
  return `Write a ${ctx.tone} cover letter.

ROLE: ${ctx.role}
COMPANY: ${ctx.company}

SKILLS THE CANDIDATE DEMONSTRABLY HAS (from the resume): ${matched}
SKILLS THE POSTING ASKS FOR THAT THE RESUME DOES NOT SHOW: ${missing}

JOB DESCRIPTION:
${truncate(ctx.jobDescription ?? 'Not provided.', 6000)}

CANDIDATE RESUME:
${truncate(ctx.resumeText, 8000)}

CANDIDATE NAME: ${ctx.candidateName}
CANDIDATE EMAIL: ${ctx.candidateEmail}
${ctx.instructions ? `EXTRA INSTRUCTION: ${ctx.instructions}` : ''}`;
}

async function generateWithOllama(ctx: CoverLetterContext): Promise<string | null> {
  if (!env.ollama.url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.ollama.timeoutMs);
  try {
    const response = await fetch(`${env.ollama.url}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: env.ollama.model,
        prompt: buildPrompt(ctx),
        system: SYSTEM_PROMPT,
        stream: false,
        options: { temperature: 0.4, num_predict: 900 },
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      logger.warn('ollama returned an error', { status: response.status });
      return null;
    }
    const payload = (await response.json()) as { response?: string };
    return payload.response?.trim() ?? null;
  } catch (error) {
    logger.warn('ollama unreachable — falling back to the template engine', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Models like to add chatter; keep only the letter itself. */
export function sanitizeLlmLetter(raw: string, ctx: CoverLetterContext): string {
  let text = raw
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/```$/g, '')
    .replace(/^(here('| i)s|sure[,!]?)[^\n]*\n+/i, '')
    .replace(/^(cover letter|subject:.*)\n+/i, '')
    .trim();

  // Replace any stray placeholders with the real values.
  text = text
    .replace(/\[(company|company name|employer)\]/gi, ctx.company)
    .replace(/\[(role|position|job title)\]/gi, ctx.role)
    .replace(/\[(your name|candidate name|name)\]/gi, ctx.candidateName)
    .replace(/\[([^\]]+)\]/g, '');

  if (!/dear /i.test(text.slice(0, 200))) {
    text = `Dear ${ctx.company} hiring team,\n\n${text}`;
  }
  if (!/regards|sincerely|best,/i.test(text.slice(-200))) {
    text = `${text}\n\n${signature(ctx)}`;
  }
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

export async function generateCoverLetter(
  ctx: CoverLetterContext,
  options: { local?: boolean } = {},
): Promise<GeneratedCoverLetter> {
  const warnings: string[] = [];
  const template = buildTemplateLetter(ctx);

  if (!options.local && env.ollama.url) {
    const generated = await generateWithOllama(ctx);
    if (generated) {
      const body = sanitizeLlmLetter(generated, ctx);
      if (body.length > 400) {
        return { body, engine: `ollama:${env.ollama.model}`, warnings };
      }
      warnings.push(
        'The model returned an unusably short letter; the built-in template was used instead.',
      );
    } else {
      warnings.push('Could not reach Ollama — generated with the built-in template engine.');
    }
  }

  return { body: template, engine: 'template:v1', warnings };
}

export function coverLetterTitle(ctx: Pick<CoverLetterContext, 'role' | 'company'>): string {
  return `${ctx.role} — ${ctx.company}`;
}
