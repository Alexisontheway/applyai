import { Search, Filter, ExternalLink } from 'lucide-react';

export default function JobScoutPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Job Scout</h1>
          <p className="text-gray-500 text-sm mt-1">AI-discovered jobs matched to your profile</p>
        </div>
      </div>

      {/* Search bar */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            placeholder="Search keywords, skills, companies..."
            className="w-full bg-dark-800 border border-neon/10 text-white pl-11 pr-4 py-3 text-sm focus:border-neon/50 focus:outline-none"
          />
        </div>
        <button className="flex items-center gap-2 border border-neon/10 text-gray-400 px-4 py-2 text-sm hover:border-neon/30 hover:text-white transition-colors">
          <Filter size={16} />
          Filters
        </button>
      </div>

      {/* Placeholder for OSINT feed */}
      <div className="border border-neon/10 bg-dark-800/30 p-16 text-center">
        <p className="text-gray-500">
          No jobs discovered yet.{' '}
          <span className="text-neon/60">Phase 3 (OSINT Engine) will populate this feed.</span>
        </p>
        <p className="text-gray-600 text-sm mt-2">
          Jobs from LinkedIn, Indeed, Naukri, and company career pages will appear here
          with match scores from the ML service.
        </p>
      </div>
    </div>
  );
}
