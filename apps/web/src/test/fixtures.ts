/**
 * Canned API responses used by the component tests.
 *
 * Shapes mirror what the real API returns (checked against a running server),
 * so a change in the API contract breaks these tests instead of the browser.
 */
import type {
  AnalyticsOverview,
  Application,
  Company,
  CoverLetter,
  DashboardSummary,
  HealthReport,
  Job,
  JobSourceInfo,
  Paginated,
  Resume,
} from '@applyai/shared/types';

export const session = {
  session: { id: 'sess_1', expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
  user: {
    id: 'user_1',
    name: 'Demo User',
    email: 'demo@applyai.dev',
    emailVerified: true,
    image: null,
  },
};

export const health: HealthReport = {
  status: 'ok',
  version: '0.1.0',
  uptimeSeconds: 42,
  checks: {
    database: { ok: true, latencyMs: 3 },
    ml: {
      configured: true,
      ok: true,
      embeddings: false,
      model: null,
      note: 'sentence-transformers is not installed — parsing only.',
    },
    llm: { configured: false, ok: false, model: null, error: 'not configured' },
  },
  features: {
    semanticMatching: false,
    resumeParsing: false,
    coverLetterGeneration: 'local-template',
  },
};

export const dashboard: DashboardSummary = {
  counts: { saved: 1, applied: 2, screening: 1, interview: 2, offer: 1, rejected: 2, ghosted: 1 },
  stats: {
    totalApplications: 10,
    activeApplications: 5,
    interviews: 3,
    offers: 1,
    interviewsLast30Days: 3,
    newThisWeek: 3,
    avgMatchScore: 65.3,
    responseRate: 66.7,
  },
  followUps: [
    {
      applicationId: 'app_1',
      role: 'Platform Engineer (Kubernetes)',
      company: 'Runway Cloud',
      status: 'interview',
      followUpDate: '2026-10-05',
      overdue: false,
      daysUntil: 0,
    },
  ],
  stale: [
    {
      applicationId: 'app_2',
      role: 'Data Engineer',
      company: 'Ledgerly',
      status: 'applied',
      daysSinceUpdate: 21,
    },
  ],
  recentEvents: [
    {
      id: 'evt_1',
      type: 'scored',
      fromStatus: null,
      toStatus: null,
      message: '86% — strong match: 11 of 12 required skills covered.',
      createdAt: '2026-10-02T08:00:00.000Z',
      applicationId: 'app_3',
      role: 'Machine Learning Engineer — NLP',
      company: 'Vector Health',
    },
  ],
  topMatches: [
    {
      applicationId: 'app_3',
      role: 'Machine Learning Engineer — NLP',
      company: 'Vector Health',
      status: 'applied',
      matchScore: 86.2,
    },
  ],
  activeResume: {
    id: 'res_1',
    label: 'Full-stack — React / Node (primary)',
    skills: ['typescript', 'react', 'nodejs'],
  },
  resumeGaps: [{ id: 'css', label: 'CSS', count: 2 }],
};

export const overview: AnalyticsOverview = {
  totals: { applications: 10, active: 5, applied: 9, interviews: 3, offers: 1, rejected: 2 },
  rates: { responseRate: 66.7, interviewRate: 33.3, offerRate: 33.3 },
  timing: { avgFirstResponseDays: 4.2, avgDaysToInterview: 9.5, avgDaysInCurrentStage: 12.1 },
  funnel: [
    { status: 'saved', label: 'Saved', count: 1 },
    { status: 'applied', label: 'Applied', count: 2 },
    { status: 'screening', label: 'Screening', count: 1 },
    { status: 'interview', label: 'Interview', count: 2 },
    { status: 'offer', label: 'Offer', count: 1 },
    { status: 'rejected', label: 'Rejected', count: 2 },
    { status: 'ghosted', label: 'Ghosted', count: 1 },
  ],
  sources: [
    {
      source: 'greenhouse',
      applications: 3,
      responded: 2,
      interviews: 2,
      offers: 0,
      responseRate: 66.7,
      avgMatchScore: 76.6,
    },
  ],
  resumes: [
    {
      resumeId: 'res_1',
      label: 'Full-stack — React / Node (primary)',
      applications: 4,
      interviews: 2,
      offers: 1,
      avgMatchScore: 61.6,
      interviewRate: 50,
    },
  ],
  matchBuckets: [
    { label: 'under 50', applications: 1, interviews: 0, interviewRate: 0 },
    { label: '70+', applications: 4, interviews: 3, interviewRate: 75 },
  ],
  weekly: [
    { week: '2026-09-21', applications: 2, interviews: 0 },
    { week: '2026-09-28', applications: 3, interviews: 1 },
  ],
  topMissingSkills: [{ id: 'css', label: 'CSS', count: 2, category: 'frontend' }],
};

export const applications: Application[] = [
  {
    id: 'app_1',
    userId: 'user_1',
    jobId: 'job_1',
    status: 'interview',
    resumeId: 'res_1',
    matchScore: 84.4,
    notes: 'Recruiter call went well.',
    followUpDate: null,
    createdAt: '2026-09-20T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
    job: {
      id: 'job_1',
      title: 'Platform Engineer (Kubernetes)',
      company: 'Runway Cloud',
      companyId: 'cmp_1',
      location: 'Remote (EU)',
      url: 'https://example.com/jobs/1',
      source: 'ashby',
      salaryMin: 90000,
      salaryMax: 120000,
      description: 'Own the platform.',
      techStack: ['kubernetes', 'terraform'],
      postedAt: '2026-09-18T08:00:00.000Z',
      createdAt: '2026-09-18T08:00:00.000Z',
    },
    resumeLabel: 'Full-stack — React / Node (primary)',
    daysInStage: 4,
  },
  {
    id: 'app_2',
    userId: 'user_1',
    jobId: 'job_2',
    status: 'applied',
    resumeId: null,
    matchScore: 42.8,
    notes: null,
    followUpDate: '2026-10-06',
    createdAt: '2026-09-13T08:00:00.000Z',
    updatedAt: '2026-09-13T08:00:00.000Z',
    job: {
      id: 'job_2',
      title: 'Data Engineer',
      company: 'Ledgerly',
      companyId: 'cmp_2',
      location: 'Berlin, Germany',
      url: 'https://example.com/jobs/2',
      source: 'greenhouse',
      salaryMin: null,
      salaryMax: null,
      description: 'Pipelines.',
      techStack: ['python', 'sql'],
      postedAt: null,
      createdAt: '2026-09-12T08:00:00.000Z',
    },
    resumeLabel: null,
    daysInStage: 21,
  },
];

export const resumes: Resume[] = [
  {
    id: 'res_1',
    label: 'Full-stack — React / Node (primary)',
    fileName: null,
    fileUrl: null,
    source: 'seed',
    parsedText: 'SUMMARY\nFull-stack engineer…',
    skills: ['typescript', 'react', 'nodejs', 'postgres'],
    wordCount: 320,
    isActive: true,
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z',
    summary: { usageCount: 4, interviews: 2, offers: 1, avgMatchScore: 61.6, interviewRate: 50 },
  },
];

export const companies: Company[] = [
  {
    id: 'cmp_1',
    name: 'Runway Cloud',
    domain: 'runwaycloud.com',
    website: 'https://runwaycloud.com',
    industry: 'Software',
    size: '51-200',
    glassdoorRating: null,
    techStack: ['kubernetes', 'terraform'],
    notes: null,
    createdAt: '2026-09-18T08:00:00.000Z',
    updatedAt: '2026-09-18T08:00:00.000Z',
    stats: { totalJobs: 2, totalApplications: 1, interviews: 1, offers: 0, avgMatchScore: 84.4 },
  },
];

export const companyDetail = {
  ...companies[0],
  jobs: [
    {
      id: 'job_1',
      title: 'Platform Engineer (Kubernetes)',
      location: 'Remote (EU)',
      source: 'ashby',
      created_at: '2026-09-18T08:00:00.000Z',
      status: 'interview',
      match_score: 84.4,
    },
  ],
};

export const coverLetters: CoverLetter[] = [
  {
    id: 'cl_1',
    applicationId: 'app_1',
    resumeId: 'res_1',
    title: 'Platform Engineer — Runway Cloud',
    body: 'Dear Runway Cloud hiring team,\n\nI would like to apply for the Platform Engineer role.',
    tone: 'professional',
    engine: 'template:v1',
    createdAt: '2026-09-21T08:00:00.000Z',
    updatedAt: '2026-09-21T08:00:00.000Z',
    company: 'Runway Cloud',
    role: 'Platform Engineer (Kubernetes)',
  },
];

export const sources: JobSourceInfo[] = [
  {
    id: 'greenhouse',
    label: 'Greenhouse boards',
    description: 'Open roles at companies that host their careers page on Greenhouse.',
    kind: 'board',
    configured: true,
    boardCount: 16,
  },
  {
    id: 'remotive',
    label: 'Remotive',
    description: 'Remote-first jobs from the Remotive API.',
    kind: 'aggregator',
    configured: true,
  },
];

export const jobsPage: Paginated<Job> = {
  items: [
    {
      id: 'job_1',
      title: 'Platform Engineer (Kubernetes)',
      company: 'Runway Cloud',
      companyId: 'cmp_1',
      location: 'Remote (EU)',
      url: 'https://example.com/jobs/1',
      source: 'ashby',
      salaryMin: 90000,
      salaryMax: 120000,
      description: 'Own the platform.',
      techStack: ['kubernetes'],
      postedAt: null,
      createdAt: '2026-09-18T08:00:00.000Z',
      tracked: true,
      applicationId: 'app_1',
      applicationStatus: 'interview',
      matchScore: 84.4,
    },
  ],
  total: 1,
  limit: 50,
  offset: 0,
};

export const applicationDetail: Application = {
  ...applications[0],
  match: {
    id: 'mat_1',
    applicationId: 'app_1',
    resumeId: 'res_1',
    score: 84.4,
    matchedSkills: [
      {
        id: 'kubernetes',
        label: 'Kubernetes',
        count: 3,
        contexts: ['Built the Kubernetes platform'],
      },
    ],
    missingSkills: [{ id: 'terraform', label: 'Terraform', weight: 1 }],
    breakdown: {
      skillCoverage: 0.82,
      keywordRelevance: 0.61,
      semanticSimilarity: null,
      engine: 'taxonomy+tfidf',
      weights: { skillCoverage: 0.72, keywordRelevance: 0.28, semanticSimilarity: 0 },
    },
    suggestions: ['**Terraform** appears 2× in the requirements but not in your resume.'],
    summary: '84% — strong match: 9 of 11 required skills covered.',
    createdAt: '2026-09-20T08:00:00.000Z',
  },
  events: [
    {
      id: 'evt_1',
      type: 'status_changed',
      fromStatus: 'applied',
      toStatus: 'interview',
      message: 'Applied → Interview',
      createdAt: '2026-10-01T08:00:00.000Z',
    },
  ],
  coverLetterCount: 1,
};
