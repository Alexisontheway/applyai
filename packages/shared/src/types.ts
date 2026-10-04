import type { ApplicationStatus, JobSource } from './schemas';
/**
 * Wire types shared by the API and the web client.
 *
 * These mirror what the API actually returns (dates serialised as ISO strings),
 * so the client never has to guess at a shape.
 */
import type { SkillCategory } from './skills';

export type { ApplicationStatus, JobSource } from './schemas';

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiErrorBody {
  success: false;
  error: string;
  details?: unknown;
  requestId?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  image?: string | null;
}

// ------------------------------------------------------------------ domain
export interface CompanyStats {
  totalJobs: number;
  totalApplications: number;
  interviews: number;
  offers: number;
  avgMatchScore: number | null;
}

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  industry: string | null;
  size: string | null;
  glassdoorRating: number | null;
  techStack: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  stats?: CompanyStats;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  companyId: string | null;
  location: string | null;
  url: string | null;
  source: JobSource;
  salaryMin: number | null;
  salaryMax: number | null;
  description: string | null;
  techStack: string[] | null;
  postedAt: string | null;
  createdAt: string;
  /** Present on list endpoints: whether the user already tracks this job. */
  tracked?: boolean;
  applicationId?: string | null;
  applicationStatus?: ApplicationStatus | null;
  matchScore?: number | null;
}

export interface ApplicationEvent {
  id: string;
  type: 'created' | 'status_changed' | 'note' | 'scored' | 'cover_letter' | 'follow_up';
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus | null;
  message: string | null;
  createdAt: string;
}

export interface MatchSkillHit {
  id: string;
  label: string;
  count: number;
  /** Where the skill was found in the resume — used to ground explanations. */
  contexts?: string[];
}

export interface MatchBreakdown {
  skillCoverage: number;
  keywordRelevance: number;
  semanticSimilarity: number | null;
  engine: string;
  weights: { skillCoverage: number; keywordRelevance: number; semanticSimilarity: number };
}

export interface MatchResult {
  id?: string;
  applicationId?: string | null;
  resumeId: string | null;
  score: number;
  matchedSkills: MatchSkillHit[];
  missingSkills: Array<{ id: string; label: string; weight: number }>;
  breakdown: MatchBreakdown;
  suggestions: string[];
  summary: string;
  createdAt?: string;
}

export interface Application {
  id: string;
  userId: string;
  jobId: string;
  status: ApplicationStatus;
  resumeId: string | null;
  matchScore: number | null;
  notes: string | null;
  followUpDate: string | null;
  createdAt: string;
  updatedAt: string;
  job: Job | null;
  resumeLabel: string | null;
  daysInStage?: number;
  match?: MatchResult | null;
  events?: ApplicationEvent[];
  coverLetterCount?: number;
}

export interface ResumeSummary {
  usageCount: number;
  interviews: number;
  offers: number;
  avgMatchScore: number | null;
  interviewRate: number | null;
}

export interface Resume {
  id: string;
  label: string;
  fileName: string | null;
  fileUrl: string | null;
  source: 'paste' | 'upload' | 'seed';
  parsedText: string | null;
  skills: string[];
  wordCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  summary?: ResumeSummary;
}

export interface CoverLetter {
  id: string;
  applicationId: string | null;
  resumeId: string | null;
  title: string;
  body: string;
  tone: string;
  engine: string;
  createdAt: string;
  updatedAt: string;
  company?: string | null;
  role?: string | null;
}

// ------------------------------------------------------------------ discovery
export interface DiscoveredJob {
  externalId: string;
  source: JobSource;
  sourceLabel: string;
  title: string;
  company: string;
  location: string | null;
  remote: boolean;
  url: string;
  description: string | null;
  salary: string | null;
  tags: string[];
  postedAt: string | null;
  /** Populated by the API after search. */
  alreadyTracked?: boolean;
  matchScore?: number | null;
}

export interface DiscoverySearchResult {
  jobs: DiscoveredJob[];
  errors: Array<{ source: string; message: string }>;
  sourcesUsed: string[];
  tookMs: number;
}

export interface JobSourceInfo {
  id: JobSource;
  label: string;
  description: string;
  kind: 'board' | 'aggregator' | 'manual';
  configured: boolean;
  /** Number of configured board tokens for ATS providers. */
  boardCount?: number;
}

export interface ImportedJobDraft {
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  url: string;
  source: JobSource;
  techStack: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  warnings: string[];
}

// ------------------------------------------------------------------ analytics
export interface FunnelStep {
  status: ApplicationStatus;
  label: string;
  count: number;
}

export interface AnalyticsOverview {
  totals: {
    applications: number;
    active: number;
    applied: number;
    interviews: number;
    offers: number;
    rejected: number;
  };
  rates: {
    responseRate: number | null;
    interviewRate: number | null;
    offerRate: number | null;
  };
  timing: {
    avgFirstResponseDays: number | null;
    avgDaysToInterview: number | null;
    avgDaysInCurrentStage: number | null;
  };
  funnel: FunnelStep[];
  sources: Array<{
    source: JobSource;
    applications: number;
    responded: number;
    interviews: number;
    offers: number;
    responseRate: number | null;
    avgMatchScore: number | null;
  }>;
  resumes: Array<{
    resumeId: string;
    label: string;
    applications: number;
    interviews: number;
    offers: number;
    avgMatchScore: number | null;
    interviewRate: number | null;
  }>;
  matchBuckets: Array<{
    label: string;
    applications: number;
    interviews: number;
    interviewRate: number | null;
  }>;
  weekly: Array<{ week: string; applications: number; interviews: number }>;
  topMissingSkills: Array<{
    id: string;
    label: string;
    count: number;
    category: SkillCategory | null;
  }>;
}

export interface DashboardSummary {
  counts: Record<ApplicationStatus, number>;
  stats: {
    totalApplications: number;
    activeApplications: number;
    interviews: number;
    offers: number;
    interviewsLast30Days: number;
    newThisWeek: number;
    avgMatchScore: number | null;
    responseRate: number | null;
  };
  followUps: Array<{
    applicationId: string;
    role: string;
    company: string;
    status: ApplicationStatus;
    followUpDate: string;
    overdue: boolean;
    daysUntil: number;
  }>;
  stale: Array<{
    applicationId: string;
    role: string;
    company: string;
    status: ApplicationStatus;
    daysSinceUpdate: number;
  }>;
  recentEvents: Array<
    ApplicationEvent & {
      applicationId: string;
      role: string;
      company: string;
    }
  >;
  topMatches: Array<{
    applicationId: string;
    role: string;
    company: string;
    status: ApplicationStatus;
    matchScore: number;
  }>;
  activeResume: { id: string; label: string; skills: string[] } | null;
  resumeGaps: Array<{ id: string; label: string; count: number }>;
}

export interface HealthReport {
  status: 'ok' | 'degraded';
  version: string;
  uptimeSeconds: number;
  checks: {
    database: { ok: boolean; latencyMs?: number; error?: string };
    ml: {
      configured: boolean;
      ok: boolean;
      error?: string;
      model?: string | null;
      /** False when the service is up but sentence-transformers is not installed. */
      embeddings: boolean;
      note?: string;
    };
    llm: { configured: boolean; ok: boolean; error?: string; model?: string | null };
  };
  features: {
    semanticMatching: boolean;
    resumeParsing: boolean;
    coverLetterGeneration: 'llm' | 'local-template';
  };
}
