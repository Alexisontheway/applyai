import { useShell } from '@/components/AppShell';
import { ScoreBadge, SkillChip, StatusPill } from '@/components/indicators';
import {
  Banner,
  Button,
  Panel,
  PanelHeader,
  SectionLabel,
  Skeleton,
  StatTile,
} from '@/components/ui/primitives';
import { STATUS_META, formatDate, formatRelative, percent, pluralize } from '@/lib/format';
import { useDashboard } from '@/lib/queries';
import { cn } from '@/lib/utils';
import type { ApplicationStatus } from '@applyai/shared/types';
import { Link } from '@tanstack/react-router';
import {
  Activity,
  CalendarClock,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react';

const PIPELINE_ORDER: ApplicationStatus[] = [
  'saved',
  'applied',
  'screening',
  'interview',
  'offer',
  'rejected',
  'ghosted',
];

export default function DashboardPage() {
  const { data, isLoading, isError, error } = useDashboard();
  const { openNewApplication } = useShell();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders have no identity
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Banner tone="error" title="Could not load your dashboard">
        {error?.message}
      </Banner>
    );
  }

  const { stats, counts, followUps, stale, recentEvents, topMatches, activeResume, resumeGaps } =
    data;
  const isEmpty = stats.totalApplications === 0;

  return (
    <div className="space-y-7">
      <header className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {isEmpty
              ? 'Start by tracking your first application.'
              : 'Where your search stands right now.'}
          </p>
        </div>
        <Button variant="primary" icon={<Plus size={15} />} onClick={openNewApplication}>
          New application
        </Button>
      </header>

      {isEmpty ? (
        <Panel className="py-14 text-center">
          <Target className="mx-auto mb-4 text-zinc-600" size={32} />
          <p className="text-white">Your pipeline is empty</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
            Add a resume first, then track a job. ApplyAI scores every posting against your resume
            and tracks the response so you can see which resume and which source actually work.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="primary" onClick={openNewApplication} icon={<Plus size={15} />}>
              Track a job
            </Button>
            <Link to="/resumes">
              <Button variant="outline">Add a resume</Button>
            </Link>
          </div>
        </Panel>
      ) : (
        <>
          {/* stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Applications"
              value={stats.totalApplications}
              hint={`${stats.activeApplications} active · ${stats.newThisWeek} new this week`}
              icon={<Target size={15} />}
            />
            <StatTile
              label="Interviews"
              value={stats.interviews}
              hint={`${stats.interviewsLast30Days} in the last 30 days`}
              icon={<TrendingUp size={15} />}
            />
            <StatTile
              label="Response rate"
              value={percent(stats.responseRate)}
              hint={`${counts.rejected} rejections · ${counts.ghosted} ghosted`}
              icon={<Activity size={15} />}
            />
            <StatTile
              label="Avg match score"
              value={stats.avgMatchScore === null ? '—' : `${Math.round(stats.avgMatchScore)}%`}
              hint={
                activeResume ? `Scored against “${activeResume.label}”` : 'No active resume set'
              }
              icon={<Sparkles size={15} />}
            />
          </div>

          {/* pipeline glance */}
          <Panel>
            <PanelHeader
              title="Pipeline at a glance"
              subtitle="Current status of every tracked application"
              action={
                <Link to="/pipeline" className="text-xs text-neon hover:underline">
                  Open board →
                </Link>
              }
            />
            <div className="grid grid-cols-7 gap-2">
              {PIPELINE_ORDER.map((status) => {
                const meta = STATUS_META[status];
                const value = counts[status] ?? 0;
                return (
                  <Link
                    key={status}
                    to="/pipeline"
                    className="group border border-white/8 bg-dark-900/50 p-3 transition-colors hover:border-white/20"
                  >
                    <div className="mb-2 flex items-center gap-1.5">
                      <span className={cn('h-1.5 w-1.5', meta.dot)} />
                      <span className="truncate text-[11px] font-mono uppercase tracking-wide text-zinc-500">
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-xl font-semibold text-white">{value}</p>
                    <div className="mt-2 h-1 bg-white/5">
                      <div
                        className={cn('h-full', meta.bar)}
                        style={{
                          width: `${Math.round((value / Math.max(1, stats.totalApplications)) * 100)}%`,
                        }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* follow ups */}
            <Panel>
              <PanelHeader
                title="Follow-ups"
                subtitle="Chase these before they go cold"
                action={<CalendarClock size={15} className="text-zinc-600" />}
              />
              {followUps.length === 0 ? (
                <p className="py-2 text-sm text-zinc-500">
                  Nothing scheduled. Open an application and set a follow-up date to get it here.
                </p>
              ) : (
                <ul className="space-y-2">
                  {followUps.map((item) => (
                    <li
                      key={item.applicationId}
                      className="flex items-center justify-between gap-3 border border-white/6 bg-dark-900/40 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-white">{item.role}</p>
                        <p className="truncate text-xs text-zinc-500">{item.company}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <StatusPill status={item.status} withDot={false} />
                        <p
                          className={cn(
                            'mt-1 text-[11px]',
                            item.overdue ? 'text-red-400' : 'text-zinc-500',
                          )}
                        >
                          {item.overdue
                            ? `${Math.abs(item.daysUntil)}d overdue`
                            : item.daysUntil === 0
                              ? 'today'
                              : `in ${item.daysUntil}d`}{' '}
                          · {formatDate(item.followUpDate)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {/* recent activity */}
            <Panel>
              <PanelHeader
                title="Recent activity"
                subtitle="Status changes and scores"
                action={<Activity size={15} className="text-zinc-600" />}
              />
              {recentEvents.length === 0 ? (
                <p className="py-2 text-sm text-zinc-500">No activity yet.</p>
              ) : (
                <ol className="space-y-3">
                  {recentEvents.slice(0, 6).map((event) => (
                    <li key={event.id} className="flex items-start gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-zinc-600" />
                      <div className="min-w-0">
                        <p className="text-sm text-zinc-300">
                          <span className="text-white">{event.role}</span> at {event.company}
                          {event.toStatus ? (
                            <span className="ml-2">
                              <StatusPill status={event.toStatus} withDot={false} />
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-[11px] text-zinc-600">
                          {formatRelative(event.createdAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>

            {/* top matches */}
            <Panel>
              <PanelHeader
                title="Highest scoring applications"
                subtitle="Best fit first — spend your effort here"
                action={<Sparkles size={15} className="text-zinc-600" />}
              />
              {topMatches.length === 0 ? (
                <p className="py-2 text-sm text-zinc-500">
                  No scores yet. Add a resume, then run the match engine from any application.
                </p>
              ) : (
                <ul className="space-y-2">
                  {topMatches.map((item) => (
                    <li
                      key={item.applicationId}
                      className="flex items-center justify-between gap-3 border border-white/6 bg-dark-900/40 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-white">{item.role}</p>
                        <p className="truncate text-xs text-zinc-500">{item.company}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusPill status={item.status} withDot={false} />
                        <ScoreBadge score={item.matchScore} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {/* gaps + stale */}
            <Panel>
              <PanelHeader
                title="Recurring gaps"
                subtitle="Skills postings keep asking for that your resume does not show"
                action={<TriangleAlert size={15} className="text-zinc-600" />}
              />
              {resumeGaps.length === 0 ? (
                <p className="py-2 text-sm text-zinc-500">
                  Nothing recurring yet — score a few applications and patterns will appear here.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {resumeGaps.map((gap) => (
                    <SkillChip key={gap.id} label={gap.label} tone="missing" count={gap.count} />
                  ))}
                </div>
              )}

              {stale.length > 0 ? (
                <div className="mt-5 border-t border-white/8 pt-4">
                  <SectionLabel>Going stale ({stale.length})</SectionLabel>
                  <ul className="space-y-1.5">
                    {stale.slice(0, 4).map((item) => (
                      <li
                        key={item.applicationId}
                        className="flex items-center justify-between gap-3 text-xs"
                      >
                        <span className="truncate text-zinc-400">
                          {item.role} · {item.company}
                        </span>
                        <span className="shrink-0 text-amber-300/80">
                          {pluralize(item.daysSinceUpdate, 'day')} quiet
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
