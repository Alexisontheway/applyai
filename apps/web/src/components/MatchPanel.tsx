import { MatchBreakdownBars, RichText, SkillChip } from '@/components/indicators';
import { Badge, Button, EmptyState, Panel, SectionLabel, Select } from '@/components/ui/primitives';
import { scoreColor } from '@/lib/format';
import type { MatchResult, Resume } from '@applyai/shared/types';
import { RefreshCw, Sparkles, Target } from 'lucide-react';
import { useState } from 'react';

export function MatchPanel({
  match,
  resumes,
  applicationResumeId,
  isScoring,
  onScore,
  compact = false,
}: {
  match: MatchResult | null;
  resumes: Resume[];
  applicationResumeId: string | null;
  isScoring: boolean;
  onScore: (resumeId: string | null) => void;
  compact?: boolean;
}) {
  const [resumeId, setResumeId] = useState<string | 'auto'>('auto');
  const activeResume = resumes.find((resume) => resume.isActive);
  const effectiveResumeId =
    resumeId === 'auto' ? (applicationResumeId ?? activeResume?.id ?? null) : resumeId;

  if (!match) {
    return (
      <EmptyState
        icon={<Target size={22} />}
        title="No match score yet"
        description="The match engine compares the posting's requirements against your resume: skill coverage, keyword overlap and (when the ML service runs) semantic similarity. Every result explains itself."
        action={
          <div className="flex items-center gap-2">
            <Select
              className="w-56"
              value={resumeId}
              onChange={(event) => setResumeId(event.target.value)}
            >
              <option value="auto">
                {activeResume ? `Active — ${activeResume.label}` : 'Active resume (none)'}
              </option>
              {resumes
                .filter((resume) => !resume.isActive)
                .map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.label}
                  </option>
                ))}
            </Select>
            <Button
              variant="primary"
              icon={<Sparkles size={14} />}
              loading={isScoring}
              onClick={() => onScore(effectiveResumeId)}
            >
              Run match
            </Button>
          </div>
        }
      />
    );
  }

  const missing = match.missingSkills.slice(0, 12);
  const matched = match.matchedSkills.slice(0, 14);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-semibold tracking-tight ${scoreColor(match.score)}`}>
              {Math.round(match.score)}%
            </span>
            <span className="text-xs text-zinc-500">match</span>
          </div>
          <p className="text-sm text-zinc-400 mt-1 max-w-xl leading-relaxed">{match.summary}</p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Badge tone={match.breakdown.semanticSimilarity === null ? 'neutral' : 'neon'}>
            {match.breakdown.engine}
          </Badge>
          <div className="flex items-center gap-2">
            <Select
              className="h-8 w-44 py-0 text-xs"
              value={resumeId}
              onChange={(event) => setResumeId(event.target.value)}
            >
              <option value="auto">
                {activeResume ? `Active — ${activeResume.label}` : 'Active resume (none)'}
              </option>
              {resumes
                .filter((resume) => !resume.isActive)
                .map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.label}
                  </option>
                ))}
            </Select>
            <Button
              size="sm"
              variant="ghost"
              icon={<RefreshCw size={13} className={isScoring ? 'animate-spin' : undefined} />}
              onClick={() => onScore(effectiveResumeId)}
              disabled={isScoring}
              title="Re-run the match engine"
            >
              Re-score
            </Button>
          </div>
        </div>
      </div>

      <Panel padded={false} className="p-4 bg-dark-900/40">
        <SectionLabel>How this score was built</SectionLabel>
        <MatchBreakdownBars match={match} />
        <p className="text-[11px] text-zinc-600 mt-3">
          Weights: skill coverage {(match.breakdown.weights.skillCoverage * 100).toFixed(0)}% ·
          keywords {(match.breakdown.weights.keywordRelevance * 100).toFixed(0)}%
          {match.breakdown.semanticSimilarity !== null
            ? ` · semantic ${(match.breakdown.weights.semanticSimilarity * 100).toFixed(0)}%`
            : ' · semantic off (start the ML service to enable)'}
        </p>
      </Panel>

      {!compact && matched.length > 0 ? (
        <div>
          <SectionLabel>Covered ({match.matchedSkills.length})</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {matched.map((skill) => (
              <SkillChip
                key={skill.id}
                label={skill.label}
                tone="matched"
                count={skill.count}
                title={skill.contexts?.[0] ?? undefined}
              />
            ))}
          </div>
        </div>
      ) : null}

      {!compact && missing.length > 0 ? (
        <div>
          <SectionLabel>Gaps ({match.missingSkills.length})</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {missing.map((skill) => (
              <SkillChip
                key={skill.id}
                label={skill.label}
                tone="missing"
                title={
                  skill.weight >= 0.9
                    ? 'Explicitly required in the posting'
                    : 'Mentioned in the posting'
                }
              />
            ))}
          </div>
        </div>
      ) : null}

      {!compact && match.suggestions.length > 0 ? (
        <div>
          <SectionLabel>What to do next</SectionLabel>
          <ul className="space-y-2">
            {match.suggestions.map((suggestion) => (
              <li key={suggestion} className="flex gap-2 text-[13px] leading-relaxed text-zinc-400">
                <span className="text-neon mt-0.5">→</span>
                <RichText text={suggestion} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
