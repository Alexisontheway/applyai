import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { BarChart3, TrendingUp, Clock, Target } from 'lucide-react';

interface ApplicationRow {
  applications: {
    id: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    matchScore: string | null;
  };
  jobs: {
    title: string;
    company: string;
    source: string | null;
  } | null;
}

function daysBetween(a: string, b: string) {
  return Math.round(Math.abs(new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}

export default function AnalyticsPage() {
  const { data: applications } = useQuery({
    queryKey: ['applications'],
    queryFn: () => api.get<ApplicationRow[]>('/applications'),
  });

  const rows = applications ?? [];

  // --- Compute metrics ---
  const total = rows.length;
  const applied = rows.filter((r) => r.applications.status !== 'saved').length;
  const interviews = rows.filter((r) =>
    ['interview', 'offer'].includes(r.applications.status),
  ).length;
  const offers = rows.filter((r) => r.applications.status === 'offer').length;

  const interviewRate = applied > 0 ? ((interviews / applied) * 100).toFixed(0) : '—';
  const offerRate = interviews > 0 ? ((offers / interviews) * 100).toFixed(0) : '—';

  // Average response time (days from created to first status ≠ saved)
  const respondedRows = rows.filter(
    (r) => r.applications.status !== 'saved' && r.applications.updatedAt !== r.applications.createdAt,
  );
  const avgResponse =
    respondedRows.length > 0
      ? (
          respondedRows.reduce(
            (sum, r) => sum + daysBetween(r.applications.createdAt, r.applications.updatedAt),
            0,
          ) / respondedRows.length
        ).toFixed(1)
      : '—';

  // Source breakdown
  const sourceCounts = rows.reduce<Record<string, number>>((acc, r) => {
    const src = r.jobs?.source ?? 'manual';
    acc[src] = (acc[src] ?? 0) + 1;
    return acc;
  }, {});

  const statCards = [
    { label: 'Total Applications', value: total || '—', sub: 'all time', icon: Target, color: 'text-blue-400' },
    { label: 'Interview Rate', value: applied > 0 ? `${interviewRate}%` : '—', sub: `${interviews} of ${applied} applied`, icon: TrendingUp, color: 'text-green-400' },
    { label: 'Offer Conversion', value: interviews > 0 ? `${offerRate}%` : '—', sub: `${offers} of ${interviews} interviews`, icon: BarChart3, color: 'text-neon' },
    { label: 'Avg Response Time', value: avgResponse !== '—' ? `${avgResponse}d` : '—', sub: 'days from apply to response', icon: Clock, color: 'text-yellow-400' },
  ];

  // Status funnel
  const statuses = ['saved', 'applied', 'screening', 'interview', 'offer', 'rejected', 'ghosted'];
  const funnelData = statuses.map((s) => ({
    label: s,
    count: rows.filter((r) => r.applications.status === s).length,
  }));
  const maxCount = Math.max(...funnelData.map((d) => d.count), 1);

  const funnelColors: Record<string, string> = {
    saved: 'bg-blue-500/60',
    applied: 'bg-yellow-500/60',
    screening: 'bg-purple-500/60',
    interview: 'bg-green-500/60',
    offer: 'bg-emerald-500/60',
    rejected: 'bg-red-500/60',
    ghosted: 'bg-gray-500/60',
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">Measure what works in your job search</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-4 mb-10">
        {statCards.map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="border border-neon/10 bg-dark-800/30 p-6 hover:border-neon/30 transition-colors">
            <div className="flex items-center gap-2 mb-3">
              <Icon size={16} className={color} />
              <p className="text-gray-500 text-xs font-mono uppercase tracking-wider">{label}</p>
            </div>
            <p className="text-3xl font-bold text-white">{value}</p>
            <p className="text-gray-600 text-xs mt-1">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Pipeline funnel */}
        <div className="col-span-2 border border-neon/10 bg-dark-800/30 p-6">
          <h2 className="text-white font-semibold text-sm mb-6">Pipeline Breakdown</h2>
          {total === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No applications yet.</p>
          ) : (
            <div className="space-y-3">
              {funnelData.map(({ label, count }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-gray-400 w-16 capitalize">{label}</span>
                  <div className="flex-1 bg-dark-700 h-6 relative">
                    <div
                      className={`h-full ${funnelColors[label]} transition-all duration-500`}
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-6 text-right">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Source breakdown */}
        <div className="border border-neon/10 bg-dark-800/30 p-6">
          <h2 className="text-white font-semibold text-sm mb-6">Job Sources</h2>
          {Object.keys(sourceCounts).length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(sourceCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([src, count]) => (
                  <div key={src} className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm capitalize">{src}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-semibold">{count}</span>
                      <span className="text-gray-600 text-xs">
                        ({total > 0 ? ((count / total) * 100).toFixed(0) : 0}%)
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
