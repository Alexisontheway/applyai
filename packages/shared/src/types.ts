import type { z } from 'zod';
import type {
  loginSchema,
  registerSchema,
  createJobSchema,
  createApplicationSchema,
  createResumeSchema,
  createCompanySchema,
  applicationStatus,
  jobSource,
} from './schemas';

// --- Auth ---
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type User = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
};

// --- Jobs ---
export type CreateJobInput = z.infer<typeof createJobSchema>;
export type Job = CreateJobInput & {
  id: string;
  userId: string;
  companyId: string | null;
  createdAt: string;
};

// --- Applications ---
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type ApplicationStatus = (typeof applicationStatus)[number];
export type JobSource = (typeof jobSource)[number];
export type Application = CreateApplicationInput & {
  id: string;
  userId: string;
  updatedAt: string;
  createdAt: string;
  job?: Job;
};

// --- Resumes ---
export type CreateResumeInput = z.infer<typeof createResumeSchema>;
export type Resume = CreateResumeInput & {
  id: string;
  userId: string;
  fileUrl: string | null;
  parsedText: string | null;
  createdAt: string;
};

// --- Companies ---
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type Company = CreateCompanyInput & {
  id: string;
  createdAt: string;
};

// --- API Responses ---
export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type PaginatedResponse<T> = ApiResponse<T[]> & {
  total: number;
  page: number;
  limit: number;
};
