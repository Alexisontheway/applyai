import { z } from 'zod';

/** Pipeline stages, in funnel order. */
export const APPLICATION_STATUSES = [
  'saved',
  'applied',
  'screening',
  'interview',
  'offer',
  'rejected',
  'ghosted',
] as const;

export type ApplicationStatusValue = (typeof APPLICATION_STATUSES)[number];

/** Statuses that mean "the company is still talking to you". */
export const ACTIVE_STATUSES: ApplicationStatusValue[] = ['applied', 'screening', 'interview'];

export const JOB_SOURCES = [
  'manual',
  'import',
  'greenhouse',
  'lever',
  'ashby',
  'remotive',
  'remoteok',
  'arbeitnow',
  'linkedin',
  'indeed',
  'naukri',
  'wellfound',
  'other',
] as const;

export type JobSourceValue = (typeof JOB_SOURCES)[number];

export const COVER_LETTER_TONES = ['professional', 'concise', 'enthusiastic', 'technical'] as const;

// ------------------------------------------------------------------ auth
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const registerSchema = loginSchema.extend({
  name: z.string().min(2).max(100),
});

// ------------------------------------------------------------------ jobs
export const createJobSchema = z.object({
  title: z.string().min(1).max(255),
  company: z.string().min(1).max(255),
  location: z.string().max(255).nullish(),
  url: z.string().url().max(2048).nullish(),
  source: z.enum(JOB_SOURCES).default('manual'),
  salaryMin: z.number().int().nonnegative().nullish(),
  salaryMax: z.number().int().nonnegative().nullish(),
  description: z.string().max(50_000).nullish(),
  techStack: z.array(z.string().max(60)).max(60).nullish(),
  postedAt: z.string().datetime({ offset: true }).nullish(),
});

export const updateJobSchema = createJobSchema.partial();

/** Save a discovered job and start tracking it in one atomic call. */
export const trackJobSchema = createJobSchema.extend({
  status: z.enum(APPLICATION_STATUSES).default('saved'),
  resumeId: z.string().nullish(),
  notes: z.string().max(10_000).nullish(),
  followUpDate: z.string().nullish(),
  /** Run the matcher against the active (or given) resume before saving. */
  score: z.boolean().default(true),
});

export const listJobsQuerySchema = z.object({
  q: z.string().max(200).optional(),
  source: z.enum(JOB_SOURCES).optional(),
  tracked: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ------------------------------------------------------------------ applications
export const createApplicationSchema = z.object({
  jobId: z.string().min(1),
  status: z.enum(APPLICATION_STATUSES).default('saved'),
  resumeId: z.string().nullish(),
  notes: z.string().max(10_000).nullish(),
  followUpDate: z.string().nullish(),
  /** Score immediately if a resume + description are available. */
  score: z.boolean().default(true),
});

export const updateApplicationSchema = z.object({
  status: z.enum(APPLICATION_STATUSES).optional(),
  resumeId: z.string().nullish(),
  notes: z.string().max(10_000).nullish(),
  followUpDate: z.string().nullish(),
  matchScore: z.number().min(0).max(100).nullish(),
  jobTitle: z.string().min(1).max(255).optional(),
  jobCompany: z.string().min(1).max(255).optional(),
});

// ------------------------------------------------------------------ resumes
export const createResumeSchema = z.object({
  label: z.string().min(1).max(100),
  text: z.string().min(40).max(200_000).optional(),
  isActive: z.boolean().default(false),
});

export const updateResumeSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  text: z.string().min(40).max(200_000).nullish(),
  isActive: z.boolean().optional(),
});

// ------------------------------------------------------------------ cover letters
export const createCoverLetterSchema = z.object({
  applicationId: z.string().min(1),
  resumeId: z.string().nullish(),
  tone: z.enum(COVER_LETTER_TONES).default('professional'),
  /** Optional extra instruction, passed to the LLM when one is configured. */
  instructions: z.string().max(1000).nullish(),
  /** Force the local template engine even when an LLM is available. */
  local: z.boolean().default(false),
});

// ------------------------------------------------------------------ discovery
export const discoverySearchSchema = z.object({
  keywords: z.string().min(1).max(200),
  location: z.string().max(200).nullish(),
  remoteOnly: z.boolean().default(false),
  sources: z.array(z.string().min(1).max(40)).max(20).optional(),
  limit: z.coerce.number().int().min(1).max(60).default(30),
  /** Preview a match score for every result against the active resume. */
  score: z.boolean().default(true),
});

export const importUrlSchema = z.object({
  url: z.string().url().max(2048),
});

// ------------------------------------------------------------------ companies
export const updateCompanySchema = z.object({
  notes: z.string().max(10_000).nullish(),
  industry: z.string().max(100).nullish(),
  size: z.string().max(50).nullish(),
  website: z.string().url().max(2048).nullish(),
  techStack: z.array(z.string().max(60)).max(80).nullish(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type TrackJobInput = z.infer<typeof trackJobSchema>;
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
export type CreateResumeInput = z.infer<typeof createResumeSchema>;
export type UpdateResumeInput = z.infer<typeof updateResumeSchema>;
export type CreateCoverLetterInput = z.infer<typeof createCoverLetterSchema>;
export type DiscoverySearchInput = z.infer<typeof discoverySearchSchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type ApplicationStatus = ApplicationStatusValue;
export type JobSource = JobSourceValue;
