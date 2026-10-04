import { createResumeSchema, updateResumeSchema } from '@applyai/shared/schemas';
import type { Resume } from '@applyai/shared/types';
import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db';
import { resumes } from '../db/schema';
import { AppError, ok } from '../lib/errors';
import { toResume } from '../lib/serializers';
import { validate } from '../lib/validate';
import { extractSkillIds } from '../match/skills';
import { countWords, normalizeText } from '../match/text';
import { parseResumeFile } from '../services/ml-client';

export const resumeRoutes = new Hono();

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Control characters corrupt matched text and PDF extraction, so they are
 * replaced with spaces. Tab (\u0009) and newline (\u000a) are deliberately kept:
 * resume structure depends on them, and \p{Cc} cannot express that exclusion.
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: the ranges keep tab and newline on purpose
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;

/** Strip control characters and collapse whitespace so downstream matching is stable. */
function cleanResumeText(input: string): string {
  return normalizeText(input.replace(CONTROL_CHARACTERS, ' ').replace(/\r\n?/g, '\n'));
}

async function resumeSummaries(userId: string): Promise<Map<string, Resume['summary']>> {
  const result = (await db.execute(sql`
    select r.id as resume_id,
           count(a.id)::int as usage_count,
           count(a.id) filter (where a.status in ('interview', 'offer'))::int as interviews,
           count(a.id) filter (where a.status = 'offer')::int as offers,
           avg(a.match_score) as avg_match
    from resumes r
    left join applications a on a.resume_id = r.id
    where r.user_id = ${userId}
    group by r.id
  `)) as unknown as {
    rows: Array<{
      resume_id: string;
      usage_count: number;
      interviews: number;
      offers: number;
      avg_match: string | null;
    }>;
  };

  const map = new Map<string, Resume['summary']>();
  for (const row of result.rows ?? []) {
    const usage = Number(row.usage_count);
    const interviews = Number(row.interviews);
    map.set(row.resume_id, {
      usageCount: usage,
      interviews,
      offers: Number(row.offers),
      avgMatchScore: row.avg_match === null ? null : Math.round(Number(row.avg_match) * 10) / 10,
      interviewRate: usage > 0 ? Math.round((interviews / usage) * 1000) / 10 : null,
    });
  }
  return map;
}

resumeRoutes.get('/', async (c) => {
  const user = c.get('user');
  const [rows, summaries] = await Promise.all([
    db.select().from(resumes).where(eq(resumes.userId, user.id)).orderBy(resumes.createdAt),
    resumeSummaries(user.id),
  ]);
  const data = rows
    .map((row) => ({ ...toResume(row), summary: summaries.get(row.id) }))
    .sort(
      (a, b) => Number(b.isActive) - Number(a.isActive) || a.createdAt.localeCompare(b.createdAt),
    );
  return ok(c, data);
});

resumeRoutes.get('/:id', async (c) => {
  const user = c.get('user');
  const [row] = await db
    .select()
    .from(resumes)
    .where(and(eq(resumes.id, c.req.param('id')), eq(resumes.userId, user.id)))
    .limit(1);
  if (!row) throw AppError.notFound('Resume');
  const summaries = await resumeSummaries(user.id);
  return ok(c, { ...toResume(row), summary: summaries.get(row.id) });
});

/** Create from pasted text (the honest, always-available path). */
resumeRoutes.post('/', validate('json', createResumeSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');

  let parsedText: string | null = null;
  let skills: string[] = [];
  let wordCount = 0;
  if (body.text) {
    parsedText = cleanResumeText(body.text);
    skills = extractSkillIds(parsedText);
    wordCount = countWords(parsedText);
  }

  // The first resume a user adds becomes the active one automatically.
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(resumes)
    .where(eq(resumes.userId, user.id));
  const shouldActivate = body.isActive || Number(count) === 0;

  if (shouldActivate) {
    await db.update(resumes).set({ isActive: false }).where(eq(resumes.userId, user.id));
  }

  const id = `res_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
  await db.insert(resumes).values({
    id,
    userId: user.id,
    label: body.label,
    source: 'paste',
    parsedText,
    skills,
    wordCount,
    isActive: shouldActivate,
  });

  const [row] = await db.select().from(resumes).where(eq(resumes.id, id));
  return ok(c, toResume(row), 201);
});

/** Upload a PDF/DOCX/TXT resume. PDFs need the optional ML service. */
resumeRoutes.post('/import', async (c) => {
  const user = c.get('user');
  const contentType = c.req.header('content-type') ?? '';

  let label = '';
  let text = '';
  let fileName: string | null = null;
  let source: 'paste' | 'upload' = 'paste';
  let makeActive = true;

  if (contentType.includes('multipart/form-data')) {
    const form = await c.req.parseBody();
    const file = form.file;
    label = typeof form.label === 'string' ? form.label : '';
    makeActive = form.isActive === undefined ? true : form.isActive !== 'false';

    if (!(file instanceof File)) {
      throw AppError.badRequest('Attach a file in the "file" field.');
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw AppError.badRequest('Files larger than 8MB are not supported.');
    }
    fileName = file.name;
    source = 'upload';

    const looksTextual =
      /\.(txt|md|markdown|rst)$/i.test(file.name) || file.type.startsWith('text/');
    if (looksTextual) {
      text = await file.text();
    } else {
      const parsed = await parseResumeFile(file);
      text = parsed.text;
    }
    if (!label) label = file.name.replace(/\.[^.]+$/, '').slice(0, 100);
  } else {
    const body = (await c.req.json().catch(() => null)) as {
      label?: string;
      text?: string;
      isActive?: boolean;
    } | null;
    if (!body?.text || body.text.trim().length < 40) {
      throw AppError.badRequest('Provide resume text (at least 40 characters) or upload a file.');
    }
    label = body.label?.trim() || 'Pasted resume';
    makeActive = body.isActive !== false;
    text = body.text;
  }

  const parsedText = cleanResumeText(text);
  if (parsedText.length < 40) {
    throw AppError.badRequest('That file produced almost no text — it may be a scanned image.');
  }

  if (makeActive) {
    await db.update(resumes).set({ isActive: false }).where(eq(resumes.userId, user.id));
  }

  const id = `res_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
  await db.insert(resumes).values({
    id,
    userId: user.id,
    label: label.slice(0, 100) || 'Resume',
    fileName,
    source,
    parsedText,
    skills: extractSkillIds(parsedText),
    wordCount: countWords(parsedText),
    isActive: makeActive,
  });

  const [row] = await db.select().from(resumes).where(eq(resumes.id, id));
  return ok(c, toResume(row), 201);
});

resumeRoutes.patch('/:id', validate('json', updateResumeSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const id = c.req.param('id');

  const [existing] = await db
    .select()
    .from(resumes)
    .where(and(eq(resumes.id, id), eq(resumes.userId, user.id)))
    .limit(1);
  if (!existing) throw AppError.notFound('Resume');

  const patch: Partial<typeof resumes.$inferInsert> = { updatedAt: new Date() };
  if (body.label !== undefined) patch.label = body.label;
  if (body.text !== undefined && body.text !== null) {
    const parsedText = cleanResumeText(body.text);
    patch.parsedText = parsedText;
    patch.skills = extractSkillIds(parsedText);
    patch.wordCount = countWords(parsedText);
  }
  if (body.isActive === true) {
    await db.update(resumes).set({ isActive: false }).where(eq(resumes.userId, user.id));
    patch.isActive = true;
  } else if (body.isActive === false) {
    patch.isActive = false;
  }

  await db.update(resumes).set(patch).where(eq(resumes.id, id));
  const [row] = await db.select().from(resumes).where(eq(resumes.id, id));
  return ok(c, toResume(row));
});

resumeRoutes.post('/:id/activate', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const [existing] = await db
    .select()
    .from(resumes)
    .where(and(eq(resumes.id, id), eq(resumes.userId, user.id)))
    .limit(1);
  if (!existing) throw AppError.notFound('Resume');

  await db.update(resumes).set({ isActive: false }).where(eq(resumes.userId, user.id));
  await db.update(resumes).set({ isActive: true, updatedAt: new Date() }).where(eq(resumes.id, id));
  const [row] = await db.select().from(resumes).where(eq(resumes.id, id));
  return ok(c, toResume(row));
});

resumeRoutes.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const [existing] = await db
    .select()
    .from(resumes)
    .where(and(eq(resumes.id, id), eq(resumes.userId, user.id)))
    .limit(1);
  if (!existing) throw AppError.notFound('Resume');

  await db.delete(resumes).where(eq(resumes.id, id));

  // Applications keep their history: the FK is ON DELETE SET NULL.
  if (existing.isActive) {
    const [next] = await db
      .select()
      .from(resumes)
      .where(eq(resumes.userId, user.id))
      .orderBy(sql`${resumes.createdAt} desc`)
      .limit(1);
    if (next) await db.update(resumes).set({ isActive: true }).where(eq(resumes.id, next.id));
  }
  return ok(c, { deleted: true });
});
