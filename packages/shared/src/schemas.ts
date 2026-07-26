import { z } from 'zod';

export const applicationStatus = [
  'saved',
  'applied',
  'screening',
  'interview',
  'offer',
  'rejected',
  'ghosted',
] as const;

export const jobSource = ['manual', 'linkedin', 'indeed', 'naukri', 'wellfound', 'scrape'] as const;

// --- Auth ---
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
});

// --- Jobs ---
export const createJobSchema = z.object({
  title: z.string().min(1).max(255),
  company: z.string().min(1).max(255),
  location: z.string().max(255).optional(),
  url: z.string().url().optional(),
  source: z.enum(jobSource).default('manual'),
  salaryMin: z.number().int().positive().optional(),
  salaryMax: z.number().int().positive().optional(),
  description: z.string().optional(),
  techStack: z.array(z.string()).optional(),
});

export const updateJobSchema = createJobSchema.partial();

// --- Applications ---
export const createApplicationSchema = z.object({
  jobId: z.string(),
  status: z.enum(applicationStatus).default('saved'),
  resumeId: z.string().optional(),
  matchScore: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  followUpDate: z.string().optional(),
});

export const updateApplicationSchema = createApplicationSchema.partial();

// --- Resumes ---
export const createResumeSchema = z.object({
  label: z.string().min(1).max(100),
  isActive: z.boolean().default(false),
});

// --- Companies ---
export const createCompanySchema = z.object({
  name: z.string().min(1).max(255),
  domain: z.string().max(255).optional(),
  industry: z.string().max(100).optional(),
  size: z.string().max(50).optional(),
  glassdoorRating: z.number().min(0).max(5).optional(),
  techStack: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

// --- Scraping ---
export const scrapeJobsSchema = z.object({
  keywords: z.string().min(1).max(255),
  location: z.string().max(255).optional(),
  maxResults: z.number().int().min(1).max(100).default(25),
  sources: z.array(z.enum(jobSource)).optional(),
});
