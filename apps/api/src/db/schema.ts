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

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const jobs = pgTable('jobs', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
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
    .references(() => users.id, { onDelete: 'cascade' }),
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
    .references(() => users.id, { onDelete: 'cascade' }),
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
    .references(() => users.id, { onDelete: 'cascade' }),
  event: text('event').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
