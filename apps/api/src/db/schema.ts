import { JOB_SOURCES } from '@applyai/shared/schemas';
import {
  boolean,
  date,
  decimal,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------- enums
export const applicationStatusEnum = pgEnum('application_status', [
  'saved',
  'applied',
  'screening',
  'interview',
  'offer',
  'rejected',
  'ghosted',
]);

export const jobSourceEnum = pgEnum('job_source', JOB_SOURCES);

export const applicationEventTypeEnum = pgEnum('application_event_type', [
  'created',
  'status_changed',
  'note',
  'scored',
  'cover_letter',
  'follow_up',
]);

// ---------------------------------------------------------------- auth (better-auth)
export const user = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user_idx').on(t.userId)],
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('account_user_idx').on(t.userId)],
);

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

// ---------------------------------------------------------------- domain
export const companies = pgTable(
  'companies',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    domain: text('domain'),
    website: text('website'),
    industry: text('industry'),
    size: text('size'),
    glassdoorRating: decimal('glassdoor_rating', { precision: 3, scale: 1 }),
    techStack: jsonb('tech_stack').$type<string[]>().default([]).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('companies_user_name_idx').on(t.userId, t.name)],
);

export const jobs = pgTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    companyId: text('company_id').references(() => companies.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    company: text('company').notNull(),
    location: text('location'),
    url: text('url'),
    source: jobSourceEnum('source').default('manual').notNull(),
    salaryMin: integer('salary_min'),
    salaryMax: integer('salary_max'),
    description: text('description'),
    techStack: jsonb('tech_stack').$type<string[]>(),
    postedAt: timestamp('posted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('jobs_user_url_idx').on(t.userId, t.url),
    index('jobs_user_created_idx').on(t.userId, t.createdAt),
  ],
);

export const resumes = pgTable('resumes', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  fileName: text('file_name'),
  fileUrl: text('file_url'),
  source: text('source').default('paste').notNull(),
  parsedText: text('parsed_text'),
  skills: jsonb('skills').$type<string[]>().default([]).notNull(),
  wordCount: integer('word_count').default(0).notNull(),
  isActive: boolean('is_active').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const applications = pgTable(
  'applications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    status: applicationStatusEnum('status').default('saved').notNull(),
    resumeId: text('resume_id').references(() => resumes.id, { onDelete: 'set null' }),
    matchScore: decimal('match_score', { precision: 5, scale: 1 }),
    notes: text('notes'),
    followUpDate: date('follow_up_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('applications_user_job_idx').on(t.userId, t.jobId),
    index('applications_user_status_idx').on(t.userId, t.status),
  ],
);

export const applicationsEvents = pgTable(
  'application_events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    type: applicationEventTypeEnum('type').notNull(),
    fromStatus: applicationStatusEnum('from_status'),
    toStatus: applicationStatusEnum('to_status'),
    message: text('message'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('application_events_application_idx').on(t.applicationId, t.createdAt),
    index('application_events_user_idx').on(t.userId, t.createdAt),
  ],
);

export const matchResults = pgTable(
  'match_results',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    applicationId: text('application_id').references(() => applications.id, {
      onDelete: 'cascade',
    }),
    resumeId: text('resume_id').references(() => resumes.id, { onDelete: 'set null' }),
    score: decimal('score', { precision: 5, scale: 1 }).notNull(),
    matchedSkills: jsonb('matched_skills')
      .$type<Array<{ id: string; label: string; count: number; contexts?: string[] }>>()
      .default([])
      .notNull(),
    missingSkills: jsonb('missing_skills')
      .$type<Array<{ id: string; label: string; weight: number }>>()
      .default([])
      .notNull(),
    breakdown: jsonb('breakdown').$type<Record<string, unknown>>().notNull(),
    suggestions: jsonb('suggestions').$type<string[]>().default([]).notNull(),
    summary: text('summary').notNull(),
    engine: text('engine').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('match_results_application_idx').on(t.applicationId, t.createdAt),
    index('match_results_user_idx').on(t.userId, t.createdAt),
  ],
);

export const coverLetters = pgTable(
  'cover_letters',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    applicationId: text('application_id').references(() => applications.id, {
      onDelete: 'cascade',
    }),
    resumeId: text('resume_id').references(() => resumes.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    body: text('body').notNull(),
    tone: text('tone').notNull(),
    engine: text('engine').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('cover_letters_application_idx').on(t.applicationId, t.createdAt)],
);

export const schema = {
  user,
  session,
  account,
  verification,
  companies,
  jobs,
  resumes,
  applications,
  applicationsEvents,
  matchResults,
  coverLetters,
};
