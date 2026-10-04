import type {
  CreateApplicationInput,
  TrackJobInput,
  UpdateApplicationInput,
} from '@applyai/shared/schemas';
import type { Application, MatchResult } from '@applyai/shared/types';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  applications,
  applicationsEvents,
  companies,
  coverLetters,
  jobs,
  matchResults,
  resumes,
} from '../db/schema';
import { AppError } from '../lib/errors';
import { toApplication, toEvent, toMatchResult } from '../lib/serializers';
import { computeMatch } from '../match/score';
import { extractSkillHits } from '../match/skills';
import { shortId } from '../match/text';
import { semanticSimilarity } from './ml-client';

export interface EventInput {
  type: 'created' | 'status_changed' | 'note' | 'scored' | 'cover_letter' | 'follow_up';
  fromStatus?: Application['status'] | null;
  toStatus?: Application['status'] | null;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function logEvent(
  userId: string,
  applicationId: string,
  event: EventInput,
): Promise<void> {
  await db.insert(applicationsEvents).values({
    id: shortId('evt'),
    userId,
    applicationId,
    type: event.type,
    fromStatus: event.fromStatus ?? null,
    toStatus: event.toStatus ?? null,
    message: event.message ?? null,
    metadata: event.metadata ?? null,
  });
}

/** Create-or-reuse the company row for a job, merging any tech stack we learn. */
export async function ensureCompany(
  userId: string,
  name: string,
  options: { techStack?: string[] | null; domain?: string | null } = {},
): Promise<string> {
  const cleanName = name.trim().slice(0, 200) || 'Unknown';
  const existing = await db
    .select()
    .from(companies)
    .where(and(eq(companies.userId, userId), eq(companies.name, cleanName)))
    .limit(1);

  const incoming = options.techStack ?? [];
  if (existing[0]) {
    const merged = [...new Set([...(existing[0].techStack ?? []), ...incoming])].slice(0, 80);
    const changed = merged.length !== (existing[0].techStack ?? []).length;
    if (changed || options.domain) {
      await db
        .update(companies)
        .set({
          techStack: merged,
          domain: existing[0].domain ?? options.domain ?? null,
          updatedAt: new Date(),
        })
        .where(eq(companies.id, existing[0].id));
    }
    return existing[0].id;
  }

  const id = shortId('cmp');
  await db.insert(companies).values({
    id,
    userId,
    name: cleanName,
    domain: options.domain ?? null,
    website: options.domain ? `https://${options.domain.replace(/^https?:\/\//, '')}` : null,
    techStack: incoming.slice(0, 80),
  });
  return id;
}

async function loadApplicationRow(userId: string, applicationId: string) {
  const rows = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
    .limit(1);
  if (!rows[0]) throw AppError.notFound('Application');
  return rows[0];
}

async function loadJobRow(jobId: string) {
  const rows = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!rows[0]) throw AppError.notFound('Job');
  return rows[0];
}

/** Full detail for the drawer: job, latest match, event timeline, letter count. */
export async function getApplicationDetail(
  userId: string,
  applicationId: string,
): Promise<Application> {
  const row = await loadApplicationRow(userId, applicationId);
  const [jobRow] = await db.select().from(jobs).where(eq(jobs.id, row.jobId)).limit(1);

  let resumeLabel: string | null = null;
  if (row.resumeId) {
    const [resumeRow] = await db
      .select({ label: resumes.label })
      .from(resumes)
      .where(eq(resumes.id, row.resumeId))
      .limit(1);
    resumeLabel = resumeRow?.label ?? null;
  }

  const application = toApplication(row, jobRow ?? null, resumeLabel);

  const [matchRow] = await db
    .select()
    .from(matchResults)
    .where(eq(matchResults.applicationId, applicationId))
    .orderBy(desc(matchResults.createdAt))
    .limit(1);

  const events = await db
    .select()
    .from(applicationsEvents)
    .where(eq(applicationsEvents.applicationId, applicationId))
    .orderBy(desc(applicationsEvents.createdAt))
    .limit(30);

  const [letters] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(coverLetters)
    .where(eq(coverLetters.applicationId, applicationId));

  return {
    ...application,
    match: matchRow ? toMatchResult(matchRow) : null,
    events: events.map(toEvent),
    coverLetterCount: letters?.count ?? 0,
  };
}

export interface ScoreOptions {
  resumeId?: string | null;
  /** Persist the result and update the application (default true). */
  persist?: boolean;
}

export async function scoreApplication(
  userId: string,
  applicationId: string,
  options: ScoreOptions = {},
): Promise<MatchResult> {
  const application = await loadApplicationRow(userId, applicationId);
  const job = await loadJobRow(application.jobId);

  const resumeId = options.resumeId ?? application.resumeId ?? null;
  let resumeRow: typeof resumes.$inferSelect | undefined;
  if (resumeId) {
    [resumeRow] = await db
      .select()
      .from(resumes)
      .where(and(eq(resumes.id, resumeId), eq(resumes.userId, userId)))
      .limit(1);
  } else {
    [resumeRow] = await db
      .select()
      .from(resumes)
      .where(and(eq(resumes.userId, userId), eq(resumes.isActive, true)))
      .limit(1);
  }

  if (!resumeRow?.parsedText) {
    throw AppError.badRequest(
      'No resume text to match against. Add a resume (paste the text or upload a PDF) and try again.',
    );
  }
  if (!job.description || job.description.trim().length < 120) {
    throw AppError.badRequest(
      'This job has no usable description. Add the posting text (or import it from the job URL) first.',
    );
  }

  const semantic = await semanticSimilarity(resumeRow.parsedText, job.description);
  const result = computeMatch({
    resumeText: resumeRow.parsedText,
    jdText: job.description,
    semanticSimilarity: semantic,
  });

  if (options.persist === false) {
    return { ...result, resumeId: resumeRow.id, applicationId };
  }

  const id = shortId('mat');
  await db.insert(matchResults).values({
    id,
    userId,
    applicationId,
    resumeId: resumeRow.id,
    score: result.score.toFixed(1),
    matchedSkills: result.matchedSkills,
    missingSkills: result.missingSkills,
    breakdown: result.breakdown as unknown as Record<string, unknown>,
    suggestions: result.suggestions,
    summary: result.summary,
    engine: result.engine,
  });

  await db
    .update(applications)
    .set({
      matchScore: result.score.toFixed(1),
      resumeId: resumeRow.id,
      updatedAt: new Date(),
    })
    .where(eq(applications.id, applicationId));

  await logEvent(userId, applicationId, {
    type: 'scored',
    message: result.summary,
    metadata: { score: result.score, engine: result.engine },
  });

  return {
    ...result,
    id,
    resumeId: resumeRow.id,
    applicationId,
    createdAt: new Date().toISOString(),
  };
}

/** Save a job (dedup by URL) and start tracking it, with an optional match score. */
export async function trackJob(
  userId: string,
  input: TrackJobInput,
): Promise<{ application: Application; created: boolean; match: MatchResult | null }> {
  let jobRow: typeof jobs.$inferSelect | undefined;

  if (input.url) {
    [jobRow] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.userId, userId), eq(jobs.url, input.url)))
      .limit(1);
  }

  if (!jobRow) {
    const companyId = await ensureCompany(userId, input.company, {
      techStack: input.techStack ?? null,
    });
    const id = shortId('job');
    const techStack = input.techStack?.length
      ? input.techStack
      : input.description
        ? extractSkillHits(input.description, { maxContexts: 0 })
            .slice(0, 25)
            .map((hit) => hit.label)
        : null;
    await db.insert(jobs).values({
      id,
      userId,
      companyId,
      title: input.title,
      company: input.company,
      location: input.location ?? null,
      url: input.url ?? null,
      source: input.source,
      salaryMin: input.salaryMin ?? null,
      salaryMax: input.salaryMax ?? null,
      description: input.description ?? null,
      techStack,
      postedAt: input.postedAt ? new Date(input.postedAt) : null,
    });
    [jobRow] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  }

  const job = jobRow as typeof jobs.$inferSelect;

  const [existing] = await db
    .select()
    .from(applications)
    .where(and(eq(applications.userId, userId), eq(applications.jobId, job.id)))
    .limit(1);

  if (existing) {
    return {
      application: await getApplicationDetail(userId, existing.id),
      created: false,
      match: null,
    };
  }

  const applicationId = shortId('app');
  await db.insert(applications).values({
    id: applicationId,
    userId,
    jobId: job.id,
    status: input.status,
    resumeId: input.resumeId ?? null,
    notes: input.notes ?? null,
    followUpDate: input.followUpDate ?? null,
  });

  await logEvent(userId, applicationId, {
    type: 'created',
    toStatus: input.status,
    message: `Saved ${job.title} at ${job.company}`,
  });

  let match: MatchResult | null = null;
  if (input.score) {
    try {
      match = await scoreApplication(userId, applicationId, { resumeId: input.resumeId ?? null });
    } catch (error) {
      // Scoring is a bonus on the tracking path — never fail the save.
      if (!(error instanceof AppError)) throw error;
    }
  }

  return { application: await getApplicationDetail(userId, applicationId), created: true, match };
}

export async function createApplication(
  userId: string,
  input: CreateApplicationInput,
): Promise<Application> {
  const job = await loadJobRow(input.jobId);
  if (job.userId !== userId) throw AppError.notFound('Job');

  const [existing] = await db
    .select()
    .from(applications)
    .where(and(eq(applications.userId, userId), eq(applications.jobId, input.jobId)))
    .limit(1);
  if (existing) throw new AppError('You are already tracking this job', 409);

  const id = shortId('app');
  await db.insert(applications).values({
    id,
    userId,
    jobId: input.jobId,
    status: input.status,
    resumeId: input.resumeId ?? null,
    notes: input.notes ?? null,
    followUpDate: input.followUpDate ?? null,
  });
  await logEvent(userId, id, {
    type: 'created',
    toStatus: input.status,
    message: `Tracking ${job.title}`,
  });

  if (input.score) {
    try {
      await scoreApplication(userId, id, { resumeId: input.resumeId ?? null });
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
    }
  }
  return getApplicationDetail(userId, id);
}

export async function updateApplication(
  userId: string,
  applicationId: string,
  input: UpdateApplicationInput,
): Promise<Application> {
  const row = await loadApplicationRow(userId, applicationId);
  const patch: Partial<typeof applications.$inferInsert> = { updatedAt: new Date() };
  const events: EventInput[] = [];

  if (input.status !== undefined && input.status !== row.status) {
    patch.status = input.status;
    events.push({
      type: 'status_changed',
      fromStatus: row.status,
      toStatus: input.status,
      message: `Moved from ${row.status} to ${input.status}`,
    });
  }
  if (input.notes !== undefined) {
    patch.notes = input.notes ?? null;
    if ((row.notes ?? '') !== (input.notes ?? ''))
      events.push({ type: 'note', message: 'Notes updated' });
  }
  if (input.followUpDate !== undefined) {
    patch.followUpDate = input.followUpDate ?? null;
    if (input.followUpDate) {
      events.push({ type: 'follow_up', message: `Follow-up scheduled for ${input.followUpDate}` });
    }
  }
  if (input.resumeId !== undefined) patch.resumeId = input.resumeId ?? null;
  if (input.matchScore !== undefined)
    patch.matchScore = input.matchScore === null ? null : input.matchScore.toFixed(1);

  await db.update(applications).set(patch).where(eq(applications.id, applicationId));
  for (const event of events) await logEvent(userId, applicationId, event);

  if (input.jobTitle || input.jobCompany) {
    await db
      .update(jobs)
      .set({
        ...(input.jobTitle ? { title: input.jobTitle } : {}),
        ...(input.jobCompany ? { company: input.jobCompany } : {}),
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, row.jobId));
  }

  return getApplicationDetail(userId, applicationId);
}

export async function deleteApplication(userId: string, applicationId: string): Promise<void> {
  await loadApplicationRow(userId, applicationId);
  await db
    .delete(applications)
    .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)));
}

export async function listApplications(
  userId: string,
  options: { status?: string; q?: string; limit?: number } = {},
): Promise<Application[]> {
  const conditions = [eq(applications.userId, userId)];
  if (options.status) {
    conditions.push(eq(applications.status, options.status as Application['status']));
  }
  const rows = await db
    .select({ application: applications, job: jobs, resumeLabel: resumes.label })
    .from(applications)
    .leftJoin(jobs, eq(applications.jobId, jobs.id))
    .leftJoin(resumes, eq(applications.resumeId, resumes.id))
    .where(and(...conditions))
    .orderBy(desc(applications.updatedAt))
    .limit(options.limit ?? 500);

  const query = options.q?.trim().toLowerCase();
  return rows
    .map((row) => toApplication(row.application, row.job ?? null, row.resumeLabel ?? null))
    .filter((application) =>
      query
        ? application.job?.title.toLowerCase().includes(query) ||
          application.job?.company.toLowerCase().includes(query)
        : true,
    );
}
