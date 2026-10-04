import { SkillChip } from '@/components/indicators';
import {
  Banner,
  Panel,
  PanelHeader,
  SectionLabel,
  Skeleton,
  StatTile,
} from '@/components/ui/primitives';
import { SOURCE_LABELS, STATUS_META, scoreColor } from '@/lib/format';
import { useAnalytics } from '@/lib/queries';
import { Clock, Target, TrendingUp, Trophy } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const CHART_COLORS = ['#8a8a8a', '#38bdf8', '#a78bfa', '#eaff00', '#34d399', '#f87171', '#71717a'];

export default function AnalyticsPage() {
  const { data, isLoading, isError, error } = useAnalytics();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders have no identity
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Banner tone="error" title="Could not load analytics">
        {error?.message}
      </Banner>
    );
  }

  if (data.totals.applications === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Analytics</h1>
        <Panel className="py-16 text-center text-sm text-zinc-500">
          Track a few applications and this page fills with funnel, source ROI and resume
          performance data.
        </Panel>
      </div>
    );
  }

  const funnelData = data.funnel.map((step) => ({ name: step.label, count: step.count }));
  const weeklyData = data.weekly.map((week) => ({
    week: new Date(week.week).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    applications: week.applications,
    interviews: week.interviews,
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Analytics</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Computed in the database from your real status history — not estimated in the browser.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Interview rate"
          value={data.rates.interviewRate === null ? '—' : `${data.rates.interviewRate}%`}
          hint={`${data.totals.interviews} interviews from ${data.totals.applied} applications sent`}
          icon={<TrendingUp size={15} />}
        />
        <StatTile
          label="Offer rate"
          value={data.rates.offerRate === null ? '—' : `${data.rates.offerRate}%`}
          hint={`${data.totals.offers} offers from ${data.totals.interviews} interviews`}
          icon={<Trophy size={15} />}
        />
        <StatTile
          label="First response"
          value={
            data.timing.avgFirstResponseDays === null ? '—' : `${data.timing.avgFirstResponseDays}d`
          }
          hint={`Average days to any reply · response rate ${data.rates.responseRate ?? '—'}%`}
          icon={<Clock size={15} />}
        />
        <StatTile
          label="Time in stage"
          value={
            data.timing.avgDaysInCurrentStage === null
              ? '—'
              : `${data.timing.avgDaysInCurrentStage}d`
          }
          hint={
            data.timing.avgDaysToInterview === null
              ? 'Average for active applications'
              : `Avg ${data.timing.avgDaysToInterview}d to first interview`
          }
          icon={<Target size={15} />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Pipeline funnel" subtitle="Where every application currently sits" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="#ffffff10" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  axisLine={{ stroke: '#ffffff14' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{ background: '#111', border: '1px solid #ffffff1a', fontSize: 12 }}
                  labelStyle={{ color: '#fff' }}
                  cursor={{ fill: '#ffffff08' }}
                />
                <Bar dataKey="count" name="Applications">
                  {funnelData.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Last 8 weeks" subtitle="Applications sent vs interviews reached" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="applicationsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#eaff00" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#eaff00" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="interviewsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#ffffff10" vertical={false} />
                <XAxis
                  dataKey="week"
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  axisLine={{ stroke: '#ffffff14' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{ background: '#111', border: '1px solid #ffffff1a', fontSize: 12 }}
                  labelStyle={{ color: '#fff' }}
                />
                <Area
                  type="monotone"
                  dataKey="applications"
                  stroke="#eaff00"
                  fill="url(#applicationsFill)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="interviews"
                  stroke="#34d399"
                  fill="url(#interviewsFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Source ROI" subtitle="Which discovery source actually converts" />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                {['Source', 'Apps', 'Replies', 'Interviews', 'Response rate'].map((heading) => (
                  <th key={heading} className="label-micro py-2 text-left font-normal">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.sources.map((row) => (
                <tr key={row.source} className="border-b border-white/5 last:border-0">
                  <td className="py-2 text-zinc-300">{SOURCE_LABELS[row.source] ?? row.source}</td>
                  <td className="py-2 font-mono text-xs text-zinc-400">{row.applications}</td>
                  <td className="py-2 font-mono text-xs text-zinc-400">{row.responded}</td>
                  <td className="py-2 font-mono text-xs text-zinc-400">{row.interviews}</td>
                  <td className="py-2 font-mono text-xs text-neon/80">
                    {row.responseRate === null ? '—' : `${row.responseRate}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-zinc-600">
            A reply means the company moved you past “applied” — rejections count as replies,
            silence does not.
          </p>
        </Panel>

        <Panel>
          <PanelHeader title="Resume performance" subtitle="Which version gets you interviews" />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                {['Resume', 'Used', 'Interviews', 'Avg score', 'Rate'].map((heading) => (
                  <th key={heading} className="label-micro py-2 text-left font-normal">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.resumes.map((row) => (
                <tr key={row.resumeId} className="border-b border-white/5 last:border-0">
                  <td className="max-w-[14rem] truncate py-2 text-zinc-300">{row.label}</td>
                  <td className="py-2 font-mono text-xs text-zinc-400">{row.applications}</td>
                  <td className="py-2 font-mono text-xs text-zinc-400">{row.interviews}</td>
                  <td className={`py-2 font-mono text-xs ${scoreColor(row.avgMatchScore)}`}>
                    {row.avgMatchScore === null ? '—' : `${Math.round(row.avgMatchScore)}%`}
                  </td>
                  <td className="py-2 font-mono text-xs text-neon/80">
                    {row.interviewRate === null ? '—' : `${row.interviewRate}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Score vs outcome"
            subtitle="Do higher-scoring applications convert better?"
          />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                {['Match score', 'Applications', 'Interviews', 'Interview rate'].map((heading) => (
                  <th key={heading} className="label-micro py-2 text-left font-normal">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.matchBuckets.map((bucket) => (
                <tr key={bucket.label} className="border-b border-white/5 last:border-0">
                  <td className="py-2 capitalize text-zinc-300">{bucket.label}</td>
                  <td className="py-2 font-mono text-xs text-zinc-400">{bucket.applications}</td>
                  <td className="py-2 font-mono text-xs text-zinc-400">{bucket.interviews}</td>
                  <td className="py-2 font-mono text-xs text-neon/80">
                    {bucket.interviewRate === null ? '—' : `${bucket.interviewRate}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel>
          <PanelHeader
            title="Skills postings keep asking for"
            subtitle="Aggregated across your recent match results"
          />
          {data.topMissingSkills.length === 0 ? (
            <p className="text-sm text-zinc-500">No gap data yet — score a few applications.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {data.topMissingSkills.map((skill) => (
                  <SkillChip
                    key={skill.id}
                    label={skill.label}
                    tone="missing"
                    count={skill.count}
                  />
                ))}
              </div>
              <SectionLabel className="mt-5">How to read this</SectionLabel>
              <p className="text-xs leading-relaxed text-zinc-500">
                These are requirements your resume does not currently show. If one appears across
                many postings you care about, it is the highest-leverage thing to learn or to write
                up honestly next.
              </p>
            </>
          )}
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Funnel detail" subtitle="Same data as the chart, with stage colours" />
        <div className="space-y-2">
          {data.funnel.map((step) => {
            const meta = STATUS_META[step.status];
            const max = Math.max(...data.funnel.map((entry) => entry.count), 1);
            return (
              <div key={step.status} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-[11px] font-mono uppercase tracking-wide text-zinc-400">
                  {meta.label}
                </span>
                <div className="h-4 flex-1 bg-white/5">
                  <div
                    className={`h-full ${meta.bar}`}
                    style={{ width: `${(step.count / max) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right font-mono text-xs text-zinc-400">{step.count}</span>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
