import { StatusPill } from '@/components/indicators';
import { useToast } from '@/components/ui/Toast';
import {
  Badge,
  Banner,
  Button,
  Chip,
  EmptyState,
  Field,
  Input,
  Panel,
  PanelHeader,
  SectionLabel,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives';
import { SOURCE_LABELS, formatDate, formatRelative } from '@/lib/format';
import { useCompanies, useCompany, useUpdateCompany } from '@/lib/queries';
import { cn } from '@/lib/utils';
import type { Company } from '@applyai/shared/types';
import { Building2, ExternalLink, Save } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function CompaniesPage() {
  const { data: companies, isLoading } = useCompanies();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!selectedId && companies && companies.length > 0) setSelectedId(companies[0].id);
  }, [companies, selectedId]);

  const filtered = (companies ?? []).filter((company) =>
    query.trim() ? company.name.toLowerCase().includes(query.trim().toLowerCase()) : true,
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Companies</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Built automatically from the jobs you track. Keep your own notes on each one.
        </p>
      </header>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (companies ?? []).length === 0 ? (
        <EmptyState
          icon={<Building2 size={22} />}
          title="No companies yet"
          description="Companies appear here as soon as you track a job — with totals, interview counts and average match score."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-3">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter companies"
            />
            <div className="space-y-1 overflow-y-auto lg:max-h-[70vh]">
              {filtered.map((company) => (
                <CompanyRow
                  key={company.id}
                  company={company}
                  selected={company.id === selectedId}
                  onClick={() => setSelectedId(company.id)}
                />
              ))}
              {filtered.length === 0 ? (
                <p className="px-1 py-3 text-sm text-zinc-500">No companies match.</p>
              ) : null}
            </div>
          </div>

          <CompanyDetail companyId={selectedId} />
        </div>
      )}
    </div>
  );
}

function CompanyRow({
  company,
  selected,
  onClick,
}: {
  company: Company;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full border px-3 py-2.5 text-left transition-colors',
        selected
          ? 'border-neon/40 bg-neon/8'
          : 'border-white/8 bg-dark-800/30 hover:border-white/20',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm text-white">{company.name}</span>
        {company.stats && company.stats.totalApplications > 0 ? (
          <span className="shrink-0 font-mono text-[11px] text-zinc-500">
            {company.stats.totalApplications} app{company.stats.totalApplications === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>
      {company.stats ? (
        <p className="mt-1 text-[11px] text-zinc-500">
          {company.stats.totalJobs} job{company.stats.totalJobs === 1 ? '' : 's'}
          {company.stats.interviews > 0
            ? ` · ${company.stats.interviews} interview${company.stats.interviews === 1 ? '' : 's'}`
            : ''}
          {company.stats.avgMatchScore !== null
            ? ` · avg ${Math.round(company.stats.avgMatchScore)}%`
            : ''}
        </p>
      ) : null}
    </button>
  );
}

function CompanyDetail({ companyId }: { companyId: string | null }) {
  const toast = useToast();
  const { data, isLoading, isError, error } = useCompany(companyId);
  const updateCompany = useUpdateCompany();
  const [notes, setNotes] = useState('');
  const [industry, setIndustry] = useState('');
  const [size, setSize] = useState('');

  const loadedId = data?.id;
  const loadedNotes = data?.notes ?? '';
  const loadedIndustry = data?.industry ?? '';
  const loadedSize = data?.size ?? '';
  useEffect(() => {
    if (!loadedId) return;
    setNotes(loadedNotes);
    setIndustry(loadedIndustry);
    setSize(loadedSize);
  }, [loadedId, loadedNotes, loadedIndustry, loadedSize]);

  if (!companyId) {
    return (
      <Panel className="flex items-center justify-center py-20 text-sm text-zinc-500">
        Select a company to see details.
      </Panel>
    );
  }

  if (isLoading) return <Skeleton className="h-[70vh]" />;
  if (isError || !data) {
    return (
      <Banner tone="error" title="Could not load that company">
        {error?.message}
      </Banner>
    );
  }

  const dirty =
    notes !== (data.notes ?? '') ||
    industry !== (data.industry ?? '') ||
    size !== (data.size ?? '');

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader
          title={
            <span className="flex items-center gap-2">
              {data.name}
              {data.stats && data.stats.interviews > 0 ? (
                <Badge tone="neon">{data.stats.interviews} interviews</Badge>
              ) : null}
            </span>
          }
          subtitle={
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span>First seen {formatRelative(data.createdAt)}</span>
              {data.domain ? <span>{data.domain}</span> : null}
              {data.website ? (
                <a
                  href={data.website}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-neon/80 hover:text-neon"
                >
                  Website <ExternalLink size={10} />
                </a>
              ) : null}
            </span>
          }
        />

        <div className="mb-4 grid grid-cols-3 gap-3">
          <Field label="Industry">
            <Input
              value={industry}
              onChange={(event) => setIndustry(event.target.value)}
              placeholder="Fintech"
            />
          </Field>
          <Field label="Size">
            <Input
              value={size}
              onChange={(event) => setSize(event.target.value)}
              placeholder="201-500"
            />
          </Field>
          <div>
            <p className="label-micro mb-1.5">Tracked</p>
            <p className="text-sm text-zinc-300">
              {data.stats?.totalJobs ?? 0} jobs · {data.stats?.totalApplications ?? 0} applications
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {data.stats?.avgMatchScore !== null && data.stats?.avgMatchScore !== undefined
                ? `Avg match ${Math.round(data.stats.avgMatchScore)}%`
                : 'No scores yet'}
            </p>
          </div>
        </div>

        <Field label="Notes" hint="Interview loops, comp bands, who you spoke to, red flags.">
          <Textarea rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] text-zinc-600">{dirty ? 'Unsaved changes' : 'Saved'}</span>
          <Button
            size="sm"
            variant="primary"
            icon={<Save size={13} />}
            disabled={!dirty}
            loading={updateCompany.isPending}
            onClick={() =>
              updateCompany.mutate(
                {
                  id: data.id,
                  patch: { notes: notes || null, industry: industry || null, size: size || null },
                },
                {
                  onSuccess: () => toast.success('Company updated'),
                  onError: (mutationError) => toast.error('Could not save', mutationError.message),
                },
              )
            }
          >
            Save
          </Button>
        </div>
      </Panel>

      {data.techStack.length > 0 ? (
        <Panel>
          <SectionLabel>Tech stack seen in their postings</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {data.techStack.map((skill) => (
              <Chip key={skill}>{skill}</Chip>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader title="Their postings you have tracked" subtitle="Newest first" />
        {(data.jobs ?? []).length === 0 ? (
          <p className="text-sm text-zinc-500">No jobs recorded for this company yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {(data.jobs as Array<Record<string, unknown>>).map((job) => (
              <li key={String(job.id)} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">{String(job.title)}</p>
                  <p className="text-[11px] text-zinc-500">
                    {job.location ? `${String(job.location)} · ` : ''}
                    {SOURCE_LABELS[(job.source as keyof typeof SOURCE_LABELS) ?? 'manual']} ·{' '}
                    {formatDate(String(job.created_at))}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {job.status ? <StatusPill status={job.status as never} withDot={false} /> : null}
                  {job.match_score !== null && job.match_score !== undefined ? (
                    <span className="font-mono text-xs text-zinc-300">
                      {Math.round(Number(job.match_score))}%
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
