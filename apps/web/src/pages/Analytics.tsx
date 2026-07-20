export default function AnalyticsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">Measure what works in your job search</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-10">
        {[
          { label: 'Application Rate', value: '—', sub: 'per week' },
          { label: 'Interview Rate', value: '—', sub: '% of applied' },
          { label: 'Response Time', value: '—', sub: 'avg days' },
        ].map(({ label, value, sub }) => (
          <div
            key={label}
            className="border border-neon/10 bg-dark-800/30 p-6 hover:border-neon/30 transition-colors"
          >
            <p className="text-gray-500 text-xs font-mono uppercase tracking-wider mb-2">{label}</p>
            <p className="text-3xl font-bold text-white">{value}</p>
            <p className="text-gray-600 text-xs mt-1">{sub}</p>
          </div>
        ))}
      </div>

      <div className="border border-neon/10 bg-dark-800/30 p-16 text-center">
        <p className="text-gray-500">
          Analytics will populate once you have applications in the pipeline.{' '}
          <span className="text-neon/60">Phase 5 will add charts here.</span>
        </p>
      </div>
    </div>
  );
}
