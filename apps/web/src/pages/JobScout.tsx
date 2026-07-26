import { Briefcase, Compass, Loader2, MapPin, Search, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';

interface DiscoveredJob {
  id?: string;
  url?: string;
  title: string;
  company: string;
  location?: string;
  source?: string;
  saved?: boolean;
}

export default function JobScoutPage() {
  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [discoveredJobs, setDiscoveredJobs] = useState<DiscoveredJob[]>([]);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!keywords.trim()) return;

    setIsSearching(true);
    setError('');
    setDiscoveredJobs([]);

    try {
      const result = await api.post<{ data: DiscoveredJob[] }>('/jobs/scrape', {
        keywords: keywords.trim(),
        location: location.trim() || undefined,
        maxResults: 20,
      });
      setDiscoveredJobs(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scraping failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveJob = async (job: DiscoveredJob) => {
    try {
      const jobRes = await api.post<{ id: string }>('/jobs', {
        title: job.title,
        company: job.company,
        location: job.location || null,
        url: job.url || null,
        source: job.source || 'scrape',
        description: null,
        techStack: null,
      });
      // Create the application so it shows up in Pipeline
      await api.post('/applications', { jobId: jobRes.id, status: 'saved' });
      setDiscoveredJobs((prev) => prev.map((j) => (j.url === job.url ? { ...j, saved: true } : j)));
    } catch {
      // silently ignore duplicate saves
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Job Scout</h1>
          <p className="text-gray-500 text-sm mt-1">
            AI-powered job discovery from LinkedIn, Indeed, and Naukri
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Sparkles size={14} />
          <span>OSINT Engine</span>
        </div>
      </div>

      {/* Search Form */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="Job title, skills, or keywords (e.g. Frontend Developer)"
            className="w-full bg-dark-800 border border-neon/10 text-white pl-11 pr-4 py-3 text-sm focus:border-neon/50 focus:outline-none"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location (e.g. Remote, Bangalore)"
          className="w-48 bg-dark-800 border border-neon/10 text-white px-4 py-3 text-sm focus:border-neon/50 focus:outline-none"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={isSearching || !keywords.trim()}
          className="flex items-center gap-2 bg-neon text-black px-6 py-3 text-sm font-semibold hover:bg-neon/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSearching ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Scraping...
            </>
          ) : (
            <>
              <Compass size={16} />
              Discover
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="border border-red-500/30 bg-red-500/5 p-4 mb-6 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {discoveredJobs.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 mb-2">
            {discoveredJobs.length} job{discoveredJobs.length > 1 ? 's' : ''} discovered
          </p>
          {discoveredJobs.map((job) => (
            <div
              key={job.url || job.title}
              className="border border-neon/10 bg-dark-800/50 p-4 flex items-start justify-between gap-4 hover:border-neon/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-medium text-sm truncate">{job.title}</h3>
                <p className="text-gray-400 text-xs mt-1">{job.company}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  {job.location && (
                    <span className="flex items-center gap-1">
                      <MapPin size={12} />
                      {job.location}
                    </span>
                  )}
                  {job.source && (
                    <span className="flex items-center gap-1">
                      <Briefcase size={12} />
                      {job.source}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleSaveJob(job)}
                disabled={job.saved}
                className={`shrink-0 px-4 py-2 text-xs font-medium transition-colors ${
                  job.saved
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-neon/10 text-neon border border-neon/20 hover:bg-neon/20'
                }`}
              >
                {job.saved ? 'Saved' : '+ Save'}
              </button>
            </div>
          ))}
        </div>
      )}

      {!isSearching && discoveredJobs.length === 0 && !error && (
        <div className="border border-neon/10 bg-dark-800/30 p-16 text-center">
          <p className="text-gray-500">
            No jobs discovered yet. Enter keywords and hit Discover to start.
          </p>
          <p className="text-gray-600 text-sm mt-2">
            Scrapes LinkedIn, Indeed, Naukri, and company career pages automatically.
          </p>
        </div>
      )}
    </div>
  );
}
