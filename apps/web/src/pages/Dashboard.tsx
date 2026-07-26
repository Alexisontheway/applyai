import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Briefcase, Send, CheckCircle, XCircle } from 'lucide-react';

// Shape returned by GET /api/applications (Drizzle leftJoin)
interface ApplicationRow {
  applications: {
    id: string;
    status: string;
    notes: string | null;
    matchScore: string | null;
    createdAt: string;
  };
  jobs: {
    title: string;
    company: string;
  } | null;
}

const statsCards = [
  { label: 'Saved', icon: Briefcase, color: 'text-blue-400', filter: 'saved' },
  { label: 'Applied', icon: Send, color: 'text-yellow-400', filter: 'applied' },
  { label: 'Interview', icon: CheckCircle, color: 'text-green-400', filter: 'interview' },
  { label: 'Rejected', icon: XCircle, color: 'text-red-400', filter: 'rejected' },
];

export default function DashboardPage() {
  const { data: applications } = useQuery({
    queryKey: ['applications'],
    queryFn: () => api.get<ApplicationRow[]>('/applications'),
  });

  const rows = applications ?? [];
  const stats = statsCards.map(({ label, icon: Icon, color, filter }) => ({
    label,
    value: rows.filter((a) => a.applications.status === filter).length,
    icon: Icon,
    color,
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Dashboard</h1>
      <p className="text-gray-500 text-sm mb-8">Your job search at a glance</p>

      <div className="grid grid-cols-4 gap-4 mb-10">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="border border-neon/10 bg-dark-800/30 p-6 hover:border-neon/30 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <Icon size={20} className={color} />
            </div>
            <p className="text-3xl font-bold text-white">{value}</p>
            <p className="text-gray-500 text-sm mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="border border-neon/10 bg-dark-800/30 p-6">
        <h2 className="text-white font-semibold mb-4">Recent Applications</h2>
        {rows.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No applications yet. Add your first job in the{' '}
            <a href="/pipeline" className="text-neon hover:underline">
              Pipeline
            </a>
            .
          </p>
        ) : (
          <div className="space-y-2">
            {rows.slice(0, 5).map((row) => (
              <div
                key={row.applications.id}
                className="flex items-center justify-between py-2 border-b border-neon/5 last:border-0"
              >
                <span className="text-white text-sm">{row.jobs?.title ?? 'Untitled Job'}</span>
                <span className="text-xs font-mono uppercase text-neon/60">
                  {row.applications.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
