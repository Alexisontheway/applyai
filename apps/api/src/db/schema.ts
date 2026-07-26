import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  decimal,
  boolean,
  date,
  pgEnum,
} from 'drizzle-orm/pg-core';

export const applicationStatusEnum = pgEnum('application_status', [
  'saved',
  'applied',
  'screening',
  'interview',
  'offer',
  'rejected',
  'ghosted',
]);

export const jobSourceEnum = pgEnum('job_source', [
  'manual',
  'linkedin',
  'indeed',
  'naukri',
  'wellfound',
  'scrape',
]);

export const user = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});

export const jobs = pgTable('jobs', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  company: text('company').notNull(),
  location: text('location'),
  url: text('url'),
  source: jobSourceEnum('source').default('manual'),
  salaryMin: integer('salary_min'),
  salaryMax: integer('salary_max'),
  description: text('description'),
  techStack: jsonb('tech_stack').$type<string[]>(),
  companyId: text('company_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const companies = pgTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  domain: text('domain'),
  industry: text('industry'),
  size: text('size'),
  glassdoorRating: decimal('glassdoor_rating'),
  techStack: jsonb('tech_stack').$type<string[]>(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const resumes = pgTable('resumes', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  fileUrl: text('file_url'),
  parsedText: text('parsed_text'),
  isActive: boolean('is_active').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const applications = pgTable('applications', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  jobId: text('job_id')
    .notNull()
    .references(() => jobs.id, { onDelete: 'cascade' }),
  status: applicationStatusEnum('status').default('saved').notNull(),
  resumeId: text('resume_id').references(() => resumes.id),
  matchScore: decimal('match_score'),
  notes: text('notes'),
  followUpDate: date('follow_up_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const analyticsEvents = pgTable('analytics_events', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  event: text('event').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
