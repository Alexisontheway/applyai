import { createCoverLetterSchema } from '@applyai/shared/schemas';
import type { MatchSkillHit } from '@applyai/shared/types';
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db';
import { applications, coverLetters, jobs, matchResults, resumes } from '../db/schema';
import { AppError, ok } from '../lib/errors';
import { toCoverLetter } from '../lib/serializers';
import { validate } from '../lib/validate';
import { shortId } from '../match/text';
import { rateLimit } from '../middleware/rate-limit';
import {
  type CoverLetterTone,
  coverLetterTitle,
  generateCoverLetter,
} from '../services/cover-letter';

export const coverLetterRoutes = new Hono();

const listQuerySchema = z.object({ applicationId: z.string().optional() });

coverLetterRoutes.get('/', validate('query', listQuerySchema), async (c) => {
  const user = c.get('user');
  const query = c.req.valid('query');
  const condition = query.applicationId
    ? and(eq(coverLetters.userId, user.id), eq(coverLetters.applicationId, query.applicationId))
    : eq(coverLetters.userId, user.id);

  const rows = await db
    .select({ letter: coverLetters, job: jobs })
    .from(coverLetters)
    .leftJoin(applications, eq(coverLetters.applicationId, applications.id))
    .leftJoin(jobs, eq(applications.jobId, jobs.id))
    .where(condition)
    .orderBy(desc(coverLetters.createdAt))
    .limit(100);

  return ok(
    c,
    rows.map((row) => toCoverLetter(row.letter, row.job?.company ?? null, row.job?.title ?? null)),
  );
});

coverLetterRoutes.get('/:id', async (c) => {
  const user = c.get('user');
  const [row] = await db
    .select({ letter: coverLetters, job: jobs })
    .from(coverLetters)
    .leftJoin(applications, eq(coverLetters.applicationId, applications.id))
    .leftJoin(jobs, eq(applications.jobId, jobs.id))
    .where(and(eq(coverLetters.id, c.req.param('id')), eq(coverLetters.userId, user.id)))
    .limit(1);
  if (!row) throw AppError.notFound('Cover letter');
  return ok(c, toCoverLetter(row.letter, row.job?.company ?? null, row.job?.title ?? null));
});

/**
 * Generate a letter for an application.
 *
 * Uses Ollama when it is configured and reachable, otherwise the local
 * template engine — the response always says which engine wrote it.
 */
coverLetterRoutes.post(
  '/',
  rateLimit({ scope: 'cover-letter', max: 20 }),
  validate('json', createCoverLetterSchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');

    const [application] = await db
      .select()
      .from(applications)
      .where(and(eq(applications.id, body.applicationId), eq(applications.userId, user.id)))
      .limit(1);
    if (!application) throw AppError.notFound('Application');

    const [job] = await db.select().from(jobs).where(eq(jobs.id, application.jobId)).limit(1);
    if (!job) throw AppError.notFound('Job');

    const resumeId = body.resumeId ?? application.resumeId ?? null;
    let resumeRow: typeof resumes.$inferSelect | undefined;
    if (resumeId) {
      [resumeRow] = await db
        .select()
        .from(resumes)
        .where(and(eq(resumes.id, resumeId), eq(resumes.userId, user.id)))
        .limit(1);
    } else {
      [resumeRow] = await db
        .select()
        .from(resumes)
        .where(and(eq(resumes.userId, user.id), eq(resumes.isActive, true)))
        .limit(1);
    }
    if (!resumeRow?.parsedText) {
      throw AppError.badRequest('Add a resume with text first — the letter is grounded in it.');
    }

    const [latestMatch] = await db
      .select()
      .from(matchResults)
      .where(eq(matchResults.applicationId, application.id))
      .orderBy(desc(matchResults.createdAt))
      .limit(1);

    const generated = await generateCoverLetter(
      {
        candidateName: user.name || 'Your name',
        candidateEmail: user.email,
        company: job.company,
        role: job.title,
        jobDescription: job.description,
        resumeText: resumeRow.parsedText,
        resumeLabel: resumeRow.label,
        matchedSkills: (latestMatch?.matchedSkills ?? []) as MatchSkillHit[],
        missingSkills: (latestMatch?.missingSkills ?? []) as Array<{ id: string; label: string }>,
        tone: body.tone as CoverLetterTone,
        instructions: body.instructions ?? null,
      },
      { local: body.local },
    );

    const id = shortId('cl');
    const title = coverLetterTitle({ role: job.title, company: job.company });
    await db.insert(coverLetters).values({
      id,
      userId: user.id,
      applicationId: application.id,
      resumeId: resumeRow.id,
      title,
      body: generated.body,
      tone: body.tone,
      engine: generated.engine,
    });

    const [row] = await db.select().from(coverLetters).where(eq(coverLetters.id, id));
    if (application.status === 'saved') {
      await db
        .update(applications)
        .set({ updatedAt: new Date() })
        .where(eq(applications.id, application.id));
    }

    return ok(
      c,
      { ...toCoverLetter(row, job.company, job.title), warnings: generated.warnings },
      201,
    );
  },
);

const patchSchema = z.object({
  body: z.string().min(1).max(20_000).optional(),
  title: z.string().min(1).max(200).optional(),
});

coverLetterRoutes.patch('/:id', validate('json', patchSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const [existing] = await db
    .select()
    .from(coverLetters)
    .where(and(eq(coverLetters.id, c.req.param('id')), eq(coverLetters.userId, user.id)))
    .limit(1);
  if (!existing) throw AppError.notFound('Cover letter');

  await db
    .update(coverLetters)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(coverLetters.id, existing.id));
  const [row] = await db.select().from(coverLetters).where(eq(coverLetters.id, existing.id));
  return ok(c, toCoverLetter(row));
});

coverLetterRoutes.delete('/:id', async (c) => {
  const user = c.get('user');
  const [existing] = await db
    .select()
    .from(coverLetters)
    .where(and(eq(coverLetters.id, c.req.param('id')), eq(coverLetters.userId, user.id)))
    .limit(1);
  if (!existing) throw AppError.notFound('Cover letter');
  await db.delete(coverLetters).where(eq(coverLetters.id, existing.id));
  return ok(c, { deleted: true });
});
