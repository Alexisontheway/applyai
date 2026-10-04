import { ScoreBadge, SkillChip } from '@/components/indicators';
import { useToast } from '@/components/ui/Toast';
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  Field,
  Input,
  Segmented,
  Skeleton,
  SkeletonList,
} from '@/components/ui/primitives';
import { SOURCE_LABELS, formatRelative } from '@/lib/format';
import { useDiscoverySearch, useDiscoverySources, useResumes, useTrackJob } from '@/lib/queries';
import { cn } from '@/lib/utils';
import type { DiscoverySearchInput } from '@applyai/shared/schemas';
import type { DiscoveredJob } from '@applyai/shared/types';
import { Compass, ExternalLink, MapPin, RefreshCw, Search, Wifi } from 'lucide-react';
import { useState } from 'react';

export default function JobScoutPage() {
  const toast = useToast();
  const { data: sources } = useDiscoverySources();
  const { data: resumes } = useResumes();
  const trackJob = useTrackJob();

  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [limit, setLimit] = useState(30);
  const [submitted, setSubmitted] = useState<DiscoverySearchInput | null>(null);

  const search = useDiscoverySearch(submitted);
  const activeResume = resumes?.find((resume) => resume.isActive);

  const runSearch = () => {
    if (!keywords.trim()) return;
    setSubmitted({
      keywords: keywords.trim(),
      location: location.trim() || null,
      remoteOnly,
      sources: selectedSources.length > 0 ? selectedSources : undefined,
      limit,
      score: true,
    });
  };

  const toggleSource = (id: string) => {
    setSelectedSources((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  };

  const handleTrack = async (job: DiscoveredJob) => {
    try {
      const result = await trackJob.mutateAsync({
        title: job.title,
        company: job.company,
        location: job.location,
        url: job.url,
        source: job.source,
        description: job.description,
        postedAt: job.postedAt,
        status: 'saved',
        score: true,
      });
      toast.success(
        result.created ? `Tracking ${job.title}` : `Already tracking ${job.title}`,
        result.match
          ? `Match score ${Math.round(result.match.score)}% — open the drawer for the breakdown.`
          : undefined,
      );
    } catch (error) {
      toast.error('Could not track that job', error instanceof Error ? error.message : undefined);
    }
  };

  const results = search.data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Job Scout</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Searches public job APIs — Greenhouse, Lever, Ashby, Remotive, RemoteOK and Arbeitnow — in
          parallel.
        </p>
      </header>

      <div className="border border-white/8 bg-dark-800/40 p-5 space-y-4">
        <div className="grid gap-3 lg:grid-cols-[2fr_1fr_auto]">
          <Field label="Keywords">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <Input
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && runSearch()}
                placeholder="e.g. frontend engineer, machine learning, platform"
                className="pl-9"
              />
            </div>
          </Field>
          <Field label="Location">
            <Input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && runSearch()}
              placeholder="Remote / Berlin / Bengaluru"
            />
          </Field>
          <div className="flex items-end">
            <Button
              variant="primary"
              size="lg"
              icon={<Compass size={16} />}
              loading={search.isFetching}
              disabled={!keywords.trim()}
              onClick={runSearch}
            >
              Discover
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={remoteOnly}
              onChange={(event) => setRemoteOnly(event.target.checked)}
              className="accent-neon"
            />
            Remote only
          </label>
          <Segmented
            value={String(limit)}
            onChange={(value) => setLimit(Number(value))}
            options={[
              { value: '15', label: '15' },
              { value: '30', label: '30' },
              { value: '60', label: '60' },
            ]}
          />
          <span className="text-xs text-zinc-600">
            {activeResume
              ? `Preview scores use “${activeResume.label}”.`
              : 'Add an active resume to preview match scores.'}
          </span>
        </div>

        {sources && sources.length > 0 ? (
          <div>
            <p className="label-micro mb-2">Sources</p>
            <div className="flex flex-wrap gap-1.5">
              {sources.map((source) => {
                const isSelected =
                  selectedSources.length === 0 || selectedSources.includes(source.id);
                return (
                  <button
                    key={source.id}
                    type="button"
                    title={source.description}
                    onClick={() => toggleSource(source.id)}
                    className={cn(
                      'border px-2.5 py-1 text-xs transition-colors',
                      isSelected
                        ? 'border-neon/30 bg-neon/8 text-neon'
                        : 'border-white/10 text-zinc-500 hover:border-white/25 hover:text-white',
                    )}
                  >
                    {source.label}
                    {source.boardCount !== undefined ? (
                      <span className="ml-1.5 text-[10px] text-zinc-600">{source.boardCount}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {selectedSources.length === 0 ? (
              <p className="mt-2 text-[11px] text-zinc-600">
                All sources selected. Click one to narrow the search.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {results && results.errors.length > 0 ? (
        <Banner tone="warning" title="Some sources did not respond">
          <ul className="space-y-0.5">
            {results.errors.map((providerError) => (
              <li key={providerError.source}>
                {providerError.source}: {providerError.message}
              </li>
            ))}
          </ul>
        </Banner>
      ) : null}

      {search.isFetching ? (
        <SkeletonList count={5} className="h-20" />
      ) : search.isError ? (
        <Banner tone="error" title="Search failed">
          {search.error.message}
        </Banner>
      ) : results ? (
        results.jobs.length === 0 ? (
          <EmptyState
            icon={<Compass size={22} />}
            title="No matches in those sources"
            description={`Searched ${results.sourcesUsed.length} sources in ${Math.round(results.tookMs / 100) / 10}s. Try broader keywords, drop the location filter, or enable more sources.`}
          />
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>
                {results.jobs.length} jobs · {results.sourcesUsed.length} sources ·{' '}
                {(results.tookMs / 1000).toFixed(1)}s
              </span>
              <button
                type="button"
                onClick={() => search.refetch()}
                className="inline-flex items-center gap-1 text-zinc-500 transition-colors hover:text-neon"
              >
                <RefreshCw size={12} /> Refresh
              </button>
            </div>

            {results.jobs.map((job) => (
              <div
                key={`${job.source}-${job.externalId}`}
                className="border border-white/8 bg-dark-800/30 p-4 transition-colors hover:border-white/20"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-medium text-white">{job.title}</h3>
                      {job.matchScore !== null && job.matchScore !== undefined ? (
                        <span className="inline-flex items-center gap-1 border border-white/10 bg-white/5 px-1.5 py-0.5">
                          <ScoreBadge score={job.matchScore} />
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-sm text-zinc-400">{job.company}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                      {job.location ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={11} />
                          {job.location}
                        </span>
                      ) : null}
                      {job.remote ? (
                        <span className="inline-flex items-center gap-1 text-neon/70">
                          <Wifi size={11} />
                          Remote
                        </span>
                      ) : null}
                      <span>{SOURCE_LABELS[job.source]}</span>
                      {job.salary ? (
                        <span className="text-emerald-300/80">{job.salary}</span>
                      ) : null}
                      {job.postedAt ? <span>posted {formatRelative(job.postedAt)}</span> : null}
                    </div>
                    {job.tags.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {job.tags.slice(0, 6).map((tag) => (
                          <SkillChip key={`${job.externalId}-${tag}`} label={tag} />
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {job.alreadyTracked ? (
                      <Badge tone="emerald">Tracked</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleTrack(job)}
                        loading={trackJob.isPending && trackJob.variables?.url === job.url}
                      >
                        Track
                      </Button>
                    )}
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-[11px] text-zinc-500 transition-colors hover:text-neon"
                    >
                      Open posting <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <EmptyState
          icon={<Compass size={22} />}
          title="Search live job boards"
          description="Enter keywords and hit Discover. Results come straight from public APIs — no scraping, no API keys. Preview scores use your active resume."
        />
      )}
    </div>
  );
}
