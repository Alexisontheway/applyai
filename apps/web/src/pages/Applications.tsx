import { ApplicationDrawer } from '@/components/ApplicationDrawer';
import { StatusPill } from '@/components/indicators';
import { Banner, EmptyState, Input, Skeleton, SkeletonList } from '@/components/ui/primitives';
import { SOURCE_LABELS, STATUS_META, formatDate, formatRelative } from '@/lib/format';
import { useApplications } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { APPLICATION_STATUSES, type ApplicationStatusValue } from '@applyai/shared/schemas';
import { ArrowUpRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

type Filter = ApplicationStatusValue | 'all';

export default function ApplicationsPage() {
  const { data, isLoading, isError, error } = useApplications();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(() => {
    let list = data ?? [];
    if (filter !== 'all') list = list.filter((application) => application.status === filter);
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      list = list.filter(
        (application) =>
          application.job?.title.toLowerCase().includes(needle) ||
          application.job?.company.toLowerCase().includes(needle) ||
          application.notes?.toLowerCase().includes(needle),
      );
    }
    return list;
  }, [data, filter, query]);

  const counts = useMemo(() => {
    const map = new Map<Filter, number>([['all', data?.length ?? 0]]);
    for (const status of APPLICATION_STATUSES) {
      map.set(status, (data ?? []).filter((application) => application.status === status).length);
    }
    return map;
  }, [data]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Applications</h1>
          <p className="mt-1 text-sm text-zinc-500">
            The whole list — sortable, searchable, click any row for detail.
          </p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search role, company or notes"
            className="w-72 pl-9"
          />
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          label="All"
          count={counts.get('all') ?? 0}
        />
        {APPLICATION_STATUSES.map((status) => (
          <FilterChip
            key={status}
            active={filter === status}
            onClick={() => setFilter(status)}
            label={STATUS_META[status].label}
            count={counts.get(status) ?? 0}
            dotClass={STATUS_META[status].dot}
          />
        ))}
      </div>

      {isError ? (
        <Banner tone="error" title="Could not load applications">
          {error.message}
        </Banner>
      ) : null}

      {isLoading ? (
        <SkeletonList count={6} className="h-14" />
      ) : rows.length === 0 ? (
        <EmptyState
          title={
            query || filter !== 'all' ? 'Nothing matches those filters' : 'No applications yet'
          }
          description={
            query || filter !== 'all'
              ? 'Try a different status or clear the search.'
              : 'Track a job from the Pipeline board or the Job Scout page.'
          }
        />
      ) : (
        <div className="overflow-hidden border border-white/8">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-dark-800/40 text-left">
                {['Role', 'Company', 'Status', 'Score', 'Resume', 'Updated', 'Follow-up', ''].map(
                  (heading) => (
                    <th key={heading} className="label-micro px-4 py-2.5 font-normal">
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((application) => (
                <tr
                  key={application.id}
                  tabIndex={0}
                  onClick={() => setSelectedId(application.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedId(application.id);
                    }
                  }}
                  className="cursor-pointer border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.03] focus:bg-white/[0.04] focus:outline-none"
                >
                  <td className="max-w-[22rem] px-4 py-3">
                    <p className="truncate font-medium text-white">
                      {application.job?.title ?? 'Untitled'}
                    </p>
                    {application.job?.location ? (
                      <p className="truncate text-xs text-zinc-500">{application.job.location}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <p className="truncate text-zinc-300">{application.job?.company ?? '—'}</p>
                    <p className="text-[11px] text-zinc-600">
                      {SOURCE_LABELS[application.job?.source ?? 'manual']}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={application.status} />
                  </td>
                  <td className={cn('px-4 py-3 font-mono text-xs', 'text-zinc-300')}>
                    {application.matchScore === null
                      ? '—'
                      : `${Math.round(application.matchScore)}%`}
                  </td>
                  <td className="max-w-[12rem] px-4 py-3">
                    <p className="truncate text-xs text-zinc-400">
                      {application.resumeLabel ?? 'not set'}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {formatRelative(application.updatedAt)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {application.followUpDate ? (
                      <span className="text-amber-300/90">
                        {formatDate(application.followUpDate)}
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ArrowUpRight size={14} className="text-zinc-600" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ApplicationDrawer applicationId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  dotClass,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  dotClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 border px-3 py-1.5 text-xs transition-colors',
        active
          ? 'border-neon/40 bg-neon/10 text-neon'
          : 'border-white/10 text-zinc-400 hover:border-white/25 hover:text-white',
      )}
    >
      {dotClass ? <span className={cn('h-1.5 w-1.5', dotClass)} /> : null}
      {label}
      <span className={cn('font-mono text-[10px]', active ? 'text-neon/70' : 'text-zinc-600')}>
        {count}
      </span>
    </button>
  );
}
