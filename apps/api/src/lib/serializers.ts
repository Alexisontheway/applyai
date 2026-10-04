/**
 * Database rows → wire types.
 *
 * Postgres returns `numeric` as strings and `date` as strings; the API must
 * hand the client numbers and ISO timestamps so the UI never parses decimals.
 */
import type {
  Application,
  ApplicationEvent,
  Company,
  CoverLetter,
  Job,
  MatchBreakdown,
  MatchResult,
  Resume,
} from '@applyai/shared/types';
import type {
  applications,
  applicationsEvents,
  companies,
  coverLetters,
  jobs,
  matchResults,
  resumes,
} from '../db/schema';

type JobRow = typeof jobs.$inferSelect;
type ApplicationRow = typeof applications.$inferSelect;
type ResumeRow = typeof resumes.$inferSelect;
type CompanyRow = typeof companies.$inferSelect;
type MatchRow = typeof matchResults.$inferSelect;
type CoverLetterRow = typeof coverLetters.$inferSelect;
type EventRow = typeof applicationsEvents.$inferSelect;

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function num(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function daysSince(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 86_400_000));
}

export function toJob(row: JobRow): Job {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    companyId: row.companyId,
    location: row.location,
    url: row.url,
    source: row.source,
    salaryMin: row.salaryMin,
    salaryMax: row.salaryMax,
    description: row.description,
    techStack: row.techStack ?? null,
    postedAt: iso(row.postedAt),
    createdAt: iso(row.createdAt) as string,
  };
}

export function toApplication(
  row: ApplicationRow,
  job: JobRow | null,
  resumeLabel: string | null = null,
): Application {
  return {
    id: row.id,
    userId: row.userId,
    jobId: row.jobId,
    status: row.status,
    resumeId: row.resumeId,
    matchScore: num(row.matchScore),
    notes: row.notes,
    followUpDate: row.followUpDate ?? null,
    createdAt: iso(row.createdAt) as string,
    updatedAt: iso(row.updatedAt) as string,
    job: job ? toJob(job) : null,
    resumeLabel,
    daysInStage: daysSince(row.updatedAt),
  };
}

export function toResume(row: ResumeRow): Resume {
  return {
    id: row.id,
    label: row.label,
    fileName: row.fileName,
    fileUrl: row.fileUrl,
    source: (row.source as Resume['source']) ?? 'paste',
    parsedText: row.parsedText,
    skills: row.skills ?? [],
    wordCount: row.wordCount,
    isActive: row.isActive,
    createdAt: iso(row.createdAt) as string,
    updatedAt: iso(row.updatedAt) as string,
  };
}

export function toCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    website: row.website,
    industry: row.industry,
    size: row.size,
    glassdoorRating: num(row.glassdoorRating),
    techStack: row.techStack ?? [],
    notes: row.notes,
    createdAt: iso(row.createdAt) as string,
    updatedAt: iso(row.updatedAt) as string,
  };
}

export function toMatchResult(row: MatchRow): MatchResult {
  return {
    id: row.id,
    applicationId: row.applicationId,
    resumeId: row.resumeId,
    score: num(row.score) ?? 0,
    matchedSkills: row.matchedSkills ?? [],
    missingSkills: row.missingSkills ?? [],
    breakdown: row.breakdown as unknown as MatchBreakdown,
    suggestions: row.suggestions ?? [],
    summary: row.summary,
    createdAt: iso(row.createdAt) as string,
  };
}

export function toCoverLetter(
  row: CoverLetterRow,
  company?: string | null,
  role?: string | null,
): CoverLetter {
  return {
    id: row.id,
    applicationId: row.applicationId,
    resumeId: row.resumeId,
    title: row.title,
    body: row.body,
    tone: row.tone,
    engine: row.engine,
    createdAt: iso(row.createdAt) as string,
    updatedAt: iso(row.updatedAt) as string,
    company: company ?? null,
    role: role ?? null,
  };
}

export function toEvent(row: EventRow): ApplicationEvent {
  return {
    id: row.id,
    type: row.type,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    message: row.message,
    createdAt: iso(row.createdAt) as string,
  };
}
