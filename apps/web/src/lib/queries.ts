import type {
  DiscoverySearchInput,
  TrackJobInput,
  UpdateApplicationInput,
} from '@applyai/shared/schemas';
import type {
  AnalyticsOverview,
  Application,
  Company,
  CoverLetter,
  DashboardSummary,
  DiscoveredJob,
  DiscoverySearchResult,
  HealthReport,
  ImportedJobDraft,
  JobSourceInfo,
  Job as JobType,
  MatchResult,
  Paginated,
  Resume,
} from '@applyai/shared/types';
/**
 * Every server interaction goes through this file: one place to see what the
 * client can do, what it invalidates, and what it optimistically updates.
 */
import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export const queryKeys = {
  health: ['health'] as const,
  dashboard: ['dashboard'] as const,
  analytics: ['analytics'] as const,
  applications: ['applications'] as const,
  application: (id: string) => ['application', id] as const,
  jobs: (params: Record<string, unknown>) => ['jobs', params] as const,
  resumes: ['resumes'] as const,
  companies: ['companies'] as const,
  company: (id: string) => ['company', id] as const,
  coverLetters: (applicationId?: string) => ['cover-letters', applicationId ?? 'all'] as const,
  sources: ['discovery-sources'] as const,
  discovery: (params: unknown) => ['discovery', params] as const,
};

/** Anything that changes an application also changes these aggregates. */
function invalidateAggregates(client: QueryClient): void {
  void client.invalidateQueries({ queryKey: queryKeys.applications });
  void client.invalidateQueries({ queryKey: queryKeys.dashboard });
  void client.invalidateQueries({ queryKey: queryKeys.analytics });
}

// ------------------------------------------------------------------ reads

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => api.get<HealthReport>('/health/deep'),
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => api.get<DashboardSummary>('/analytics/dashboard'),
  });
}

export function useAnalytics() {
  return useQuery({
    queryKey: queryKeys.analytics,
    queryFn: () => api.get<AnalyticsOverview>('/analytics/overview'),
  });
}

export function useApplications(filters: { status?: string; q?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.q) params.set('q', filters.q);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return useQuery({
    queryKey: [...queryKeys.applications, filters] as const,
    queryFn: () => api.get<Application[]>(`/applications${suffix}`),
  });
}

export function useApplication(id: string | null) {
  return useQuery({
    queryKey: queryKeys.application(id ?? ''),
    queryFn: () => api.get<Application>(`/applications/${id}`),
    enabled: Boolean(id),
  });
}

export function useJobs(filters: { q?: string; tracked?: 'true' | 'false'; source?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.tracked) params.set('tracked', filters.tracked);
  if (filters.source) params.set('source', filters.source);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return useQuery({
    queryKey: queryKeys.jobs(filters),
    queryFn: () => api.get<Paginated<JobType>>(`/jobs${suffix}`),
  });
}

export function useResumes() {
  return useQuery({
    queryKey: queryKeys.resumes,
    queryFn: () => api.get<Resume[]>('/resumes'),
  });
}

export function useCompanies() {
  return useQuery({
    queryKey: queryKeys.companies,
    queryFn: () => api.get<Company[]>('/companies'),
  });
}

export function useCompany(id: string | null) {
  return useQuery({
    queryKey: queryKeys.company(id ?? ''),
    queryFn: () => api.get<Company & { jobs: Array<Record<string, unknown>> }>(`/companies/${id}`),
    enabled: Boolean(id),
  });
}

export function useCoverLetters(applicationId?: string) {
  return useQuery({
    queryKey: queryKeys.coverLetters(applicationId),
    queryFn: () =>
      api.get<CoverLetter[]>(
        applicationId
          ? `/cover-letters?applicationId=${encodeURIComponent(applicationId)}`
          : '/cover-letters',
      ),
  });
}

export function useDiscoverySources() {
  return useQuery({
    queryKey: queryKeys.sources,
    queryFn: () => api.get<JobSourceInfo[]>('/discovery/sources'),
    staleTime: 5 * 60_000,
  });
}

export function useDiscoverySearch(params: DiscoverySearchInput | null) {
  return useQuery({
    queryKey: queryKeys.discovery(params),
    queryFn: () => api.post<DiscoverySearchResult>('/discovery/search', params),
    enabled: Boolean(params),
    staleTime: 2 * 60_000,
    retry: false,
  });
}

// ------------------------------------------------------------------ writes

export function useTrackJob() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: TrackJobInput) =>
      api.post<{ application: Application; created: boolean; match: MatchResult | null }>(
        '/jobs/track',
        input,
      ),
    onSuccess: () => {
      invalidateAggregates(client);
      void client.invalidateQueries({ queryKey: ['discovery'] });
      void client.invalidateQueries({ queryKey: queryKeys.companies });
    },
  });
}

export function useUpdateApplication() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateApplicationInput }) =>
      api.patch<Application>(`/applications/${id}`, patch),
    onMutate: async ({ id, patch }) => {
      await client.cancelQueries({ queryKey: queryKeys.applications });
      const previousLists = client.getQueriesData<Application[]>({
        queryKey: queryKeys.applications,
      });
      for (const [key, list] of previousLists) {
        if (!list) continue;
        client.setQueryData(
          key,
          list.map((application) =>
            application.id === id
              ? { ...application, ...patch, status: patch.status ?? application.status }
              : application,
          ),
        );
      }
      // Kanban moves should feel instant, so patch the single-application cache too.
      const detail = client.getQueryData<Application>(queryKeys.application(id));
      if (detail) client.setQueryData(queryKeys.application(id), { ...detail, ...patch });
      return { previousLists };
    },
    onError: (_error, _variables, context) => {
      for (const [key, list] of context?.previousLists ?? []) client.setQueryData(key, list);
    },
    onSettled: (_data, _error, variables) => {
      void client.invalidateQueries({ queryKey: queryKeys.application(variables.id) });
      invalidateAggregates(client);
    },
  });
}

export function useDeleteApplication() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ deleted: boolean }>(`/applications/${id}`),
    onSuccess: () => invalidateAggregates(client),
  });
}

export function useScoreApplication() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resumeId }: { id: string; resumeId?: string | null }) =>
      api.post<MatchResult>(`/applications/${id}/score`, { resumeId: resumeId ?? null }),
    onSuccess: (_data, variables) => {
      void client.invalidateQueries({ queryKey: queryKeys.application(variables.id) });
      invalidateAggregates(client);
    },
  });
}

export function useCreateApplication() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      jobId: string;
      status?: string;
      resumeId?: string | null;
      score?: boolean;
    }) => api.post<Application>('/applications', input),
    onSuccess: () => invalidateAggregates(client),
  });
}

export function useImportJobUrl() {
  return useMutation({
    mutationFn: (url: string) =>
      api.post<{ draft: ImportedJobDraft; alreadySaved: boolean; alreadyTracked: boolean }>(
        '/discovery/import-url',
        {
          url,
        },
      ),
  });
}

export function useCreateResume() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { label: string; text?: string; isActive?: boolean }) =>
      api.post<Resume>('/resumes', input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.resumes });
      void client.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useImportResume() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => api.upload<Resume>('/resumes/import', formData),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.resumes });
      void client.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useUpdateResume() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: { id: string; patch: { label?: string; text?: string; isActive?: boolean } }) =>
      api.patch<Resume>(`/resumes/${id}`, patch),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.resumes });
      void client.invalidateQueries({ queryKey: queryKeys.analytics });
    },
  });
}

export function useActivateResume() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Resume>(`/resumes/${id}/activate`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.resumes });
      void client.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useDeleteResume() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ deleted: boolean }>(`/resumes/${id}`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.resumes });
      void client.invalidateQueries({ queryKey: queryKeys.dashboard });
      void client.invalidateQueries({ queryKey: queryKeys.analytics });
    },
  });
}

export function useGenerateCoverLetter() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      applicationId: string;
      tone?: string;
      instructions?: string | null;
      local?: boolean;
      resumeId?: string | null;
    }) => api.post<CoverLetter & { warnings?: string[] }>('/cover-letters', input),
    onSuccess: (letter) => {
      void client.invalidateQueries({
        queryKey: queryKeys.coverLetters(letter.applicationId ?? undefined),
      });
      void client.invalidateQueries({
        queryKey: queryKeys.application(letter.applicationId ?? ''),
      });
    },
  });
}

export function useUpdateCoverLetter() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { body?: string; title?: string } }) =>
      api.patch<CoverLetter>(`/cover-letters/${id}`, patch),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['cover-letters'] }),
  });
}

export function useDeleteCoverLetter() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ deleted: boolean }>(`/cover-letters/${id}`),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['cover-letters'] }),
  });
}

export function useUpdateCompany() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      api.patch<Company>(`/companies/${id}`, patch),
    onSuccess: (_data, variables) => {
      void client.invalidateQueries({ queryKey: queryKeys.companies });
      void client.invalidateQueries({ queryKey: queryKeys.company(variables.id) });
    },
  });
}
